// Hulpfuncties voor Power Apps YAML: structuur bepalen en valideren.
// Wordt gebruikt in de editor (browser) en in de tests (Node).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PaYaml = api;
})(typeof self !== "undefined" ? self : this, function () {
  const KEY_RE = /^(\s*)(-\s+)?(?:'((?:[^']|'')*)'|"((?:[^"\\]|\\.)*)"|([^\s#'"\-][^:#]*?|-[^\s:#][^:#]*?)):(?:\s+|$)/;

  function parseKeyLine(line) {
    if (/^\s*(#|$)/.test(line)) return null;
    const m = KEY_RE.exec(line);
    if (!m) return null;
    const indent = m[1].length + (m[2] ? m[2].length : 0);
    const name = m[3] !== undefined ? m[3].replace(/''/g, "'") : m[4] !== undefined ? m[4] : m[5].trim();
    let rest = line.slice(m[0].length);
    rest = stripComment(rest).trim();
    return { indent, name, rest, listItem: !!m[2] };
  }

  function stripComment(value) {
    // Een # na een spatie is commentaar, tenzij binnen quotes.
    let quote = null;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === "'" || c === '"') {
        if (i === 0 || /\s/.test(value[i - 1])) quote = c;
      } else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
        return value.slice(0, i);
      }
    }
    return value;
  }

  function indentOf(line) {
    const m = /^(\s*)(-\s+)?/.exec(line);
    return m[1].length + (m[2] ? m[2].length : 0);
  }

  /**
   * Bepaalt schermen, componenten en controls in de YAML.
   * @returns {{name:string,type:string,version:string,line:number,depth:number}[]}
   */
  function outline(text) {
    const lines = String(text || "").split(/\r?\n/);
    const stack = [];
    const items = [];

    for (let i = 0; i < lines.length; i++) {
      const key = parseKeyLine(lines[i]);
      if (!key) continue;
      while (stack.length && stack[stack.length - 1].indent >= key.indent) stack.pop();
      const parent = stack[stack.length - 1];

      if (key.name === "Control" && key.rest && parent && !parent.item) {
        const [type, version = ""] = key.rest.replace(/^['"]|['"]$/g, "").split("@");
        parent.item = { name: parent.name, type, version, line: parent.line, depth: depthOf(stack) - 1 };
        items.push(parent.item);
        continue;
      }

      if (key.rest === "" || /^[|>]/.test(key.rest)) {
        const entry = { indent: key.indent, name: key.name, line: i, item: null };
        if (parent && !parent.item && stack.length === 1 && (parent.name === "Screens" || parent.name === "ComponentDefinitions")) {
          entry.item = {
            name: key.name,
            type: parent.name === "Screens" ? "Screen" : "Component",
            version: "",
            line: i,
            depth: 0
          };
          items.push(entry.item);
        }
        stack.push(entry);
      }
    }

    items.sort((a, b) => a.line - b.line);
    return items;
  }

  function depthOf(stack) {
    return stack.filter((s) => s.item).length + 1;
  }

  /**
   * Valideert YAML syntax en een aantal Power Apps regels.
   * @returns {{severity:'error'|'warning', message:string, line:number, ch:number}[]}
   */
  function validate(text, jsyaml) {
    const problems = [];
    const source = String(text || "");
    if (!source.trim()) return problems;

    if (/\t/.test(source)) {
      source.split(/\r?\n/).forEach((l, idx) => {
        const m = /^[ ]*\t/.exec(l);
        if (m) problems.push({ severity: "error", message: "Tabs zijn niet toegestaan voor inspringen in YAML. Gebruik spaties.", line: idx, ch: m[0].length - 1 });
      });
    }

    if (jsyaml) {
      try {
        jsyaml.load(source);
      } catch (e) {
        const mark = e.mark || { line: 0, column: 0 };
        problems.push({ severity: "error", message: (e.reason || e.message || "Ongeldige YAML").replace(/\s+/g, " "), line: mark.line, ch: mark.column });
      }
    }

    problems.push(...checkProperties(source));
    problems.push(...checkDuplicates(source));
    return problems;
  }

  function checkProperties(source) {
    const lines = source.split(/\r?\n/);
    const problems = [];
    let propsIndent = -1;
    let childIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(#|$)/.test(line)) continue;
      const ind = indentOf(line);

      if (propsIndent >= 0 && ind <= propsIndent) {
        propsIndent = -1;
        childIndent = -1;
      }

      const key = parseKeyLine(line);

      if (propsIndent >= 0) {
        if (childIndent < 0) childIndent = ind;
        if (ind !== childIndent || !key) continue;

        const value = key.rest;
        if (value === "") {
          problems.push({ severity: "warning", message: `Eigenschap "${key.name}" heeft geen waarde. Gebruik bijvoorbeeld =""`, line: i, ch: ind });
        } else if (/^[|>]/.test(value)) {
          let j = i + 1;
          while (j < lines.length && /^\s*$/.test(lines[j])) j++;
          if (j < lines.length && indentOf(lines[j]) > ind && !lines[j].trim().startsWith("=")) {
            problems.push({ severity: "warning", message: `Formule van "${key.name}" moet beginnen met =`, line: j, ch: indentOf(lines[j]) });
          }
        } else {
          const unquoted = value.replace(/^(['"])([\s\S]*)\1$/, "$2");
          if (!unquoted.startsWith("=")) {
            problems.push({ severity: "warning", message: `Formule van "${key.name}" moet beginnen met = (bijvoorbeeld ="${unquoted.replace(/"/g, '""')}")`, line: i, ch: line.indexOf(value) });
          }
        }
        continue;
      }

      if (key && key.name === "Properties" && key.rest === "") {
        propsIndent = ind;
        childIndent = -1;
      }
    }
    return problems;
  }

  function checkDuplicates(source) {
    const seen = new Map();
    const problems = [];
    for (const item of outline(source)) {
      if (seen.has(item.name)) {
        problems.push({ severity: "warning", message: `De naam "${item.name}" komt meerdere keren voor. Studio hernoemt dubbele namen bij het plakken.`, line: item.line, ch: 0 });
      } else {
        seen.set(item.name, item.line);
      }
    }
    return problems;
  }

  function looksLikePowerAppsYaml(text) {
    if (!text || typeof text !== "string") return false;
    return /^\s*(-\s+)?['"]?[^\s:]+['"]?:\s*\r?\n\s+(Control|Properties|Children|Variant|ComponentName):/m.test(text) ||
      /^\s*(Screens|ComponentDefinitions):\s*$/m.test(text);
  }

  function rootName(text) {
    const items = outline(text);
    return items.length ? items[0] : null;
  }

  function safeFileName(name) {
    return String(name || "code").replace(/[\\/:*?"<>|]+/g, "_").trim() || "code";
  }

  return { outline, validate, looksLikePowerAppsYaml, rootName, safeFileName, parseKeyLine };
});
