// Localized text from _locales; falls back to the English text where chrome.i18n is unavailable (tests).
function t(key, fallback, ...values) {
  const text = globalThis.chrome?.i18n?.getMessage?.(key, values.map(String));
  return text || fallback.replace(/\$(\d)/g, (_, index) => String(values[index - 1]));
}

function allowedSender(sender) {
  try {
    const url = new URL(sender.url);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["1420", "4173"].includes(url.port)
    );
  } catch {
    return false;
  }
}

function attachmentUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "trello.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/1\/cards\/[^/]+\/attachments\/[^/]+\/download\/[^/]+/.test(url.pathname)
  )
    throw new Error(t("errorInvalidAttachmentUrl", "Invalid Trello attachment URL."));
  return url.href;
}

async function fromTrelloTab(message) {
  const tabs = await chrome.tabs.query({ url: "https://trello.com/*" });
  if (!tabs.length) throw new Error(t("errorOpenTrelloTab", "Open a Trello tab in this Chrome profile."));
  let lastError;
  for (const tab of tabs) {
    try {
      const reply = await chrome.tabs.sendMessage(tab.id, message);
      if (reply?.ok) return reply;
      lastError = reply;
    } catch (error) {
      lastError = { ok: false, error: String(error) };
    }
  }
  return lastError ?? { ok: false, error: t("errorTabNoResponse", "The Trello tab did not respond; reload it.") };
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!allowedSender(sender)) return;
  (async () => {
    if (message?.type === "probe") return fromTrelloTab({ type: "probe" });
    if (message?.type === "comments") {
      if (!/^[a-f0-9]{24}$/i.test(message.boardId ?? "") || (message.before && !/^[a-f0-9]{24}$/i.test(message.before)))
        throw new Error(t("errorInvalidHistoryId", "Invalid Trello history identifier."));
      return fromTrelloTab({ type: "comments", boardId: message.boardId, before: message.before ?? "" });
    }
    if (message?.type !== "download") throw new Error(t("errorUnknownRequest", "Unknown request."));
    if (!Number.isSafeInteger(message.offset) || message.offset < 0)
      throw new Error(t("errorInvalidOffset", "Invalid attachment offset."));
    return fromTrelloTab({ type: "download", url: attachmentUrl(message.url), offset: message.offset });
  })().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
