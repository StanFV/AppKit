// Service worker: koppelt editortabbladen aan het Power Apps Studio tabblad
// waar de YAML vandaan kwam, zodat "Opslaan" weer in dat tabblad terechtkomt.

const STUDIO_URL_PATTERNS = [
  "https://*.powerapps.com/*",
  "https://*.powerplatformusercontent.com/*"
];

async function getSessions() {
  const { sessions = {} } = await chrome.storage.session.get("sessions");
  return sessions;
}

async function saveSession(id, data) {
  const sessions = await getSessions();
  sessions[id] = { ...(sessions[id] || {}), ...data };
  // Oude sessies (ouder dan 24 uur) opruimen.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, value] of Object.entries(sessions)) {
    if (value.created < cutoff) delete sessions[key];
  }
  await chrome.storage.session.set({ sessions });
  return sessions[id];
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function openEditorTab({ yaml, via, appTitle, tabId, frameId, selection }) {
  const id = newId();
  await saveSession(id, { yaml, via, appTitle, tabId, frameId, selection: selection || null, created: Date.now() });

  const createProps = { url: chrome.runtime.getURL(`editor/editor.html?session=${id}`) };
  if (typeof tabId === "number") {
    try {
      const sourceTab = await chrome.tabs.get(tabId);
      createProps.index = sourceTab.index + 1;
      createProps.windowId = sourceTab.windowId;
      createProps.openerTabId = tabId;
    } catch (e) { /* tabblad bestaat niet meer */ }
  }
  await chrome.tabs.create(createProps);
  return id;
}

async function findStudioTab() {
  const tabs = await chrome.tabs.query({ url: STUDIO_URL_PATTERNS });
  if (!tabs.length) return null;
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return tabs[0];
}

// Wordt in elk frame van het tabblad uitgevoerd om het Studio-frame te vinden.
function probeFrame() {
  return {
    url: location.href,
    tree: !!document.querySelector("[role='tree'], [role='treegrid']"),
    monaco: !!document.querySelector(".monaco-editor"),
    area: window.innerWidth * window.innerHeight,
    loaded: !!(window.__paToolsStudioAlive && window.__paToolsStudioAlive())
  };
}

async function listFrameHosts(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const hosts = new Set();
    for (const f of frames || []) {
      try { hosts.add(new URL(f.url).hostname); } catch (e) { /* about:blank e.d. */ }
    }
    return [...hosts].filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Zoekt het frame met Power Apps Studio. Studio draait afhankelijk van regio
// en versie op verschillende domeinen, vaak in een iframe. We herkennen het
// aan de structuurweergave (of een geopend codevenster) en niet aan het adres.
async function findStudioFrame(tabId, preferredFrameId) {
  let results = [];
  try {
    results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: probeFrame });
  } catch (e) {
    results = [];
  }
  const frames = results.filter((r) => r && r.result);
  if (typeof preferredFrameId === "number") {
    const preferred = frames.find((r) => r.frameId === preferredFrameId && (r.result.tree || r.result.monaco));
    if (preferred) return preferred;
  }
  const score = (r) => (r.result.tree ? 2 : 0) + (r.result.monaco ? 1 : 0);
  frames.sort((a, b) => score(b) - score(a) || b.result.area - a.result.area);
  const best = frames[0];
  return best && score(best) > 0 ? best : null;
}

// Na installeren of bijwerken van de extensie hebben al geopende Studio
// tabbladen nog geen content scripts. Die injecteren we dan alsnog.
async function ensureContentScripts(tabId, frame) {
  if (frame.result.loaded) return;
  const target = { tabId, frameIds: [frame.frameId] };
  await chrome.scripting.insertCSS({ target, files: ["src/content/studio.css"] }).catch(() => {});
  await chrome.scripting.executeScript({ target, files: ["src/content/page-bridge.js"], world: "MAIN" }).catch(() => {});
  await chrome.scripting.executeScript({ target, files: ["src/content/studio.js"] });
}

async function notFoundError(tabId) {
  const hosts = await listFrameHosts(tabId);
  return "Power Apps Studio is niet gevonden in dit tabblad. Open de app in bewerkmodus en zorg dat de structuurweergave (Tree view) zichtbaar is." +
    (hosts.length ? ` Gevonden domeinen: ${hosts.join(", ")}.` : "");
}

async function sendToStudio(tabId, message, preferredFrameId) {
  const frame = await findStudioFrame(tabId, preferredFrameId);
  if (!frame) return { ok: false, error: await notFoundError(tabId) };
  try {
    await ensureContentScripts(tabId, frame);
    const res = await chrome.tabs.sendMessage(tabId, message, { frameId: frame.frameId });
    return { ...(res || { ok: false, error: "Studio gaf geen antwoord." }), frameId: frame.frameId };
  } catch (e) {
    return { ok: false, error: "Studio reageert niet. Vernieuw het Studio tabblad en probeer het opnieuw." };
  }
}

async function triggerOpenInTab(tab) {
  if (!tab || typeof tab.id !== "number") return { ok: false, error: "Geen actief tabblad gevonden." };
  return sendToStudio(tab.id, { type: "trigger-open-editor" });
}

async function pasteToStudio({ sessionId, yaml, mode, replace }) {
  const sessions = await getSessions();
  const session = sessions[sessionId] || {};

  let tab = null;
  if (typeof session.tabId === "number") {
    try { tab = await chrome.tabs.get(session.tabId); } catch (e) { tab = null; }
  }
  if (!tab) {
    tab = await findStudioTab();
    if (!tab) return { ok: false, error: "Er is geen geopend Power Apps Studio tabblad gevonden. De YAML staat op het klembord." };
  }

  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });

  const preferred = tab.id === session.tabId ? session.frameId : undefined;
  const res = await sendToStudio(tab.id, { type: "paste-yaml", yaml, mode, replace }, preferred);
  if (res.ok) await saveSession(sessionId, { tabId: tab.id, frameId: res.frameId });
  else res.error += " De YAML staat op het klembord.";
  return res;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case "open-editor":
        return {
          ok: true,
          id: await openEditorTab({
            yaml: msg.yaml,
            via: msg.via,
            appTitle: msg.appTitle,
            selection: msg.selection,
            tabId: sender.tab ? sender.tab.id : undefined,
            frameId: sender.frameId
          })
        };
      case "open-from-active-tab": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return triggerOpenInTab(tab);
      }
      case "get-session": {
        const sessions = await getSessions();
        return { ok: true, session: sessions[msg.sessionId] || null };
      }
      case "update-session":
        await saveSession(msg.sessionId, msg.data || {});
        return { ok: true };
      case "paste-to-studio":
        return pasteToStudio(msg);
      default:
        return undefined;
    }
  })().then(sendResponse, (err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
  return true;
});

// Het extensie-icoon is alleen klikbaar op Power Apps-pagina's. Op andere
// sites blijft het grijs.
function isPowerAppsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)(powerapps\.com|powerplatformusercontent\.com)$/i.test(u.hostname);
  } catch (e) {
    return false;
  }
}

async function updateAction(tabId, url) {
  try {
    if (isPowerAppsUrl(url)) await chrome.action.enable(tabId);
    else await chrome.action.disable(tabId);
  } catch (e) { /* tabblad bestaat niet meer */ }
}

async function syncAllTabs() {
  await chrome.action.disable();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => updateAction(t.id, t.url || t.pendingUrl || "")));
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === "loading") updateAction(tabId, info.url || tab.url || "");
});
// Na installeren of bijwerken de scripts direct in open Power Apps-tabbladen
// zetten. Anders blijft daar de knop van de oude versie staan, die niet meer
// werkt, tot de gebruiker de pagina vernieuwt.
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: STUDIO_URL_PATTERNS });
  for (const tab of tabs) {
    const target = { tabId: tab.id, allFrames: true };
    try {
      await chrome.scripting.insertCSS({ target, files: ["src/content/studio.css"] });
      await chrome.scripting.executeScript({ target, files: ["src/content/page-bridge.js"], world: "MAIN" });
      await chrome.scripting.executeScript({ target, files: ["src/content/studio.js"] });
    } catch (e) { /* tabblad niet toegankelijk */ }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  syncAllTabs();
  injectIntoOpenTabs();
});
chrome.runtime.onStartup.addListener(syncAllTabs);
syncAllTabs();

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-editor") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await triggerOpenInTab(tab);
});
