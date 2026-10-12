// Service worker: koppelt editortabbladen aan het Power Apps Studio tabblad
// waar de YAML vandaan kwam, zodat "Opslaan" weer in dat tabblad terechtkomt.

const STUDIO_URL_PATTERNS = [
  "https://make.powerapps.com/*",
  "https://make.preview.powerapps.com/*",
  "https://*.create.powerapps.com/*"
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

async function openEditorTab({ yaml, via, appTitle, tabId, frameId }) {
  const id = newId();
  await saveSession(id, { yaml, via, appTitle, tabId, frameId, created: Date.now() });

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

// Na installeren of bijwerken van de extensie hebben al geopende Studio
// tabbladen nog geen content scripts. Die injecteren we dan alsnog.
async function injectContentScripts(tabId) {
  const target = { tabId, allFrames: true };
  await chrome.scripting.insertCSS({ target, files: ["src/content/studio.css"] }).catch(() => {});
  await chrome.scripting.executeScript({ target, files: ["src/content/page-bridge.js"], world: "MAIN" }).catch(() => {});
  await chrome.scripting.executeScript({ target, files: ["src/content/studio.js"] });
}

async function triggerOpenInTab(tab) {
  if (!tab || typeof tab.id !== "number") return { ok: false, error: "no-tab" };
  const message = { type: "trigger-open-editor" };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return { ok: true };
  } catch (e) {
    try {
      await injectContentScripts(tab.id);
      await chrome.tabs.sendMessage(tab.id, message);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: "not-studio" };
    }
  }
}

async function pasteToStudio({ sessionId, yaml, mode }) {
  const sessions = await getSessions();
  const session = sessions[sessionId] || {};

  let tabId = session.tabId;
  let tab = null;
  if (typeof tabId === "number") {
    try { tab = await chrome.tabs.get(tabId); } catch (e) { tab = null; }
  }
  if (!tab) {
    tab = await findStudioTab();
    if (!tab) return { ok: false, error: "Er is geen geopend Power Apps Studio tabblad gevonden." };
    await saveSession(sessionId, { tabId: tab.id, frameId: undefined });
  }

  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });

  const message = { type: "paste-yaml", yaml, mode };
  try {
    if (typeof session.frameId === "number" && tab.id === session.tabId) {
      return await chrome.tabs.sendMessage(tab.id, message, { frameId: session.frameId });
    }
  } catch (e) { /* frame is herladen, probeer alle frames */ }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, message);
    if (res) return res;
  } catch (e) { /* hieronder opnieuw proberen */ }

  try {
    await injectContentScripts(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, message);
    if (res) return res;
    throw new Error("geen antwoord");
  } catch (e) {
    return { ok: false, error: "Power Apps Studio reageert niet. Vernieuw het Studio tabblad en probeer het opnieuw. De YAML staat op het klembord." };
  }
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
            tabId: sender.tab ? sender.tab.id : undefined,
            frameId: sender.frameId
          })
        };
      case "open-empty-editor":
        return { ok: true, id: await openEditorTab({ yaml: msg.yaml || null, via: msg.via || "empty", appTitle: null }) };
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

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-editor") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await triggerOpenInTab(tab);
});
