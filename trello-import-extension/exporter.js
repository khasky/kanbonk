// Exports an open Trello board with its files as ZIP parts that Kanbonk imports together.
// Runs as a content script on trello.com, so requests carry the signed-in Trello session.
(() => {
  const defaultPartLimit = 100 * 1024 * 1024;
  const maxImageBytes = 25 * 1024 * 1024;
  const imageExtensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  };
  const encoder = new TextEncoder();

  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });

  function crc32(data) {
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index++) crc = crcTable[(crc ^ data[index]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function write(target, bytes, offset, value) {
    for (let index = 0; index < bytes; index++) target[offset + index] = (value >>> (index * 8)) & 255;
  }

  /** Stored (uncompressed) ZIP: attachments are mostly compressed already. Names are flagged as UTF-8. */
  function zip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.path);
      const checksum = crc32(entry.data);
      const local = new Uint8Array(30 + name.length);
      write(local, 4, 0, 0x04034b50);
      write(local, 2, 4, 20);
      write(local, 2, 6, 0x0800);
      write(local, 4, 14, checksum);
      write(local, 4, 18, entry.data.length);
      write(local, 4, 22, entry.data.length);
      write(local, 2, 26, name.length);
      local.set(name, 30);
      chunks.push(local, entry.data);
      const record = new Uint8Array(46 + name.length);
      write(record, 4, 0, 0x02014b50);
      write(record, 2, 4, 20);
      write(record, 2, 6, 20);
      write(record, 2, 8, 0x0800);
      write(record, 4, 16, checksum);
      write(record, 4, 20, entry.data.length);
      write(record, 4, 24, entry.data.length);
      write(record, 2, 28, name.length);
      write(record, 4, 42, offset);
      record.set(name, 46);
      central.push(record);
      offset += local.length + entry.data.length;
    }
    const directorySize = central.reduce((size, item) => size + item.length, 0);
    const end = new Uint8Array(22);
    write(end, 4, 0, 0x06054b50);
    write(end, 2, 8, entries.length);
    write(end, 2, 10, entries.length);
    write(end, 4, 12, directorySize);
    write(end, 4, 16, offset);
    return new Blob([...chunks, ...central, end], { type: "application/zip" });
  }

  const safeName = (value, fallback) =>
    String(value || fallback)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .trim()
      .slice(0, 120) || fallback;

  async function readJson(fetch, url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function readImage(fetch, value, credentials) {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Invalid URL");
    const response = await fetch(url, { credentials: credentials(url) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const extension = imageExtensions[response.headers.get("content-type")?.split(";")[0] ?? ""];
    if (!extension) throw new Error("Unknown image type");
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length || data.length > maxImageBytes) throw new Error("Invalid image size");
    return { data, extension };
  }

  /**
   * Downloads the board JSON (with the full comment history, workspace name and stickers) and every uploaded
   * file, and hands ZIP parts of about partLimit bytes to save(). A file larger than the limit gets a part of its own.
   * Every part carries kanbonk-export.json; the last one also states the number of parts and lists failed files.
   */
  async function exportBoard({
    fetch,
    shortLink,
    save,
    progress = () => {},
    signal,
    partLimit = defaultPartLimit,
    now = () => new Date(),
  }) {
    const cancelled = () => {
      if (signal?.aborted) throw new Error("Export cancelled.");
    };
    progress({ step: "board" });
    const board = await readJson(fetch, `/b/${encodeURIComponent(shortLink)}.json`);
    const warnings = [];
    if (board.idOrganization) {
      try {
        const details = await readJson(
          fetch,
          `/1/boards/${encodeURIComponent(board.id)}?fields=idOrganization&organization=true&organization_fields=displayName`,
        );
        if (details.organization?.id === board.idOrganization && details.organization.displayName)
          board.kanbonkOrganizationName = details.organization.displayName;
      } catch (error) {
        warnings.push(`Workspace name: ${String(error)}`);
      }
    }
    cancelled();
    progress({ step: "comments", count: 0 });
    try {
      const comments = [];
      let before = "";
      while (true) {
        const page = await readJson(
          fetch,
          `/1/boards/${encodeURIComponent(board.id)}/actions?filter=commentCard&limit=1000${before ? `&before=${encodeURIComponent(before)}` : ""}`,
        );
        if (!Array.isArray(page)) throw new Error("Invalid Trello response");
        comments.push(...page);
        progress({ step: "comments", count: comments.length });
        if (page.length < 1000) break;
        const last = page.at(-1)?.id;
        if (!last || last === before) throw new Error("Could not continue the comment history");
        before = last;
        cancelled();
      }
      board.kanbonkComments = comments;
      board.kanbonkCommentsComplete = true;
    } catch (error) {
      warnings.push(`Comment history is limited to the last 1000 actions: ${String(error)}`);
    }
    cancelled();
    progress({ step: "stickers" });
    try {
      const cards = await readJson(
        fetch,
        `/1/boards/${encodeURIComponent(board.id)}/cards?filter=all&fields=id&stickers=true&limit=1000`,
      );
      if (!Array.isArray(cards)) throw new Error("Invalid Trello response");
      const byId = new Map(cards.map((card) => [card.id, card.stickers]));
      for (const card of board.cards || []) {
        if (!byId.has(card.id))
          byId.set(card.id, await readJson(fetch, `/1/cards/${encodeURIComponent(card.id)}/stickers`));
        card.stickers = byId.get(card.id);
      }
    } catch (error) {
      warnings.push(`Stickers: ${String(error)}`);
    }

    const files = [];
    if (board.prefs?.backgroundImage)
      files.push({ kind: "background", label: "Board background", url: board.prefs.backgroundImage, bytes: 0 });
    for (const sticker of (board.cards || []).flatMap((card) => card.stickers || []))
      if (sticker.id && sticker.imageUrl)
        files.push({
          kind: "sticker",
          label: `Sticker ${sticker.image || sticker.id}`,
          id: sticker.id,
          url: sticker.imageUrl,
          bytes: 0,
        });
    for (const attachment of (board.cards || []).flatMap((card) => card.attachments || [])) {
      if (attachment.isUpload !== false && attachment.url)
        files.push({
          kind: "attachment",
          label: attachment.name || attachment.id,
          id: attachment.id,
          name: attachment.name,
          url: attachment.url,
          bytes: Number(attachment.bytes) || 0,
        });
    }
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);

    const exportId = `${board.id}-${now().getTime().toString(36)}`;
    const baseName = `${safeName(board.name, "Trello board")} - Kanbonk export`;
    const failures = [];
    let part = 1;
    let entries = [{ path: "board.json", data: encoder.encode(JSON.stringify(board)) }];
    let partBytes = entries[0].data.length;
    let done = 0;
    let downloadedBytes = 0;

    async function flush(last) {
      const manifest = {
        format: "kanbonk-trello-export",
        version: 1,
        exportId,
        boardId: board.id,
        boardName: board.name,
        part,
        ...(last ? { parts: part } : {}),
        createdAt: now().toISOString(),
      };
      const report =
        last && failures.length ? [{ path: "failed-files.txt", data: encoder.encode(failures.join("\n")) }] : [];
      progress({ step: "saving", part });
      await save(
        zip([
          { path: "kanbonk-export.json", data: encoder.encode(JSON.stringify(manifest, null, 2)) },
          ...entries,
          ...report,
        ]),
        `${baseName} - part ${part}${last ? " (last)" : ""}.zip`,
      );
      part++;
      entries = [];
      partBytes = 0;
    }

    for (const file of files) {
      cancelled();
      progress({ step: "files", done, total: files.length, downloadedBytes, totalBytes, part, current: file.label });
      try {
        let entry;
        if (file.kind === "attachment") {
          const url = new URL(file.url);
          if (url.protocol !== "https:" || url.hostname !== "trello.com") throw new Error("Invalid URL");
          const response = await fetch(url, { credentials: "include" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (response.headers?.get("content-type")?.startsWith("text/html"))
            throw new Error("Trello returned a page instead of the file; sign in again");
          entry = {
            path: `attachments/${file.id}/${safeName(file.name, "file")}`,
            data: new Uint8Array(await response.arrayBuffer()),
          };
        } else if (file.kind === "sticker") {
          const image = await readImage(fetch, file.url, (url) => (url.hostname === "trello.com" ? "include" : "omit"));
          entry = { path: `stickers/${file.id}/image.${image.extension}`, data: image.data };
        } else {
          const image = await readImage(fetch, file.url, () => "omit");
          entry = { path: `background/${board.id}/background.${image.extension}`, data: image.data };
        }
        if (entries.length && partBytes + entry.data.length > partLimit) await flush(false);
        entries.push(entry);
        partBytes += entry.data.length;
        downloadedBytes += entry.data.length;
      } catch (error) {
        if (signal?.aborted) throw new Error("Export cancelled.");
        failures.push(`${file.label}: ${String(error)}`);
      }
      done++;
    }
    progress({ step: "files", done, total: files.length, downloadedBytes, totalBytes, part });
    await flush(true);
    return {
      parts: part - 1,
      files: files.length - failures.length,
      total: files.length,
      failures,
      warnings,
      boardName: board.name,
    };
  }

  globalThis.kanbonkExportBoard = exportBoard;
})();
