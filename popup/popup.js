/* global chrome */
const STUDIO_RE = /^https:\/\/([^/]+\.)?(powerapps\.com|powerplatformusercontent\.com)\//i;

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const inStudio = tab && STUDIO_RE.test(tab.url || "");
  const btnOpen = document.getElementById("btnOpen");
  const hint = document.getElementById("hint");

  if (!inStudio) {
    btnOpen.disabled = true;
    hint.textContent = "Open een canvas app in Power Apps Studio om de selectie te bewerken.";
    hint.classList.add("is-warn");
  }

  btnOpen.addEventListener("click", async () => {
    btnOpen.disabled = true;
    hint.classList.remove("is-warn");
    hint.textContent = "Studio zoeken…";
    const res = await chrome.runtime.sendMessage({ type: "open-from-active-tab" });
    if (res && res.ok) {
      window.close();
    } else {
      hint.textContent = (res && res.error) || "Studio reageert niet. Vernieuw het Studio tabblad en probeer het opnieuw.";
      hint.classList.add("is-warn");
      btnOpen.disabled = false;
    }
  });

  const chk = document.getElementById("chkFab");
  const { fabHidden = false } = await chrome.storage.local.get("fabHidden");
  chk.checked = !fabHidden;
  chk.addEventListener("change", () => chrome.storage.local.set({ fabHidden: !chk.checked }));
})();
