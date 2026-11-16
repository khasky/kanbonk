// Toolbar button: focus an open Kanbonk tab or open a new one.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");
  const [tab] = await chrome.tabs.query({ url: `${url}*` });
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  } else await chrome.tabs.create({ url });
});
