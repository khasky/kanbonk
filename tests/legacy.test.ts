import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { migrateLegacyState, migrateLegacyStorage } from "../src/model/legacy";
import { ensureInbox, inboxBoardId, inboxListId, inboxWorkspaceId } from "../src/model/inbox";
import { emptyState, recordRevision, type AppState } from "../src/model";
import { mergeStates } from "../src/sync/sync";
import { openSyncBundle } from "../src/sync/devices";
import { createBackupParts, restoreBackup } from "../src/backup/backup";
import { parseTrelloBoard } from "../src/trello/import";

/** A state with an inbox card, as written by the app before the rename. */
function legacyState(): AppState {
  let state = ensureInbox(emptyState(), "device-a");
  state = recordRevision(
    {
      ...state,
      cards: [
        {
          id: "card-1",
          boardId: inboxBoardId,
          listId: inboxListId,
          name: "Note",
          description: "",
          position: 1,
          labelIds: [],
          checklists: [],
          comments: [],
          attachments: [],
        },
      ],
    },
    "card",
    "card-1",
    "device-a",
  );
  state.tombstones = {
    "board:kanbonk-personal-workspace-board": "2026-01-01",
    "workspace:kanbonk-personal-workspace": "2026-01-01",
  };
  return JSON.parse(JSON.stringify(state).replaceAll("kanbonk-", "listva-")) as AppState;
}

describe("legacy state", () => {
  it("renames inbox and personal workspace IDs in entities, revisions, heads and tombstones", () => {
    const migrated = migrateLegacyState(legacyState());
    expect(JSON.stringify(migrated)).not.toContain("listva-inbox");
    expect(migrated.cards[0]).toMatchObject({ boardId: inboxBoardId, listId: inboxListId });
    expect(migrated.boards[0].workspaceId).toBe(inboxWorkspaceId);
    expect(migrated.revisions.map((item) => item.entityId)).toEqual([
      inboxWorkspaceId,
      inboxBoardId,
      inboxListId,
      "card-1",
    ]);
    expect(migrated.heads[`board:${inboxBoardId}`]).toBeDefined();
    expect(migrated.tombstones).toEqual({
      "board:listva-personal-workspace-board": "2026-01-01",
      "workspace:kanbonk-personal-workspace": "2026-01-01",
    });
  });

  it("leaves a current state untouched", () => {
    const state = ensureInbox(emptyState(), "device-a");
    expect(migrateLegacyState(state)).toBe(state);
  });

  it("merges a legacy remote state into a migrated one without a second inbox", () => {
    const local = migrateLegacyState(legacyState());
    const merged = mergeStates(local, legacyState());
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.boards.map((item) => item.id)).toEqual([inboxBoardId]);
    expect(merged.state.lists.map((item) => item.id)).toEqual([inboxListId]);
    expect(ensureInbox(merged.state, "device-a")).toBe(merged.state);
  });
});

describe("legacy local storage", () => {
  function memoryStorage(entries: Record<string, string>): Storage {
    const values = new Map(Object.entries(entries));
    return {
      get length() {
        return values.size;
      },
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
      clear: () => values.clear(),
    };
  }

  it("moves listva-* keys to kanbonk-* and renames IDs inside values", () => {
    const storage = memoryStorage({
      "listva-device-id": "0f8e-device",
      "listva-board-filters": JSON.stringify({ "listva-inbox": { keyword: "x" }, "board-1": { keyword: "y" } }),
      "listva-author-name": "Old name",
      "kanbonk-author-name": "New name",
      "other-key": "kept",
    });
    migrateLegacyStorage(storage);
    expect(storage.getItem("kanbonk-device-id")).toBe("0f8e-device");
    expect(JSON.parse(storage.getItem("kanbonk-board-filters")!)).toEqual({
      "kanbonk-inbox": { keyword: "x" },
      "board-1": { keyword: "y" },
    });
    expect(storage.getItem("kanbonk-author-name")).toBe("New name");
    expect(storage.getItem("other-key")).toBe("kept");
    expect(storage.length).toBe(4);
  });
});

describe("legacy files", () => {
  it("opens a sync bundle made before the rename and renames its IDs on merge", async () => {
    const code = "ab".repeat(16);
    const plain = zipSync({
      "state.json": strToU8(JSON.stringify(legacyState())),
      "sender.json": strToU8(JSON.stringify({ deviceId: "pc", name: "PC" })),
    });
    const nonce = new Uint8Array(24).fill(7);
    const sealed = xchacha20poly1305(sha256(strToU8(`listva-key:${code}`)), nonce).encrypt(plain);
    const opened = await openSyncBundle(new Uint8Array([...strToU8("LISTVA-SYNC-1"), ...nonce, ...sealed]), [code]);
    expect(opened.sender?.name).toBe("PC");
    expect(mergeStates(emptyState(), opened.state).state.cards[0].boardId).toBe(inboxBoardId);
  });

  it("restores a backup made before the rename", async () => {
    const parts = [];
    for await (const part of createBackupParts(legacyState(), async () => undefined)) parts.push(part);
    const entries = unzipSync(new Uint8Array(await parts[0].blob.arrayBuffer()));
    const manifest = JSON.parse(strFromU8(entries["kanbonk-backup.json"]));
    delete entries["kanbonk-backup.json"];
    entries["listva-backup.json"] = strToU8(JSON.stringify({ ...manifest, format: "listva-backup" }));
    const restored = await restoreBackup(
      [new File([new Uint8Array(zipSync(entries))], parts[0].name)],
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.state.cards[0]).toMatchObject({ boardId: inboxBoardId, listId: inboxListId });
  });

  it("reads Trello exports saved by the helper before the rename", () => {
    const comment = {
      id: "a1",
      type: "commentCard",
      date: "2020-01-01T00:00:00.000Z",
      data: { card: { id: "c1" }, text: "Old comment" },
      memberCreator: { fullName: "Author" },
    };
    const source = {
      id: "b1",
      name: "Board",
      idOrganization: "org",
      listvaOrganizationName: "Team",
      lists: [{ id: "l1", name: "List" }],
      cards: [{ id: "c1", name: "Card", idList: "l1" }],
      actions: [],
      listvaCommentsComplete: true,
      listvaComments: [comment],
    };
    const result = parseTrelloBoard(source, "personal");
    expect(result.organization?.name).toBe("Team");
    expect(result.cards[0].comments.map((item) => item.text)).toEqual(["Old comment"]);
  });
});

describe("archive removal", () => {
  /** A state as earlier versions stored it, with `archived` flags and an "archive" automation rule. */
  function archivedState(): AppState {
    return {
      ...emptyState(),
      workspaces: [{ id: "w", name: "Work" }],
      boards: [
        {
          id: "b",
          workspaceId: "w",
          name: "Board",
          description: "",
          background: "#fff",
          starred: false,
          automationRules: [{ id: "r", listId: "l", action: "archive" }],
        },
      ],
      lists: [
        { id: "l", boardId: "b", name: "Open", position: 1, archived: false },
        { id: "old", boardId: "b", name: "Old", position: 2, archived: true },
      ],
      cards: [
        {
          id: "kept",
          boardId: "b",
          listId: "l",
          name: "Kept",
          description: "",
          position: 1,
          labelIds: [],
          checklists: [],
          comments: [],
          attachments: [],
        },
        {
          id: "gone",
          boardId: "b",
          listId: "l",
          name: "Gone",
          description: "",
          position: 2,
          labelIds: [],
          checklists: [],
          comments: [],
          attachments: [],
          archived: true,
        },
        {
          id: "both",
          boardId: "b",
          listId: "l",
          name: "Both",
          description: "",
          position: 3,
          labelIds: [],
          checklists: [],
          comments: [],
          attachments: [],
          archived: true,
          deletedAt: "2026-01-01T00:00:00.000Z",
          deletedBatch: "earlier",
        },
      ],
    } as unknown as AppState;
  }

  it("moves archived items into the trash, drops the flag and turns archive rules into trash rules", () => {
    const migrated = migrateLegacyState(archivedState());
    const now = migrated.lists.find((item) => item.id === "old")?.deletedAt;
    expect(now).toBeTruthy();
    expect(migrated.lists.find((item) => item.id === "old")).toMatchObject({ deletedBatch: "archived-old" });
    expect(migrated.cards.find((item) => item.id === "gone")).toMatchObject({
      deletedAt: now,
      deletedBatch: "archived-gone",
    });
    expect(migrated.cards.find((item) => item.id === "both")).toMatchObject({
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBatch: "earlier",
    });
    expect(migrated.cards.find((item) => item.id === "kept")?.deletedAt).toBeUndefined();
    expect([...migrated.lists, ...migrated.cards].some((item) => "archived" in item)).toBe(false);
    expect(migrated.boards[0].automationRules?.[0].action).toBe("trash");
    expect(migrated.revisions).toEqual([]);
    const clean = migrateLegacyState(emptyState());
    expect(migrateLegacyState(clean)).toBe(clean);
  });

  it("migrates archived items arriving from a device or backup on an earlier version", () => {
    const { state } = mergeStates(emptyState(), archivedState());
    expect(state.cards.find((item) => item.id === "gone")?.deletedAt).toBeTruthy();
    expect(state.lists.find((item) => item.id === "old")?.deletedAt).toBeTruthy();
  });
});
