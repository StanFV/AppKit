// Draait in de MAIN world van Power Apps Studio. Heeft toegang tot globals van
// de pagina (zoals Monaco en de klembord-API's) die de content script in de
// isolated world niet ziet. Communiceert via window.postMessage.
(() => {
  if (window.__paToolsBridge) return;
  window.__paToolsBridge = true;

  const TAG = "pa-tools";

  function looksLikePowerAppsYaml(text) {
    if (!text || typeof text !== "string") return false;
    return /^\s*(-\s+)?['"]?[^\s:]+['"]?:\s*\r?\n\s+(Control|Properties|Children|Variant|ComponentName):/m.test(text) ||
      /^\s*(Screens|ComponentDefinitions):\s*$/m.test(text);
  }

  function emitCaptured(text, via) {
    if (!looksLikePowerAppsYaml(text)) return;
    window.postMessage({ tag: TAG, direction: "to-content", type: "captured", yaml: text, via }, "*");
  }

  // Studio schrijft de YAML naar het klembord bij "Code kopiëren" en Ctrl+C.
  // Door deze twee API's te observeren vangen we de code op, ongeacht welke
  // route Studio gebruikt.
  try {
    const originalSetData = DataTransfer.prototype.setData;
    DataTransfer.prototype.setData = function (format, data) {
      try {
        if (/^text\/plain$|^text$/i.test(format)) emitCaptured(data, "setData");
      } catch (e) { /* negeren */ }
      return originalSetData.apply(this, arguments);
    };
  } catch (e) { /* negeren */ }

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = function (text) {
        try { emitCaptured(text, "writeText"); } catch (e) { /* negeren */ }
        return originalWriteText(text);
      };
    }
    if (navigator.clipboard && typeof navigator.clipboard.write === "function" && typeof ClipboardItem !== "undefined") {
      const originalWrite = navigator.clipboard.write.bind(navigator.clipboard);
      navigator.clipboard.write = function (items) {
        try {
          for (const item of items || []) {
            if (item.types && item.types.includes("text/plain")) {
              item.getType("text/plain").then((blob) => blob.text()).then((t) => emitCaptured(t, "write")).catch(() => {});
            }
          }
        } catch (e) { /* negeren */ }
        return originalWrite(items);
      };
    }
  } catch (e) { /* negeren */ }

  function readMonacoYaml() {
    const monaco = window.monaco;
    if (!monaco || !monaco.editor || typeof monaco.editor.getModels !== "function") return null;

    // Voorkeur: een zichtbare editor (het venster "Code weergeven").
    const editors = typeof monaco.editor.getEditors === "function" ? monaco.editor.getEditors() : [];
    for (const ed of editors) {
      const node = ed.getDomNode && ed.getDomNode();
      if (node && node.offsetParent !== null) {
        const value = ed.getValue();
        if (looksLikePowerAppsYaml(value)) return value;
      }
    }
    return null;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.tag !== TAG || data.direction !== "to-page") return;

    if (data.type === "read-monaco") {
      let yaml = null;
      try { yaml = readMonacoYaml(); } catch (e) { yaml = null; }
      window.postMessage({ tag: TAG, direction: "to-content", type: "monaco-result", id: data.id, yaml }, "*");
    }
  });
})();
