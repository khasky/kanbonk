// Floating panel on Trello board pages: exports the open board for Kanbonk and shows the progress.
(() => {
  const styles = `
    :host { all: initial; }
    .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px; box-sizing: border-box; padding: 12px 14px; border-radius: 10px;
      background: #ffffff; color: #172b4d; box-shadow: 0 8px 24px rgba(9, 30, 66, .25); font: 14px/1.4 -apple-system, "Segoe UI", Roboto, sans-serif; }
    .panel.collapsed { width: auto; padding: 8px 12px; }
    header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    header span { flex: 1; }
    button { font: inherit; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; background: #e9ecef; color: #172b4d; }
    button.primary { background: #0c66e4; color: #ffffff; }
    button:disabled { opacity: .6; cursor: default; }
    header button { padding: 2px 8px; background: transparent; }
    .body { margin-top: 8px; display: grid; gap: 8px; }
    .collapsed .body { display: none; }
    .status { white-space: pre-line; }
    .hint { color: #626f86; font-size: 12px; }
    progress { width: 100%; height: 8px; }
    details { font-size: 12px; max-height: 160px; overflow: auto; }
    .error { color: #ae2e24; }
  `;

  // Localized text from _locales; falls back to the English text where chrome.i18n is unavailable.
  function t(key, fallback, ...values) {
    const text = globalThis.chrome?.i18n?.getMessage?.(key, values.map(String));
    return text || fallback.replace(/\$(\d)/g, (_, index) => String(values[index - 1]));
  }
  const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
  const megabytes = (bytes) => {
    const digits = bytes < 10 * 1024 * 1024 ? 1 : 0;
    const size = (bytes / 1024 / 1024).toLocaleString(globalThis.chrome?.i18n?.getUILanguage?.() || "en", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    });
    return t("sizeMegabytes", "$1 MB", size);
  };
  const boardLink = () => location.pathname.match(/^\/b\/([^/]+)/)?.[1];

  let host;
  let parts;
  let controller;

  function render() {
    host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${styles}</style>
      <section class="panel" role="region" aria-label="${escapeHtml(t("panelTitle", "Kanbonk export"))}">
        <header><span>${escapeHtml(t("panelTitle", "Kanbonk export"))}</span><button class="toggle" title="${escapeHtml(t("panelCollapse", "Collapse"))}">–</button></header>
        <div class="body">
          <div class="status">${escapeHtml(t("panelIntro", "Export this board with all its files for Kanbonk."))}</div>
          <progress hidden max="1" value="0"></progress>
          <div class="hint">${escapeHtml(t("panelHint", "ZIP parts of about 100 MB go to your downloads folder. If the browser asks, allow this site to download multiple files."))}</div>
          <details hidden><summary></summary><ul></ul></details>
          <div><button class="primary start">${escapeHtml(t("exportBoard", "Export board"))}</button> <button class="cancel" hidden>${escapeHtml(t("exportCancel", "Cancel"))}</button></div>
        </div>
      </section>`;
    parts = {
      panel: root.querySelector(".panel"),
      status: root.querySelector(".status"),
      progress: root.querySelector("progress"),
      details: root.querySelector("details"),
      start: root.querySelector(".start"),
      cancel: root.querySelector(".cancel"),
      toggle: root.querySelector(".toggle"),
    };
    parts.toggle.addEventListener("click", () => {
      const collapsed = parts.panel.classList.toggle("collapsed");
      parts.toggle.textContent = collapsed ? "+" : "–";
      parts.toggle.title = collapsed ? t("panelExpand", "Expand") : t("panelCollapse", "Collapse");
    });
    parts.start.addEventListener("click", start);
    parts.cancel.addEventListener("click", () => controller?.abort());
    document.documentElement.append(host);
  }

  function show(state) {
    if (state.step === "board") parts.status.textContent = t("progressBoard", "Reading the board…");
    else if (state.step === "comments")
      parts.status.textContent = t("progressComments", "Reading comments… $1", state.count);
    else if (state.step === "stickers") parts.status.textContent = t("progressStickers", "Reading stickers…");
    else if (state.step === "saving") parts.status.textContent = t("progressSaving", "Saving part $1…", state.part);
    else if (state.step === "files") {
      parts.progress.hidden = false;
      parts.progress.max = Math.max(1, state.total);
      parts.progress.value = state.done;
      const size = state.totalBytes
        ? t("sizeOfTotal", "$1 of $2", megabytes(state.downloadedBytes), megabytes(state.totalBytes))
        : megabytes(state.downloadedBytes);
      parts.status.textContent =
        t("progressFiles", "Files $1 of $2 · $3\nPart $4", state.done, state.total, size, state.part) +
        (state.current ? ` · ${state.current}` : "");
    }
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.documentElement.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    // Gives the browser time to start the download before the next part is built.
    return new Promise((resolve) => setTimeout(resolve, 800));
  }

  function list(title, items) {
    parts.details.hidden = !items.length;
    parts.details.querySelector("summary").textContent = title;
    parts.details
      .querySelector("ul")
      .replaceChildren(...items.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  }

  async function start() {
    const shortLink = boardLink();
    if (!shortLink) return;
    controller = new AbortController();
    parts.start.disabled = true;
    parts.cancel.hidden = false;
    parts.status.classList.remove("error");
    parts.progress.hidden = true;
    list("", []);
    window.addEventListener("beforeunload", warnOnLeave);
    try {
      const result = await globalThis.kanbonkExportBoard({
        fetch: (...args) => fetch(...args),
        shortLink,
        save,
        progress: show,
        signal: controller.signal,
      });
      parts.status.textContent =
        result.parts === 1
          ? t(
              "doneOnePart",
              "Done: $1 part, $2 of $3 files.\nIn Kanbonk open ⋯ → Import from Trello and choose all the parts at once.",
              result.parts,
              result.files,
              result.total,
            )
          : t(
              "doneManyParts",
              "Done: $1 parts, $2 of $3 files.\nIn Kanbonk open ⋯ → Import from Trello and choose all the parts at once.",
              result.parts,
              result.files,
              result.total,
            );
      list(t("notExported", "Not exported: $1", result.failures.length + result.warnings.length), [
        ...result.failures,
        ...result.warnings,
      ]);
    } catch (error) {
      parts.status.textContent = String(error?.message ?? error);
      parts.status.classList.add("error");
    } finally {
      window.removeEventListener("beforeunload", warnOnLeave);
      parts.start.disabled = false;
      parts.start.textContent = t("exportAgain", "Export again");
      parts.cancel.hidden = true;
      controller = undefined;
    }
  }

  function warnOnLeave(event) {
    event.preventDefault();
  }

  // Trello is a single-page app: the panel follows navigation between boards and other pages.
  function sync() {
    const onBoard = Boolean(boardLink());
    if (onBoard && !host) render();
    if (host) host.hidden = !onBoard && !controller;
  }
  sync();
  setInterval(sync, 1000);
})();
