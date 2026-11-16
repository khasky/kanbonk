const extensionId = "cnmanboceimmaaghiefjagbfaajfgcmh";

interface BridgeReply {
  ok: boolean;
  status?: number;
  data?: string;
  mimeType?: string;
  offset?: number;
  total?: number;
  actions?: unknown[];
  complete?: boolean;
  nextBefore?: string;
  error?: string;
}

interface ChromeRuntime {
  lastError?: { message: string };
  sendMessage: (id: string, message: unknown, callback: (reply?: BridgeReply) => void) => void;
}

function runtime(): ChromeRuntime | undefined {
  return (globalThis as typeof globalThis & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

function request(message: unknown): Promise<BridgeReply> {
  const bridge = runtime();
  if (!bridge) return Promise.reject(new Error("The Kanbonk Trello Import extension is not installed."));
  return new Promise((resolve, reject) => {
    bridge.sendMessage(extensionId, message, (reply) => {
      if (bridge.lastError) reject(new Error(bridge.lastError.message));
      else if (!reply) reject(new Error("The extension did not respond."));
      else resolve(reply);
    });
  });
}

export async function trelloBridgeAvailable(): Promise<boolean> {
  try { return (await request({ type: "probe" })).ok; }
  catch { return false; }
}

export async function downloadTrelloComments(boardId: string): Promise<unknown[]> {
  const actions: unknown[] = [];
  let before = "";
  while (true) {
    const reply = await request({ type: "comments", boardId, before });
    if (!reply.ok || !Array.isArray(reply.actions) || reply.actions.length > 1000) throw new Error(reply.error ?? "The extension could not fetch comments.");
    actions.push(...reply.actions);
    if (reply.complete === true) return actions;
    if (reply.actions.length !== 1000 || !reply.nextBefore || reply.nextBefore === before) throw new Error("Could not continue exporting Trello comments.");
    before = reply.nextBefore;
  }
}

export async function downloadTrelloAttachment(url: string): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  let total: number | undefined;
  let mimeType = "application/octet-stream";
  do {
    const reply = await request({ type: "download", url, offset });
    if (!reply.ok || !reply.data) throw new Error(reply.error ?? "The extension could not fetch the attachment.");
    const binary = atob(reply.data);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (!Number.isSafeInteger(reply.total) || !reply.total || reply.offset !== offset || offset + bytes.length > reply.total || (total !== undefined && reply.total !== total) || !bytes.length) throw new Error("Received an invalid chunk of a Trello attachment.");
    total = reply.total;
    mimeType = reply.mimeType || mimeType;
    parts.push(bytes);
    offset += bytes.length;
  } while (offset < total);
  return new Blob(parts, { type: mimeType });
}
