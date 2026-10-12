/* global CodeMirror, jsyaml, PaYaml, chrome */
(() => {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session") || "los";
  const DRAFT_KEY = `draft:${sessionId}`;

  const $ = (id) => document.getElementById(id);
  const state = {
    session: null,
    original: "",
    lastSaved: null,
    problems: [],
    outline: [],
    theme: "auto"
  };

  // ------------------------------------------------------------ CodeMirror

  CodeMirror.registerHelper("lint", "yaml", (text) => {
    const problems = PaYaml.validate(text, jsyaml);
    state.problems = problems;
    setTimeout(renderProblems, 0);
    return problems.map((p) => ({
      from: CodeMirror.Pos(p.line, p.ch),
      to: CodeMirror.Pos(p.line, p.ch + 1),
      message: p.message,
      severity: p.severity
    }));
  });

  const cm = CodeMirror($("editor"), {
    value: "",
    mode: "yaml",
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    smartIndent: true,
    lineWrapping: false,
    styleActiveLine: true,
    matchBrackets: true,
    autoCloseBrackets: { pairs: "()[]{}''\"\"", explode: "[]{}()" },
    highlightSelectionMatches: { showToken: /[\w.]/, annotateScrollbar: true },
    foldGutter: true,
    foldOptions: { rangeFinder: CodeMirror.fold.indent, widget: " … " },
    gutters: ["CodeMirror-lint-markers", "CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    lint: { delay: 300 },
    extraKeys: {
      Tab: (ed) => {
        if (ed.somethingSelected()) ed.indentSelection("add");
        else ed.replaceSelection("  ", "end");
      },
      "Shift-Tab": (ed) => ed.indentSelection("subtract"),
      "Ctrl-S": () => save(),
      "Cmd-S": () => save(),
      "Ctrl-/": "toggleComment",
      "Cmd-/": "toggleComment",
      "Ctrl-H": "replace",
      "Cmd-Alt-F": "replace",
      "Ctrl-G": "jumpToLine",
      "Cmd-G": "jumpToLine",
      "Alt-Up": (ed) => moveLines(ed, -1),
      "Alt-Down": (ed) => moveLines(ed, 1),
      "Shift-Alt-Down": (ed) => duplicateLines(ed),
      "Ctrl-K Ctrl-0": (ed) => ed.execCommand("foldAll"),
      "Ctrl-K Ctrl-J": (ed) => ed.execCommand("unfoldAll")
    }
  });

  function selectedLineRange(ed) {
    const from = ed.getCursor("from").line;
    let to = ed.getCursor("to").line;
    if (ed.somethingSelected() && ed.getCursor("to").ch === 0 && to > from) to--;
    return { from, to };
  }

  function moveLines(ed, dir) {
    const { from, to } = selectedLineRange(ed);
    if ((dir < 0 && from === 0) || (dir > 0 && to >= ed.lastLine())) return;
    const anchor = ed.getCursor("anchor");
    const head = ed.getCursor("head");
    ed.operation(() => {
      const swapLine = dir < 0 ? from - 1 : to + 1;
      const swapText = ed.getLine(swapLine);
      const block = ed.getRange(CodeMirror.Pos(from, 0), CodeMirror.Pos(to, ed.getLine(to).length));
      const start = Math.min(from, swapLine);
      const end = Math.max(to, swapLine);
      const newText = dir < 0 ? block + "\n" + swapText : swapText + "\n" + block;
      ed.replaceRange(newText, CodeMirror.Pos(start, 0), CodeMirror.Pos(end, ed.getLine(end).length));
      ed.setSelection(CodeMirror.Pos(anchor.line + dir, anchor.ch), CodeMirror.Pos(head.line + dir, head.ch));
    });
  }

  function duplicateLines(ed) {
    const { from, to } = selectedLineRange(ed);
    const block = ed.getRange(CodeMirror.Pos(from, 0), CodeMirror.Pos(to, ed.getLine(to).length));
    ed.replaceRange(block + "\n", CodeMirror.Pos(to + 1, 0));
    ed.setCursor(CodeMirror.Pos(to + 1 + (ed.getCursor().line - from), ed.getCursor().ch));
  }

  // ------------------------------------------------------------ UI helpers

  function setStatus(kind, text) {
    $("status").dataset.state = kind;
    $("statusText").textContent = text;
  }

  function showBanner(html, kind = "info", actions = []) {
    const banner = $("banner");
    banner.className = `banner banner--${kind}`;
    banner.innerHTML = `<div class="banner__text">${html}</div>`;
    const wrap = document.createElement("div");
    wrap.className = "banner__actions";
    for (const a of actions) {
      const b = document.createElement("button");
      b.className = "btn btn--small" + (a.primary ? " btn--primary" : "");
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      wrap.appendChild(b);
    }
    const close = document.createElement("button");
    close.className = "icon-btn";
    close.title = "Sluiten";
    close.textContent = "×";
    close.addEventListener("click", hideBanner);
    wrap.appendChild(close);
    banner.appendChild(wrap);
    banner.hidden = false;
  }

  function hideBanner() {
    $("banner").hidden = true;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function currentName() {
    const root = PaYaml.rootName(cm.getValue());
    return root ? root.name : "code";
  }

  function updateTitle() {
    const root = PaYaml.rootName(cm.getValue());
    const name = root ? root.name : "Nieuwe YAML";
    const type = root ? root.type : "";
    $("docTitle").textContent = name;
    const app = state.session && state.session.appTitle;
    $("docSub").textContent = [type, app].filter(Boolean).join(" · ") || "Power Apps Tools";
    document.title = `${isDirty() ? "● " : ""}${name} · YAML Editor`;
  }

  function isDirty() {
    const ref = state.lastSaved !== null ? state.lastSaved : state.original;
    return cm.getValue() !== ref;
  }

  function refreshStatus() {
    const errors = state.problems.filter((p) => p.severity === "error").length;
    if (errors) setStatus("error", `${errors} fout${errors === 1 ? "" : "en"}`);
    else if (isDirty()) setStatus("dirty", "Niet opgeslagen wijzigingen");
    else if (state.lastSaved !== null) setStatus("saved", "Opgeslagen in Studio");
    else setStatus("idle", "Ongewijzigd");
    updateTitle();
  }

  function renderProblems() {
    const errors = state.problems.filter((p) => p.severity === "error").length;
    const warnings = state.problems.length - errors;
    const el = $("problems");
    if (!state.problems.length) {
      el.textContent = "Geen problemen";
      el.className = "";
    } else {
      el.textContent = `${errors} fout${errors === 1 ? "" : "en"}, ${warnings} waarschuwing${warnings === 1 ? "" : "en"}`;
      el.className = errors ? "has-errors" : "has-warnings";
      el.title = "Klik om naar het eerste probleem te gaan";
    }
    refreshStatus();
  }

  $("problems").addEventListener("click", () => {
    const first = state.problems.slice().sort((a, b) => (a.severity === b.severity ? a.line - b.line : a.severity === "error" ? -1 : 1))[0];
    if (first) jumpTo(first.line, first.ch);
  });

  function jumpTo(line, ch = 0) {
    cm.focus();
    cm.setCursor(CodeMirror.Pos(line, ch));
    cm.scrollIntoView(CodeMirror.Pos(line, ch), 120);
  }

  // ------------------------------------------------------------ Structuur

  const TYPE_ICONS = {
    Screen: "▣", Component: "◈", GroupContainer: "▭", Group: "▭", Gallery: "▤", Form: "▦",
    Label: "T", Text: "T", Button: "▢", "Classic/Button": "▢", TextInput: "⌨", "Classic/TextInput": "⌨",
    Image: "◩", Icon: "★", "Classic/Icon": "★", Rectangle: "■", DataTable: "▥", Dropdown: "▾", ComboBox: "▾"
  };

  function renderOutline() {
    state.outline = PaYaml.outline(cm.getValue());
    const list = $("outline");
    list.innerHTML = "";
    if (!state.outline.length) {
      list.innerHTML = `<li class="outline__empty">Geen controls gevonden</li>`;
      return;
    }
    for (const item of state.outline) {
      const li = document.createElement("li");
      li.className = "outline__item";
      li.style.paddingLeft = `${10 + item.depth * 14}px`;
      li.dataset.line = item.line;
      const shortType = item.type.split("/").pop();
      const icon = TYPE_ICONS[item.type] || TYPE_ICONS[shortType] || "•";
      li.innerHTML = `<span class="outline__icon">${escapeHtml(icon)}</span><span class="outline__name">${escapeHtml(item.name)}</span><span class="outline__type">${escapeHtml(shortType)}</span>`;
      li.title = `${item.type}${item.version ? "@" + item.version : ""} · regel ${item.line + 1}`;
      li.addEventListener("click", () => jumpTo(item.line, cm.getLine(item.line).search(/\S/)));
      list.appendChild(li);
    }
    highlightOutline();
  }

  function highlightOutline() {
    const line = cm.getCursor().line;
    let active = null;
    for (const item of state.outline) {
      if (item.line <= line) active = item;
      else break;
    }
    for (const li of $("outline").children) {
      li.classList.toggle("is-active", !!active && Number(li.dataset.line) === active.line);
    }
  }

  $("btnToggleOutline").addEventListener("click", () => {
    document.body.classList.toggle("outline-collapsed");
    setTimeout(() => cm.refresh(), 200);
  });

  // ------------------------------------------------------------ Concept

  let draftTimer = null;
  let outlineTimer = null;

  cm.on("changes", () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const value = cm.getValue();
      if (value === state.original) chrome.storage.local.remove(DRAFT_KEY);
      else chrome.storage.local.set({ [DRAFT_KEY]: { yaml: value, time: Date.now() } });
    }, 500);
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(renderOutline, 250);
    refreshStatus();
    $("emptyState").hidden = true;
  });

  cm.on("cursorActivity", () => {
    const c = cm.getCursor();
    $("cursorPos").textContent = `Rg ${c.line + 1}, Kol ${c.ch + 1}`;
    highlightOutline();
  });

  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ------------------------------------------------------------ Opslaan

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Terugval voor als de pagina geen focus heeft.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  async function addHistory(yaml) {
    const { history = [] } = await chrome.storage.local.get("history");
    const root = PaYaml.rootName(yaml);
    history.unshift({
      name: root ? root.name : "code",
      type: root ? root.type : "",
      app: state.session && state.session.appTitle || "",
      yaml,
      time: Date.now()
    });
    await chrome.storage.local.set({ history: history.slice(0, 30) });
  }

  async function save(force = false) {
    const yaml = cm.getValue();
    if (!yaml.trim()) {
      showBanner("Er is geen code om op te slaan.", "warn");
      return;
    }
    const errors = state.problems.filter((p) => p.severity === "error");
    if (errors.length && !force) {
      showBanner(
        `De YAML bevat ${errors.length} fout${errors.length === 1 ? "" : "en"} (eerste op regel ${errors[0].line + 1}: ${escapeHtml(errors[0].message)}). Studio weigert ongeldige code bij het plakken.`,
        "error",
        [
          { label: "Naar fout", onClick: () => jumpTo(errors[0].line, errors[0].ch) },
          { label: "Toch opslaan", onClick: () => save(true) }
        ]
      );
      return;
    }

    const mode = $("saveMode").value;
    setStatus("busy", "Opslaan…");
    const copied = await writeClipboard(yaml);
    await addHistory(yaml);

    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "paste-to-studio", sessionId, yaml, mode });
    } catch (e) {
      res = { ok: false, error: String(e.message || e) };
    }

    if (res && res.ok) {
      state.lastSaved = yaml;
      chrome.storage.local.remove(DRAFT_KEY);
      refreshStatus();
      const name = escapeHtml(currentName());
      if (res.handled) {
        showBanner(
          mode === "replace"
            ? `<b>${name}</b> is in Studio geplakt. Verwijder in Studio het originele element en geef de nieuwe versie (met _1) de oorspronkelijke naam.`
            : `<b>${name}</b> is in Studio toegevoegd.`,
          "ok"
        );
      } else {
        showBanner(
          `De code staat op het klembord en het Studio tabblad is geopend. Selecteer daar het doel in de structuurweergave en druk op <b>Ctrl+V</b>.` +
          (mode === "replace" ? " Verwijder daarna het origineel en hernoem de nieuwe versie." : ""),
          "info"
        );
      }
    } else {
      setStatus("error", "Opslaan mislukt");
      showBanner(
        `${escapeHtml(res && res.error || "Opslaan in Studio is mislukt.")}${copied ? " De code staat wel op het klembord, dus je kunt hem in Studio met Ctrl+V plakken." : ""}`,
        "error"
      );
    }
  }

  $("btnSave").addEventListener("click", () => save());

  chrome.storage.local.get({ saveMode: "replace" }, ({ saveMode }) => { $("saveMode").value = saveMode; });
  $("saveMode").addEventListener("change", () => chrome.storage.local.set({ saveMode: $("saveMode").value }));

  // ------------------------------------------------------------ Overige acties

  $("btnCopy").addEventListener("click", async () => {
    const ok = await writeClipboard(cm.getValue());
    showBanner(ok ? "De YAML is gekopieerd naar het klembord." : "Kopiëren is mislukt.", ok ? "ok" : "error");
    setTimeout(hideBanner, 2500);
  });

  $("btnDownload").addEventListener("click", () => {
    const blob = new Blob([cm.getValue()], { type: "text/yaml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${PaYaml.safeFileName(currentName())}.pa.yaml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("btnOpenFile").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (isDirty() && !confirm("De huidige wijzigingen worden vervangen door het bestand. Doorgaan?")) return;
    cm.setValue(text);
    e.target.value = "";
  });

  $("btnRevert").addEventListener("click", () => {
    if (!state.original) return;
    if (cm.getValue() !== state.original && !confirm("Alle wijzigingen terugdraaien naar de code uit Studio?")) return;
    cm.setValue(state.original);
    chrome.storage.local.remove(DRAFT_KEY);
  });

  $("btnHistory").addEventListener("click", async () => {
    const { history = [] } = await chrome.storage.local.get("history");
    const list = $("historyList");
    list.innerHTML = "";
    if (!history.length) list.innerHTML = `<li class="muted">Nog geen opgeslagen versies.</li>`;
    history.forEach((h) => {
      const li = document.createElement("li");
      const when = new Date(h.time).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
      li.innerHTML = `<div><b>${escapeHtml(h.name)}</b> <span class="muted">${escapeHtml(h.type || "")}</span><div class="muted">${escapeHtml(h.app || "")} · ${when}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "btn btn--small";
      btn.type = "button";
      btn.textContent = "Laden";
      btn.addEventListener("click", () => {
        if (isDirty() && !confirm("De huidige wijzigingen worden vervangen. Doorgaan?")) return;
        cm.setValue(h.yaml);
        $("historyDialog").close();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    $("historyDialog").showModal();
  });

  $("btnClearHistory").addEventListener("click", async () => {
    if (!confirm("Alle opgeslagen versies wissen?")) return;
    await chrome.storage.local.remove("history");
    $("historyList").innerHTML = `<li class="muted">Nog geen opgeslagen versies.</li>`;
  });

  // ------------------------------------------------------------ Thema

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  function applyTheme() {
    const dark = state.theme === "dark" || (state.theme === "auto" && darkQuery.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    cm.setOption("theme", dark ? "material-darker" : "default");
    $("btnTheme").title = `Thema: ${{ auto: "automatisch", light: "licht", dark: "donker" }[state.theme]}`;
  }
  darkQuery.addEventListener("change", applyTheme);
  $("btnTheme").addEventListener("click", () => {
    state.theme = { auto: "light", light: "dark", dark: "auto" }[state.theme];
    chrome.storage.local.set({ theme: state.theme });
    applyTheme();
  });

  // ------------------------------------------------------------ Laden

  async function readClipboard() {
    try {
      return await navigator.clipboard.readText();
    } catch (e) {
      return null;
    }
  }

  function loadYaml(yaml) {
    state.original = yaml;
    cm.setValue(yaml);
    cm.clearHistory();
    cm.setCursor(0, 0);
    $("emptyState").hidden = !!yaml;
    renderOutline();
    refreshStatus();
    cm.focus();
  }

  $("btnReadClipboard").addEventListener("click", async () => {
    const text = await readClipboard();
    if (text && text.trim()) {
      loadYaml(text);
      if (!PaYaml.looksLikePowerAppsYaml(text)) showBanner("De inhoud van het klembord lijkt geen Power Apps YAML te zijn.", "warn");
    } else {
      showBanner("Het klembord is leeg of kan niet worden gelezen. Plak de code met Ctrl+V in de editor.", "warn");
      $("emptyState").hidden = true;
      cm.focus();
    }
  });

  $("btnStartEmpty").addEventListener("click", () => {
    $("emptyState").hidden = true;
    cm.focus();
  });

  async function init() {
    const { theme = "auto" } = await chrome.storage.local.get("theme");
    state.theme = theme;
    applyTheme();

    const res = await chrome.runtime.sendMessage({ type: "get-session", sessionId }).catch(() => null);
    state.session = res && res.session;

    let yaml = state.session && state.session.yaml;
    let fromClipboard = false;
    if (!yaml && state.session && state.session.via === "clipboard") {
      const text = await readClipboard();
      if (text && PaYaml.looksLikePowerAppsYaml(text)) {
        yaml = text;
        fromClipboard = true;
      }
    }

    loadYaml(yaml || "");
    if (!yaml) $("emptyState").hidden = false;

    const draftData = await chrome.storage.local.get(DRAFT_KEY);
    const draft = draftData[DRAFT_KEY];
    if (draft && draft.yaml && draft.yaml !== state.original) {
      cm.setValue(draft.yaml);
      $("emptyState").hidden = true;
      showBanner("Niet opgeslagen wijzigingen van je vorige sessie zijn hersteld.", "info", [
        { label: "Origineel tonen", onClick: () => { cm.setValue(state.original); hideBanner(); } }
      ]);
    } else if (fromClipboard) {
      showBanner("De code is van het klembord gelezen omdat de selectie in Studio niet direct uitgelezen kon worden. Controleer of dit het juiste element is.", "warn");
    } else if (state.session && state.session.via === "recent") {
      showBanner("Dit is de code die je het laatst in Studio hebt gekopieerd. Controleer of dit het juiste element is.", "warn");
    }

    if (!state.session && sessionId !== "los") {
      showBanner("Deze editorsessie is verlopen. Opslaan gaat naar het meest recente Power Apps Studio tabblad.", "warn");
    }

    refreshStatus();
    setTimeout(() => cm.refresh(), 50);
  }

  init();
})();
