function base64(bytes) {
  let encoded = "";
  for (let offset = 0; offset < bytes.length; offset += 32768)
    encoded += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(encoded);
}

const chunkSize = 1024 * 1024;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "probe") {
      const response = await fetch("/1/member/me", { credentials: "include" });
      return { ok: response.ok, status: response.status };
    }
    if (message?.type === "comments") {
      const suffix = message.before ? `&before=${message.before}` : "";
      const response = await fetch(`/1/boards/${message.boardId}/actions?filter=commentCard&limit=1000${suffix}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`Trello HTTP ${response.status}`);
      const actions = await response.json();
      if (!Array.isArray(actions) || actions.length > 1000) throw new Error("Invalid Trello comment history.");
      return {
        ok: true,
        actions,
        complete: actions.length < 1000,
        nextBefore: actions.length === 1000 ? actions.at(-1)?.id : undefined,
      };
    }
    if (message?.type !== "download") throw new Error("Unknown request.");
    const offset = message.offset;
    const response = await fetch(message.url, {
      credentials: "include",
      headers: { Range: `bytes=${offset}-${offset + chunkSize - 1}` },
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (mimeType === "text/html")
      throw new Error("Trello returned a page instead of the attachment; sign in to your account.");
    if (response.status === 200 && offset === 0) {
      const limit = 12 * 1024 * 1024;
      if (Number(response.headers.get("content-length")) > limit)
        throw new Error("Trello does not support partial download of a large attachment. Use a ZIP.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > limit)
        throw new Error("Trello does not support partial download of a large attachment. Use a ZIP.");
      return { ok: true, data: base64(bytes), mimeType, offset, total: bytes.length };
    }
    if (response.status !== 206)
      throw new Error(`Trello does not support partial download: HTTP ${response.status}. Use a ZIP.`);
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
    if (!range) throw new Error("Trello did not report the size of the attachment chunk.");
    const [, start, end, total] = range.map(Number);
    if (start !== offset || end < start || end >= total || end - start + 1 > chunkSize)
      throw new Error("Trello returned an invalid attachment range.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== end - start + 1) throw new Error("Trello returned an incomplete attachment chunk.");
    return { ok: true, data: base64(bytes), mimeType, offset, total };
  })().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
