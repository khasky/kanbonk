// Run in the browser console while viewing a Trello board.
(async () => {
  if (location.hostname !== "trello.com") throw new Error("Open a board page on trello.com.");
  const boardId = location.pathname.match(/^\/b\/([^/]+)/)?.[1];
  if (!boardId) throw new Error("Open a Trello board page.");

  const response = await fetch(`/b/${encodeURIComponent(boardId)}.json`, { credentials: "include" });
  if (!response.ok) throw new Error(`Could not fetch the board JSON: HTTP ${response.status}`);
  const board = await response.json();
  if (board.idOrganization) {
    try {
      const details = await fetch(`/1/boards/${encodeURIComponent(board.id)}?fields=idOrganization&organization=true&organization_fields=displayName`, { credentials: "include" });
      if (!details.ok) throw new Error(`HTTP ${details.status}`);
      const organization = (await details.json()).organization;
      if (organization?.id === board.idOrganization && organization.displayName) board.listvaOrganizationName = organization.displayName;
    } catch (error) {
      console.warn(`Kanbonk: could not fetch the Trello workspace name: ${String(error)}`);
    }
  }
  try {
    const comments = [];
    let before = "";
    while (true) {
      const url = `/1/boards/${encodeURIComponent(board.id)}/actions?filter=commentCard&limit=1000${before ? `&before=${encodeURIComponent(before)}` : ""}`;
      const page = await fetch(url, { credentials: "include" });
      if (!page.ok) throw new Error(`HTTP ${page.status}`);
      const actions = await page.json();
      if (!Array.isArray(actions)) throw new Error("Invalid Trello response");
      comments.push(...actions);
      if (actions.length < 1000) break;
      const lastId = actions.at(-1)?.id;
      if (!lastId || lastId === before) throw new Error("Could not continue exporting comments");
      before = lastId;
    }
    board.listvaComments = comments;
    board.listvaCommentsComplete = true;
  } catch (error) {
    console.warn(`Kanbonk: comment history is limited to the JSON export: ${String(error)}`);
  }
  try {
    const response = await fetch(`/1/boards/${encodeURIComponent(board.id)}/cards?filter=all&fields=id&stickers=true&limit=1000`, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cards = await response.json();
    if (!Array.isArray(cards)) throw new Error("Invalid Trello response");
    const byId = new Map(cards.map((card) => [card.id, card.stickers]));
    for (const card of board.cards || []) {
      if (!byId.has(card.id)) {
        const item = await fetch(`/1/cards/${encodeURIComponent(card.id)}/stickers`, { credentials: "include" });
        if (!item.ok) throw new Error(`Stickers of card ${card.id}: HTTP ${item.status}`);
        byId.set(card.id, await item.json());
      }
      card.stickers = byId.get(card.id);
    }
  } catch (error) {
    console.warn(`Kanbonk: could not fetch Trello stickers: ${String(error)}`);
  }
  const attachments = (board.cards || []).flatMap((card) => (card.attachments || []).filter((item) => item.isUpload !== false && item.url));
  const stickers = (board.cards || []).flatMap((card) => card.stickers || []).filter((item) => item.id && item.imageUrl);
  const encoder = new TextEncoder();
  const files = [{ path: "board.json", data: encoder.encode(JSON.stringify(board)) }];
  const failures = [];
  let batch = 1;
  let downloaded = 0;
  let batchBytes = files[0].data.length;

  function append(number, bytes, offset, value) {
    for (let index = 0; index < bytes; index++) number[offset + index] = (value >>> (index * 8)) & 255;
  }

  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let index = 0; index < 8; index++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.path);
      const checksum = crc32(entry.data);
      const local = new Uint8Array(30 + name.length);
      append(local, 4, 0, 0x04034b50);
      append(local, 2, 4, 20);
      append(local, 4, 14, checksum);
      append(local, 4, 18, entry.data.length);
      append(local, 4, 22, entry.data.length);
      append(local, 2, 26, name.length);
      local.set(name, 30);
      chunks.push(local, entry.data);
      const record = new Uint8Array(46 + name.length);
      append(record, 4, 0, 0x02014b50);
      append(record, 2, 4, 20);
      append(record, 2, 6, 20);
      append(record, 4, 16, checksum);
      append(record, 4, 20, entry.data.length);
      append(record, 4, 24, entry.data.length);
      append(record, 2, 28, name.length);
      append(record, 4, 42, offset);
      record.set(name, 46);
      central.push(record);
      offset += local.length + entry.data.length;
    }
    const directorySize = central.reduce((size, item) => size + item.length, 0);
    const end = new Uint8Array(22);
    append(end, 4, 0, 0x06054b50);
    append(end, 2, 8, entries.length);
    append(end, 2, 10, entries.length);
    append(end, 4, 12, directorySize);
    append(end, 4, 16, offset);
    return new Blob([...chunks, ...central, end], { type: "application/zip" });
  }

  function saveBatch() {
    if (!files.length) return;
    const url = URL.createObjectURL(zip(files));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(board.name || "trello-board").replace(/[\\/:*?"<>|]/g, "_")}-${batch}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    console.info(`Kanbonk: ZIP ${batch}, ${files.length} files.`);
    batch++;
    files.length = 0;
    batchBytes = 0;
  }

  if (board.prefs?.backgroundImage) {
    try {
      const url = new URL(board.prefs.backgroundImage);
      if (url.protocol !== "https:") throw new Error("Invalid URL");
      const image = await fetch(url, { credentials: "omit" });
      if (!image.ok) throw new Error(`HTTP ${image.status}`);
      const type = image.headers.get("content-type")?.split(";")[0] ?? "";
      const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };
      if (!extensions[type]) throw new Error(`Unknown image type: ${type}`);
      const data = new Uint8Array(await image.arrayBuffer());
      if (!data.length || data.length > 25 * 1024 * 1024) throw new Error("Invalid background image size");
      files.push({ path: `background/${board.id}/background.${extensions[type]}`, data });
      batchBytes += data.length;
    } catch (error) {
      console.warn(`Kanbonk: could not fetch the board background: ${String(error)}`);
    }
  }

  for (const sticker of stickers) {
    try {
      const url = new URL(sticker.imageUrl);
      if (url.protocol !== "https:") throw new Error("Invalid URL");
      const media = await fetch(url, { credentials: url.hostname === "trello.com" ? "include" : "omit" });
      if (!media.ok) throw new Error(`HTTP ${media.status}`);
      const type = media.headers.get("content-type")?.split(";")[0] ?? "";
      const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
      if (!extensions[type]) throw new Error(`Unknown image type: ${type}`);
      const data = new Uint8Array(await media.arrayBuffer());
      if (!data.length || data.length > 25 * 1024 * 1024) throw new Error("Invalid sticker size");
      files.push({ path: `stickers/${sticker.id}/image.${extensions[type]}`, data });
      batchBytes += data.length;
      if (files.length >= 21 || batchBytes >= 100 * 1024 * 1024) saveBatch();
    } catch (error) {
      failures.push(`Sticker ${sticker.id}: ${String(error)}`);
    }
  }

  for (const attachment of attachments) {
    try {
      const url = new URL(attachment.url);
      if (url.protocol !== "https:" || url.hostname !== "trello.com") throw new Error("Invalid URL");
      const media = await fetch(url, { credentials: "include" });
      if (!media.ok) throw new Error(`HTTP ${media.status}`);
      const data = new Uint8Array(await media.arrayBuffer());
      const name = String(attachment.name || "file").replace(/[\\/:*?"<>|]/g, "_");
      files.push({ path: `attachments/${attachment.id}/${name}`, data });
      batchBytes += data.length;
      downloaded++;
      if (files.length >= 21 || batchBytes >= 100 * 1024 * 1024) saveBatch();
    } catch (error) {
      failures.push(`${attachment.id}: ${String(error)}`);
    }
  }
  if (failures.length) files.push({ path: "failed-attachments.txt", data: encoder.encode(failures.join("\n")) });
  saveBatch();
  console.info(`Kanbonk: downloaded ${downloaded} of ${attachments.length} attachments; ${stickers.length} stickers. Errors: ${failures.length}.`);
})();
