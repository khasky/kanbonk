import type { AppState } from "./types";

const idAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const issuedIds = new Set<string>();

/** Registers ids already present locally so newId never repeats them. */
export function rememberIds(ids: Iterable<string>): void {
  for (const id of ids) issuedIds.add(id);
}

export function rememberStateIds(state: AppState): void {
  for (const collection of [state.workspaces, state.boards, state.lists, state.cards, state.labels, state.revisions])
    rememberIds(collection.map((item) => item.id));
}

/** Trello-like short id: URL-safe base62, unbiased (rejection sampling), unique among ids known to this device. */
export function newId(length = 8): string {
  for (;;) {
    let id = "";
    while (id.length < length) {
      for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
        if (byte < 248 && id.length < length) id += idAlphabet[byte % 62];
      }
    }
    if (!issuedIds.has(id)) {
      issuedIds.add(id);
      return id;
    }
  }
}

export function isShortId(value: string): boolean {
  return /^[0-9A-Za-z]{8}$/.test(value);
}
