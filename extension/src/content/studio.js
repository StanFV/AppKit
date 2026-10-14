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
    const selection = selectedItemInfo();
    const result = await grabYaml();
    chrome.runtime.sendMessage({
      type: "open-editor",
      selection,
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

  // ----------------------------------------------------- structuurweergave

  function treeItems() {
    return [...document.querySelectorAll("[role='treeitem']")];
  }

  function itemText(el) {
    return ((el.innerText || el.textContent || "").split("\n").map((t) => t.trim()).find(Boolean)) || "";
  }

  function itemMatches(el, name) {
    if (itemText(el) === name) return true;
    const aria = (el.getAttribute("aria-label") || "").trim();
    return aria === name || aria.startsWith(name + ",") || aria.startsWith(name + " ");
  }

  function findItem(name) {
    if (!name) return null;
    const items = treeItems();
    return items.find((el) => itemText(el) === name) || items.find((el) => itemMatches(el, name)) || null;
  }

  function itemLevel(el) {
    const lvl = parseInt(el.getAttribute("aria-level"), 10);
    if (!isNaN(lvl)) return lvl;
    let depth = 0;
    let p = el.parentElement && el.parentElement.closest("[role='treeitem']");
    while (p) { depth++; p = p.parentElement && p.parentElement.closest("[role='treeitem']"); }
    return depth + 1;
  }

  function parentItem(el) {
    const nested = el.parentElement && el.parentElement.closest("[role='treeitem']");
    if (nested) return nested;
    const items = treeItems();
    const lvl = itemLevel(el);
    for (let i = items.indexOf(el) - 1; i >= 0; i--) {
      if (itemLevel(items[i]) < lvl) return items[i];
    }
    return null;
  }

  // Het element direct boven (of anders onder) het item op hetzelfde niveau.
  function siblingItem(el) {
    const items = treeItems();
    const lvl = itemLevel(el);
    const idx = items.indexOf(el);
    for (let i = idx - 1; i >= 0; i--) {
      const l = itemLevel(items[i]);
      if (l === lvl) return { el: items[i], before: true };
      if (l < lvl) break;
    }
    for (let i = idx + 1; i < items.length; i++) {
      const l = itemLevel(items[i]);
      if (l === lvl) return { el: items[i], before: false };
      if (l < lvl) break;
    }
    return null;
  }

  function selectedItemInfo() {
    const sel = document.querySelector("[role='treeitem'][aria-selected='true']") ||
      (document.activeElement && document.activeElement.closest && document.activeElement.closest("[role='treeitem']"));
    if (!sel) return null;
    const parent = parentItem(sel);
    return { name: itemText(sel), parentName: parent ? itemText(parent) : null };
  }

  function mouse(el, type, extra = {}) {
    const r = el.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + r.height / 2, button: 0, ...extra };
    const Ctor = type.startsWith("pointer") && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, init));
  }

  function clickItem(el) {
    try { el.scrollIntoView({ block: "nearest" }); } catch (e) { /* negeren */ }
    const target = el.querySelector("[role='button'], button, span, div") || el;
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) mouse(target, type);
    try { el.focus({ preventScroll: true }); } catch (e) { /* negeren */ }
  }

  function pressKey(el, key, opts = {}) {
    const codes = { Delete: 46, Escape: 27, z: 90 };
    const init = { key, code: key.length === 1 ? "Key" + key.toUpperCase() : key, keyCode: codes[key] || 0, which: codes[key] || 0, bubbles: true, cancelable: true, composed: true, ...opts };
    (el || document.body).dispatchEvent(new KeyboardEvent("keydown", init));
    (el || document.body).dispatchEvent(new KeyboardEvent("keyup", init));
  }

  function findVisibleButton(re, root = document) {
    const els = root.querySelectorAll("[role='menuitem'], [role='option'], button, [role='button']");
    for (const el of els) {
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim();
      if (re.test(text) && isVisible(el)) return el;
    }
    return null;
  }

  async function waitFor(fn, timeout, interval = 100) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return fn();
  }

  async function confirmDialogIfAny() {
    await sleep(250);
    const dialog = [...document.querySelectorAll("[role='dialog'], [role='alertdialog']")].find(isVisible);
    if (!dialog) return;
    const btn = findVisibleButton(/^(delete|verwijderen|ok|ja|yes)$/i, dialog);
    if (btn) btn.click();
  }

  // Studio tekent de structuurweergave opnieuw bij elke wijziging, dus we
  // controleren op naam en niet op het (mogelijk vervangen) element.
  async function isGone(name) {
    return !!(await waitFor(() => !findItem(name), 1500));
  }

  async function deleteItem(el, name) {
    // 1. Delete-toets, alleen als vaststaat dat precies dit item geselecteerd is.
    clickItem(el);
    await sleep(250);
    const current = findItem(name);
    const usesSelection = treeItems().some((i) => i.hasAttribute("aria-selected"));
    if (current && usesSelection && current.getAttribute("aria-selected") === "true") {
      const before = treeItems().length;
      pressKey(current, "Delete");
      await confirmDialogIfAny();
      if (await isGone(name)) return true;
      if (treeItems().length < before) {
        // Er is iets anders verwijderd: terugdraaien en stoppen.
        await undo();
        return false;
      }
    }

    // 2. Contextmenu (rechtermuisklik) met "Verwijderen".
    const fresh = findItem(name);
    if (!fresh) return true;
    mouse(fresh, "contextmenu", { button: 2 });
    let item = await waitFor(() => findVisibleButton(/^(delete|verwijderen)$/i), 1000);
    if (!item) {
      // 3. Knop "Meer opties" (…) bij het item.
      const more = fresh.querySelector("[aria-label*='more' i], [aria-label*='meer' i], [title*='more' i], [title*='meer' i]");
      if (more) {
        more.click();
        item = await waitFor(() => findVisibleButton(/^(delete|verwijderen)$/i), 1000);
      }
    }
    if (item) {
      item.click();
      await confirmDialogIfAny();
      if (await isGone(name)) return true;
    }
    pressKey(document.activeElement, "Escape");
    return false;
  }

  async function undo() {
    const btn = findVisibleButton(/^(undo|ongedaan maken)$/i);
    if (btn) btn.click();
    else pressKey(document.activeElement || document.body, "z", { ctrlKey: !IS_MAC, metaKey: IS_MAC });
    await sleep(800);
  }

  function dispatchPaste(target, yaml) {
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", yaml);
      const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(evt);
      return evt.defaultPrevented;
    } catch (e) {
      return false;
    }
  }

  function diagnostics() {
    const items = treeItems().slice(0, 25).map((el) => ({
      text: itemText(el),
      aria: el.getAttribute("aria-label"),
      level: el.getAttribute("aria-level"),
      selected: el.getAttribute("aria-selected")
    }));
    const buttons = [...document.querySelectorAll("button[aria-label]")].filter(isVisible).slice(0, 40).map((b) => b.getAttribute("aria-label"));
    return JSON.stringify({ url: location.host + location.pathname, treeItems: items, buttons }, null, 1);
  }

  // ----------------------------------------------------------- YAML plakken

  // Als nieuw toevoegen: plakken bij de huidige selectie.
  function pasteYaml(yaml) {
    window.focus();
    const target = (lastFocused && document.contains(lastFocused)) ? lastFocused : document.activeElement || document.body;
    try { target.focus({ preventScroll: true }); } catch (e) { /* negeren */ }
    const handled = dispatchPaste(target, yaml);

    if (handled) {
      showToast("De YAML is in Studio geplakt.", "ok", 5000);
    } else {
      showToast(
        "De YAML staat op het klembord. Selecteer in de structuurweergave het scherm (of de container) waar het moet komen en druk op <b>Ctrl+V</b> of kies <b>Code plakken</b>.",
        "info",
        15000
      );
    }
    return { ok: true, handled };
  }

  // Origineel vervangen: eerst het origineel verwijderen en daarna plakken,
  // zodat alle namen gelijk blijven (geen _1). Mislukt het plakken, dan wordt
  // het verwijderen ongedaan gemaakt.
  async function replaceYaml(yaml, { targetName, newName, parentName, kind }) {
    window.focus();
    const fail = (step, error) => {
      showToast(error, "error", 15000);
      return { ok: false, step, error, diagnostics: diagnostics() };
    };

    const original = findItem(targetName);
    if (!original) {
      return fail("find", `"${escapeHtml(targetName)}" is niet gevonden in de structuurweergave. Klap de structuurweergave open zodat het element zichtbaar is en probeer het opnieuw.`);
    }

    // Waar moet de nieuwe versie komen?
    let anchorName = null;
    if (kind === "screen") {
      const sib = siblingItem(original);
      if (!sib) return fail("find", "Het laatste scherm van een app kan niet verwijderd worden. Voeg tijdelijk een leeg scherm toe en probeer het opnieuw.");
      anchorName = itemText(sib.el);
    } else {
      const parent = parentName ? findItem(parentName) : parentItem(original);
      if (!parent) return fail("find", `De container of het scherm waarin "${escapeHtml(targetName)}" staat is niet gevonden.`);
      anchorName = itemText(parent);
    }

    showToast(`"${escapeHtml(targetName)}" wordt vervangen…`, "info", 3000);

    if (!(await deleteItem(original, targetName))) {
      return fail("delete", `"${escapeHtml(targetName)}" kon niet automatisch verwijderd worden. Er is niets gewijzigd. Kies in de editor <b>Als nieuw toevoegen</b> of verwijder het origineel zelf en plak daarna.`);
    }

    const anchor = findItem(anchorName);
    if (anchor) {
      clickItem(anchor);
      await sleep(250);
    }
    const target = findItem(anchorName) || document.activeElement || document.body;
    const handled = dispatchPaste(target, yaml);

    const pasted = await waitFor(() => findItem(newName), 6000, 150);
    if (!pasted) {
      await undo();
      const restored = !!findItem(targetName);
      return fail(
        "paste",
        handled
          ? `Studio heeft de code niet geaccepteerd. ${restored ? `"${escapeHtml(targetName)}" is teruggezet.` : `Zet "${escapeHtml(targetName)}" terug met Ctrl+Z.`} Controleer de code in de editor.`
          : `Automatisch plakken werkt niet in deze versie van Studio. ${restored ? `"${escapeHtml(targetName)}" is teruggezet.` : `Zet "${escapeHtml(targetName)}" terug met Ctrl+Z.`} Kies in de editor <b>Als nieuw toevoegen</b>.`
      );
    }

    clickItem(pasted);
    await sleep(100);
    showToast(`"${escapeHtml(newName)}" is vervangen. Ongedaan maken kan met Ctrl+Z.`, "ok", 6000);
    return { ok: true, handled: true, replaced: true };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
      if (msg.mode === "replace" && msg.replace && msg.replace.targetName) {
        replaceYaml(msg.yaml, msg.replace).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
        return true;
      }
      sendResponse(pasteYaml(msg.yaml));
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
