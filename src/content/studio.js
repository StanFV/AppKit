// Content script voor Power Apps Studio (isolated world).
// Haalt de YAML van de geselecteerde control of het geselecteerde scherm op,
// opent die in de editor en plakt bewerkte YAML terug in Studio.
(() => {
  if (window.__paToolsStudio) return;
  window.__paToolsStudio = true;

  const TAG = "pa-tools";
  const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);

  let lastCaptured = null; // { yaml, time, via }
  let lastFocused = null;
  let pendingMonaco = new Map();

  // ---------------------------------------------------------------- helpers

  function looksLikePowerAppsYaml(text) {
    if (!text || typeof text !== "string") return false;
    return /^\s*(-\s+)?['"]?[^\s:]+['"]?:\s*\r?\n\s+(Control|Properties|Children|Variant|ComponentName):/m.test(text) ||
      /^\s*(Screens|ComponentDefinitions):\s*$/m.test(text);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Studio draait (afhankelijk van regio en versie) op verschillende domeinen
  // en soms in een iframe. We herkennen het Studio-frame daarom aan de
  // structuurweergave en niet aan het adres.
  function hasTreeView() {
    return !!document.querySelector("[role='tree'], [role='treegrid']");
  }

  function looksLikeStudio() {
    return hasTreeView() && window.innerWidth >= 500 && window.innerHeight >= 300;
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  // ---------------------------------------------------------- bridge berichten

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.tag !== TAG || data.direction !== "to-content") return;

    if (data.type === "captured" && looksLikePowerAppsYaml(data.yaml)) {
      lastCaptured = { yaml: data.yaml, time: Date.now(), via: data.via };
    } else if (data.type === "monaco-result") {
      const resolve = pendingMonaco.get(data.id);
      if (resolve) {
        pendingMonaco.delete(data.id);
        resolve(data.yaml || null);
      }
    }
  });

  // Extra vangnet als de MAIN world bridge niet geladen is.
  window.addEventListener("copy", (e) => {
    setTimeout(() => {
      try {
        const text = e.clipboardData && e.clipboardData.getData("text/plain");
        if (looksLikePowerAppsYaml(text)) lastCaptured = { yaml: text, time: Date.now(), via: "copy-event" };
      } catch (err) { /* negeren */ }
    }, 0);
  });

  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el && el !== document.body && !(el.closest && el.closest(".pa-tools-root"))) lastFocused = el;
  }, true);

  function readMonaco() {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      pendingMonaco.set(id, resolve);
      window.postMessage({ tag: TAG, direction: "to-page", type: "read-monaco", id }, "*");
      setTimeout(() => {
        if (pendingMonaco.has(id)) {
          pendingMonaco.delete(id);
          resolve(null);
        }
      }, 400);
    });
  }

  async function waitForCapture(since, timeout) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (lastCaptured && lastCaptured.time >= since) return lastCaptured.yaml;
      await sleep(50);
    }
    return null;
  }

  // Zoekt de knop "Code kopiëren" in een geopend venster "Code weergeven".
  function findCopyCodeButton() {
    const labels = /^(copy code|code kopi[eë]ren|code kopieren)$/i;
    const candidates = document.querySelectorAll("button, [role='button']");
    for (const el of candidates) {
      const text = (el.innerText || el.getAttribute("aria-label") || el.title || "").trim();
      if (labels.test(text) && isVisible(el)) return el;
    }
    return null;
  }

  // ------------------------------------------------------------- YAML ophalen

  async function grabYaml() {
    // 1. Geopend venster "Code weergeven": direct uit Monaco lezen.
    const fromMonaco = await readMonaco();
    if (fromMonaco) return { yaml: fromMonaco, via: "monaco" };

    // 2. Geopend venster "Code weergeven": op "Code kopiëren" klikken.
    const copyBtn = findCopyCodeButton();
    if (copyBtn) {
      const since = Date.now();
      copyBtn.click();
      const yaml = await waitForCapture(since, 1500);
      if (yaml) return { yaml, via: "copy-button" };
    }

    // 3. Geselecteerde control kopiëren zoals Ctrl+C in de structuurweergave.
    //    Studio verwerkt Ctrl+C via een toetsenbordhandler of via het
    //    copy-event; we proberen beide.
    const since = Date.now();
    let target = document.activeElement;
    if (lastFocused && document.contains(lastFocused)) {
      if (document.activeElement !== lastFocused) {
        try { lastFocused.focus({ preventScroll: true }); } catch (e) { /* negeren */ }
      }
      target = lastFocused;
    }
    try {
      const init = { key: "c", code: "KeyC", keyCode: 67, which: 67, ctrlKey: !IS_MAC, metaKey: IS_MAC, bubbles: true, cancelable: true, composed: true };
      (target || document.body).dispatchEvent(new KeyboardEvent("keydown", init));
      (target || document.body).dispatchEvent(new KeyboardEvent("keyup", init));
    } catch (e) { /* negeren */ }
    let yaml = await waitForCapture(since, 700);
    if (yaml) return { yaml, via: "selection" };

    try { document.execCommand("copy"); } catch (e) { /* negeren */ }
    yaml = await waitForCapture(since, 1000);
    if (yaml) return { yaml, via: "selection" };

    // 4. Recent door de gebruiker gekopieerde YAML (binnen 5 minuten).
    if (lastCaptured && Date.now() - lastCaptured.time < 5 * 60 * 1000) {
      return { yaml: lastCaptured.yaml, via: "recent" };
    }
    return null;
  }

  function appTitle() {
    const t = (document.title || "").replace(/\s*[-|]\s*Power Apps.*$/i, "").trim();
    return t || "Power Apps";
  }

  async function openEditor() {
    showToast("YAML ophalen…", "info", 1500);
    const result = await grabYaml();
    chrome.runtime.sendMessage({
      type: "open-editor",
      yaml: result ? result.yaml : null,
      via: result ? result.via : "clipboard",
      appTitle: appTitle(),
      url: location.href
    });
    if (!result) {
      showToast(
        "Geen YAML gevonden in de selectie. De editor probeert het klembord te lezen. Tip: selecteer een scherm of control in de structuurweergave en kies <b>Code kopiëren</b> of druk op Ctrl+C.",
        "warn",
        7000
      );
    }
  }

  // ----------------------------------------------------------- YAML plakken

  function pasteYaml(yaml, mode) {
    window.focus();
    const target = (lastFocused && document.contains(lastFocused)) ? lastFocused : document.activeElement || document.body;
    try { target.focus({ preventScroll: true }); } catch (e) { /* negeren */ }

    let handled = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", yaml);
      const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(evt);
      handled = evt.defaultPrevented;
    } catch (e) {
      handled = false;
    }

    const replaceSteps = mode === "replace"
      ? "<br><br><b>Vervangen:</b> verwijder daarna het originele element en geef het nieuwe element (met achtervoegsel _1) de oorspronkelijke naam."
      : "";

    if (handled) {
      showToast("De YAML is in Studio geplakt." + replaceSteps, "ok", mode === "replace" ? 12000 : 5000);
    } else {
      showToast(
        "De YAML staat op het klembord. Selecteer in de structuurweergave het scherm (of de container) waar het moet komen en druk op <b>Ctrl+V</b> of kies <b>Code plakken</b>." + replaceSteps,
        "info",
        15000
      );
    }
    return handled;
  }

  // ------------------------------------------------------------------- UI

  let toastHost = null;
  function showToast(html, kind = "info", duration = 5000) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "pa-tools-root pa-tools-toasts";
      document.documentElement.appendChild(toastHost);
    }
    const toast = document.createElement("div");
    toast.className = `pa-tools-toast pa-tools-toast--${kind}`;
    toast.innerHTML = `<div class="pa-tools-toast__body">${html}</div><button class="pa-tools-toast__close" aria-label="Sluiten">×</button>`;
    toast.querySelector("button").addEventListener("click", () => toast.remove());
    toastHost.appendChild(toast);
    if (duration) setTimeout(() => toast.remove(), duration);
  }

  function createFloatingButton() {
    if (document.querySelector(".pa-tools-fab")) return;

    const btn = document.createElement("button");
    btn.className = "pa-tools-root pa-tools-fab";
    btn.type = "button";
    btn.title = "Open de geselecteerde control of het scherm in de YAML editor (Ctrl+Shift+Y)";
    btn.innerHTML = `<span class="pa-tools-fab__icon">{ }</span><span class="pa-tools-fab__label">YAML bewerken</span>`;

    // Focus in Studio laten waar die is, zodat de selectie in de
    // structuurweergave gekopieerd kan worden.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openEditor();
    });

    chrome.storage.local.get({ fabHidden: false }, ({ fabHidden }) => {
      if (fabHidden) btn.style.display = "none";
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.fabHidden) btn.style.display = changes.fabHidden.newValue ? "none" : "";
    });

    document.documentElement.appendChild(btn);
  }

  // Sneltoets binnen de Studio-frame (de manifest-sneltoets werkt ook als de
  // focus in een iframe staat, maar deze is directer).
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "Y" || e.key === "y")) {
      e.preventDefault();
      e.stopPropagation();
      openEditor();
    }
  }, true);

  // ------------------------------------------------------------ berichten

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === "ping-studio") {
      sendResponse({ studio: looksLikeStudio(), title: appTitle() });
      return;
    }

    if (msg.type === "trigger-open-editor") {
      openEditor();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "paste-yaml") {
      const handled = pasteYaml(msg.yaml, msg.mode);
      sendResponse({ ok: true, handled });
      return;
    }
  });

  // De structuurweergave verschijnt pas als Studio klaar is met laden.
  const fabTimer = setInterval(() => {
    if (document.querySelector(".pa-tools-fab")) {
      clearInterval(fabTimer);
    } else if (document.body && looksLikeStudio()) {
      createFloatingButton();
      clearInterval(fabTimer);
    }
  }, 1500);
})();
