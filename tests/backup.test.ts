import { describe, expect, it, vi } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createBackupParts, restoreBackup } from "../src/backup/backup";
import { deleteLabel, emptyState, linkDependency, recordRevision, type AppState } from "../src/model";
import { relatedCards } from "../src/model/links";
import { mergeStates } from "../src/sync/sync";
import { applyDueRules } from "../src/model/automation";

function example(): AppState {
  return {
    ...emptyState(),
    workspaces: [{ id: "workspace-1", name: "Personal", sourceTrelloId: "trello-workspace" }],
    boards: [
      {
        id: "board-1",
        workspaceId: "workspace-1",
        name: "Board",
        description: "",
        background: "#147d86",
        backgroundImageId: "background-1",
        starred: false,
        automationRules: [
          { id: "rule-1", listId: "list-1", action: "trash" },
          { id: "button-1", listId: "", trigger: "button", name: "Discard", action: "trash" },
        ],
      },
    ],
    lists: [{ id: "list-1", boardId: "board-1", name: "Tasks", position: 1 }],
    cards: [
      {
        id: "card-1",
        boardId: "board-1",
        listId: "list-1",
        name: "Media",
        description: "",
        position: 1,
        labelIds: [],
        dueAt: "2026-12-01T09:00:00.000Z",
        checklists: [],
        comments: [],
        stickers: ["⭐"],
        attachments: [{ id: "attachment-1", name: "note.txt", mimeType: "text/plain", size: 5, status: "local" }],
      },
    ],
  };
}

async function partsFor(state: AppState, source: Map<string, Blob>) {
  const parts = [];
  for await (const part of createBackupParts(state, async (id) => source.get(id), 5))
    parts.push(new File([part.blob], part.name));
  return parts;
}

describe("Kanbonk backup", () => {
  it("preserves comment ownership in a restored backup", async () => {
    const state = example();
    state.cards[0].comments = [
      {
        id: "comment-1",
        text: "Done",
        author: "Anna",
        authorDeviceId: "device-a",
        createdAt: "2026-11-15T10:00:00.000Z",
      },
    ];
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["background"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const restored = await restoreBackup(
      await partsFor(state, source),
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.state.cards[0].comments).toEqual(state.cards[0].comments);
  });

  it("restores a due rule and its fired occurrence without replaying it", async () => {
    const state = example();
    state.labels = [{ id: "label-1", boardId: "board-1", name: "Due", color: "red" }];
    state.boards[0].automationRules!.push({
      id: "due-1",
      listId: "",
      trigger: "due",
      createdAt: "2026-11-15T09:00:00.000Z",
      leadMinutes: 60,
      action: "add-label",
      labelId: "label-1",
    });
    const fired = applyDueRules(state, Date.parse("2026-12-01T09:00:01.000Z"), "device-1");
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["background"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const restored = await restoreBackup(
      await partsFor(fired, source),
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.state.boards[0].automationRules).toContainEqual(state.boards[0].automationRules![2]);
    expect(restored.state.cards[0]).toMatchObject({
      labelIds: ["label-1"],
      automationRunKeys: ["due-1:2026-12-01T09:00:00.000Z"],
    });
    expect(applyDueRules(restored.state, Date.parse("2026-12-01T09:00:02.000Z"), "device-2")).toBe(restored.state);
  });

  it("includes a custom sticker image in the backup", async () => {
    const state = example();
    state.cards[0].stickers = ["⭐", { imageId: "sticker-1", name: "custom.png" }];
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["background"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
      ["sticker-1", new Blob(["sticker"], { type: "image/png" })],
    ]);
    const parts = await partsFor(state, source);
    const target = new Map<string, Blob>();
    const restored = await restoreBackup(
      parts,
      emptyState(),
      async (id) => target.get(id),
      async (id, blob) => {
        target.set(id, blob);
      },
    );
    expect(restored.state.cards[0].stickers).toEqual(state.cards[0].stickers);
    expect(await target.get("sticker-1")?.text()).toBe("sticker");
  });

  it("backs up a Trello card even when its sticker image is missing", async () => {
    const state = example();
    state.cards[0].stickers = [
      { imageId: "sticker-1", name: "check", sourceTrelloId: "trello-sticker", status: "missing" },
    ];
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["background"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const parts = await partsFor(state, source);
    const restored = await restoreBackup(
      parts,
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.unavailable).toBe(1);
    expect(restored.state.cards[0].stickers).toEqual(state.cards[0].stickers);
  });

  it("keeps label deletion in a backup", async () => {
    const label = { id: "label-1", boardId: "board-1", name: "Label", color: "#f00" };
    const state = recordRevision({ ...emptyState(), labels: [label] }, "label", label.id, "device-1");
    const deleted = deleteLabel(state, label.id, "device-1");
    const parts = await partsFor(deleted, new Map());
    const restored = await restoreBackup(
      parts,
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.state.labels[0].deleted).toBe(true);
    expect(restored.conflicts).toHaveLength(0);
  });

  it("restores all ZIP parts, board background and card attachment into existing state", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const parts = await partsFor(example(), source);
    expect(parts).toHaveLength(2);
    const target = new Map<string, Blob>();
    const current = { ...emptyState(), workspaces: [{ id: "existing", name: "Existing" }] };
    const restored = await restoreBackup(
      parts.reverse(),
      current,
      async (id) => target.get(id),
      async (id, blob) => {
        target.set(id, blob);
      },
    );
    expect(restored.state.workspaces.map((item) => item.id)).toEqual(["existing", "workspace-1"]);
    expect(restored.state.workspaces[1].sourceTrelloId).toBe("trello-workspace");
    expect(restored.state.cards[0].attachments[0].status).toBe("local");
    expect(restored.state.cards[0].stickers).toEqual(["⭐"]);
    expect(restored.state.boards[0].backgroundImageId).toBe("background-1");
    expect(restored.state.boards[0].automationRules).toEqual(example().boards[0].automationRules);
    expect(restored.conflicts).toHaveLength(0);
    expect(await target.get("background-1")?.text()).toBe("image");
    expect(await target.get("attachment-1")?.text()).toBe("hello");
  });

  it("drops card completion from a backup made by an earlier version", async () => {
    const legacy = example() as unknown as {
      boards: Array<{ automationRules: Array<Record<string, unknown>> }>;
      cards: Array<Record<string, unknown>>;
    };
    legacy.boards[0].automationRules.push({ id: "old", listId: "list-1", action: "complete" });
    legacy.cards[0].completed = true;
    legacy.cards[0].dueRepeat = { cadence: "monthly", anchor: "2026-12-01" };
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const restored = await restoreBackup(
      await partsFor(legacy as unknown as AppState, source),
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(restored.state.boards[0].automationRules).toEqual(example().boards[0].automationRules);
    expect(restored.state.cards[0]).not.toHaveProperty("completed");
    expect(restored.state.cards[0]).not.toHaveProperty("dueRepeat");
  });

  it("rejects missing ZIP parts without writing any files", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"])],
      ["attachment-1", new Blob(["hello"])],
    ]);
    const parts = await partsFor(example(), source);
    const target = new Map<string, Blob>();
    await expect(
      restoreBackup(
        parts.slice(0, 1),
        emptyState(),
        async (id) => target.get(id),
        async (id, blob) => {
          target.set(id, blob);
        },
      ),
    ).rejects.toThrow("Not all parts");
    expect(target.size).toBe(0);
  });

  it("rejects an existing file with the same ID and different contents", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"])],
      ["attachment-1", new Blob(["hello"])],
    ]);
    const parts = await partsFor(example(), source);
    const target = new Map<string, Blob>([["attachment-1", new Blob(["different"])]]);
    await expect(
      restoreBackup(
        parts,
        emptyState(),
        async (id) => target.get(id),
        async (id, blob) => {
          target.set(id, blob);
        },
      ),
    ).rejects.toThrow("different content");
    expect(target.size).toBe(1);
    expect(target.has("background-1")).toBe(false);
  });

  it("rejects a changed file of the same size before writing any restored files", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"])],
      ["attachment-1", new Blob(["hello"])],
    ]);
    const parts = await partsFor(example(), source);
    const entries = unzipSync(new Uint8Array(await parts[1].arrayBuffer()));
    entries["files/attachment-1"] = strToU8("HELLO");
    parts[1] = new File([new Uint8Array(zipSync(entries))], parts[1].name);
    const write = vi.fn(async () => {});

    await expect(restoreBackup(parts, emptyState(), async () => undefined, write)).rejects.toThrow(
      "The checksum of file attachment-1",
    );
    expect(write).not.toHaveBeenCalled();
  });

  it("stops export if a file changes without changing size between ZIP parts", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"])],
      ["attachment-1", new Blob(["hello"])],
    ]);
    const iterator = createBackupParts(example(), async (id) => source.get(id), 5);
    expect((await iterator.next()).value?.index).toBe(1);
    source.set("attachment-1", new Blob(["HELLO"]));

    await expect(iterator.next()).rejects.toThrow("File attachment-1 changed during export");
  });

  it("still restores backups created before file hashes were added", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"])],
      ["attachment-1", new Blob(["hello"])],
    ]);
    const parts = await partsFor(example(), source);
    const entries = unzipSync(new Uint8Array(await parts[0].arrayBuffer()));
    const manifest = JSON.parse(strFromU8(entries["kanbonk-backup.json"]));
    manifest.version = 1;
    for (const file of manifest.files) delete file.hash;
    entries["kanbonk-backup.json"] = strToU8(JSON.stringify(manifest));
    parts[0] = new File([new Uint8Array(zipSync(entries))], parts[0].name);
    const restored = new Map<string, Blob>();

    const result = await restoreBackup(
      parts,
      emptyState(),
      async (id) => restored.get(id),
      async (id, blob) => {
        restored.set(id, blob);
      },
    );
    expect(result.files).toBe(2);
    expect(await restored.get("attachment-1")?.text()).toBe("hello");
  });

  it("restores and verifies files without Web Crypto on a local-network HTTP page", async () => {
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const parts = await partsFor(example(), source);
    const target = new Map<string, Blob>();
    vi.stubGlobal("crypto", {});
    try {
      const restored = await restoreBackup(
        parts,
        emptyState(),
        async (id) => target.get(id),
        async (id, blob) => {
          target.set(id, blob);
        },
      );
      expect(restored.files).toBe(2);
      expect(await target.get("attachment-1")?.text()).toBe("hello");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("includes media referenced only by a saved revision", async () => {
    const prior = example();
    const state: AppState = {
      ...prior,
      boards: [{ ...prior.boards[0], backgroundImageId: undefined }],
      cards: [{ ...prior.cards[0], attachments: [] }],
      revisions: [
        {
          id: "revision-board",
          entityKind: "board",
          entityId: "board-1",
          createdAt: "2026-01-01",
          deviceId: "device-1",
          snapshot: prior.boards[0],
        },
        {
          id: "revision-card",
          entityKind: "card",
          entityId: "card-1",
          createdAt: "2026-01-01",
          deviceId: "device-1",
          snapshot: prior.cards[0],
        },
      ],
    };
    const source = new Map<string, Blob>([
      ["background-1", new Blob(["image"], { type: "image/png" })],
      ["attachment-1", new Blob(["hello"], { type: "text/plain" })],
    ]);
    const parts = await partsFor(state, source);
    const target = new Map<string, Blob>();
    const restored = await restoreBackup(
      parts,
      emptyState(),
      async (id) => target.get(id),
      async (id, blob) => {
        target.set(id, blob);
      },
    );
    expect(restored.files).toBe(2);
    expect(await target.get("background-1")?.text()).toBe("image");
    expect(await target.get("attachment-1")?.text()).toBe("hello");
  });

  it("restores an offline backup after more than 30 card edits without a false conflict", async () => {
    const card = { ...example().cards[0], attachments: [] };
    const initial = recordRevision({ ...emptyState(), cards: [card] }, "card", card.id, "device-1");
    let newer = initial;
    for (let index = 0; index < 35; index++)
      newer = recordRevision({ ...newer, cards: [{ ...card, name: `Version ${index}` }] }, "card", card.id, "device-2");
    const parts = await partsFor(newer, new Map());
    const restored = await restoreBackup(
      parts,
      initial,
      async () => undefined,
      async () => {},
    );
    expect(restored.conflicts).toHaveLength(0);
    expect(restored.state.cards[0].name).toBe("Version 34");
  });

  it("preserves a shared revision of identical edits through backup restore", async () => {
    const card = { ...example().cards[0], attachments: [] };
    const initial = recordRevision({ ...emptyState(), cards: [card] }, "card", card.id, "device-1");
    const same = { ...card, name: "Identical edit" };
    const left = recordRevision({ ...initial, cards: [same] }, "card", card.id, "device-1");
    const right = recordRevision({ ...initial, cards: [same] }, "card", card.id, "device-2");
    const shared = mergeStates(left, right).state;
    const restored = await restoreBackup(
      await partsFor(shared, new Map()),
      right,
      async () => undefined,
      async () => {},
    );
    expect(restored.conflicts).toHaveLength(0);
    expect(restored.state.heads[`card:${card.id}`]).toBe(shared.heads[`card:${card.id}`]);
  });

  it("restores both directions of a local card dependency", async () => {
    const initial = example();
    initial.boards[0].backgroundImageId = undefined;
    initial.cards[0].attachments = [];
    initial.cards.push({ ...structuredClone(initial.cards[0]), id: "card-2", name: "Prerequisite task" });
    const linked = linkDependency(initial, "card-1", "card-2");
    const recorded = recordRevision(recordRevision(linked, "card", "card-1", "device-1"), "card", "card-2", "device-1");
    const restored = await restoreBackup(
      await partsFor(recorded, new Map()),
      emptyState(),
      async () => undefined,
      async () => {},
    );
    expect(relatedCards(restored.state.cards[0], restored.state)[0].target?.id).toBe("card-2");
    expect(relatedCards(restored.state.cards[1], restored.state)[0].target?.id).toBe("card-1");
    expect(restored.state.revisions.filter((revision) => revision.entityKind === "card")).toHaveLength(2);
  });
});
