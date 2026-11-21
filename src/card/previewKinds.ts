export type PreviewKind = "image" | "pdf" | "markdown" | "text" | "video" | "audio";

const byExtension: Record<string, PreviewKind> = {
  ...Object.fromEntries(
    ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"].map((ext) => [ext, "image" as const]),
  ),
  pdf: "pdf",
  md: "markdown",
  markdown: "markdown",
  ...Object.fromEntries(
    [
      "txt",
      "log",
      "csv",
      "tsv",
      "json",
      "jsonl",
      "xml",
      "yaml",
      "yml",
      "toml",
      "ini",
      "cfg",
      "conf",
      "env",
      "html",
      "htm",
      "css",
      "scss",
      "js",
      "mjs",
      "cjs",
      "jsx",
      "ts",
      "tsx",
      "py",
      "rb",
      "php",
      "java",
      "kt",
      "go",
      "rs",
      "c",
      "h",
      "cpp",
      "hpp",
      "cs",
      "swift",
      "sh",
      "bash",
      "ps1",
      "bat",
      "sql",
      "lua",
      "diff",
      "patch",
      "srt",
      "vtt",
      "rtf",
    ].map((ext) => [ext, "text" as const]),
  ),
  ...Object.fromEntries(["mp4", "webm", "ogv", "mov"].map((ext) => [ext, "video" as const])),
  ...Object.fromEntries(
    ["mp3", "wav", "ogg", "oga", "m4a", "flac", "aac", "opus"].map((ext) => [ext, "audio" as const]),
  ),
};

const textTypes = /^(text\/|application\/(json|xml|x-yaml|yaml|toml|javascript|x-sh|sql|x-ndjson)\b)/;

/**
 * How an attachment can be shown in the preview dialog, judged by its type and, since Trello and some browsers store
 * files as application/octet-stream, by its file extension. Undefined when the browser cannot show it.
 */
export function previewKind(name: string, mimeType: string): PreviewKind | undefined {
  const type = mimeType.toLowerCase();
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (type === "text/markdown" || type === "text/x-markdown" || byExtension[extension] === "markdown")
    return "markdown";
  if (type === "application/pdf") return "pdf";
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(type)) return "image";
  if (/^video\/(mp4|webm|ogg|quicktime)$/.test(type)) return "video";
  if (/^audio\//.test(type)) return "audio";
  if (textTypes.test(type)) return "text";
  return byExtension[extension];
}

/** The MIME type the browser needs to render a preview, for blobs stored as application/octet-stream. */
export function previewMimeType(kind: PreviewKind, name: string, mimeType: string): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image" && /\.svg$/i.test(name)) return "image/svg+xml";
  return mimeType || "application/octet-stream";
}
