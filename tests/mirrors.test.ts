import { afterEach, describe, expect, it, vi } from "vitest";
import { validState } from "../src/backup/backup";
import {
  type AppState,
  type Board,
  type Card,
  emptyState,
  mirrorCard,
  mirrorsOf,
  recordRevision,
  syncMirrors,
  unlinkMirror,
} from "../src/model";
import { moveToTrash, restoreFromTrash } from "../src/model/trash";

const board = (id: string, members: Board["members"] = []): Board => ({
  id,
  workspaceId: "w1",
  name: id,
  description: "",
  background: "#0c66e4",
  starred: false,
  members,
});
const start = Date.parse("2026-11-01T09:00:00.000Z");
const base = (): AppState => ({
  ...emptyState(),
  boards: [board("team", [{ id: "ann", name: "Ann" }]), board("mine")],
  lists: [
    { id: "todo", boardId: "team", name: "Todo", position: 1 },
    { id: "inbox", boardId: "mine", name: "Inbox", position: 1 },
    { id: "doing", boardId: "mine", name: "Doing", position: 2 },
  ],
  labels: [{ id: "red", boardId: "team", name: "Urgent", color: "#f00" }],
  cards: [
    {
      id: "task",
      boardId: "team",
      listId: "todo",
      name: "Task",
      description: "Plan",
      position: 1,
      labelIds: ["red"],
      memberIds: ["ann"],
      checklists: [{ id: "k", name: "Steps", items: [{ id: "i", name: "One", checked: false }] }],
      comments: [],
      attachments: [],
    },
  ],
});
/** A change made the way the app makes one: the edit with its revision, then mirrors kept alike. */
const edit = (state: AppState, id: string, change: (card: Card) => Card) =>
  syncMirrors(
    state,
    recordRevision(
      { ...state, cards: state.cards.map((card) => (card.id === id ? change(card) : card)) },
      "card",
      id,
      "laptop",
    ),
    "laptop",
  );
const card = (state: AppState, id: string) => state.cards.find((item) => item.id === id)!;

describe("mirrors", () => {
  afterEach(() => vi.useRealTimers());

  it("mirrors a card on another board with its labels and members mapped there", () => {
    const state = mirrorCard(base(), "task", "inbox", "laptop", { copyId: "copy" });
    const copy = card(state, "copy");
    expect(copy).toMatchObject({ boardId: "mine", listId: "inbox", name: "Task", description: "Plan" });
    expect(copy.mirrorId).toBe(card(state, "task").mirrorId);
    expect(copy.checklists).toEqual(card(state, "task").checklists);
    const label = state.labels.find((item) => item.id === copy.labelIds[0]);
    expect(label).toMatchObject({ boardId: "mine", name: "Urgent", color: "#f00" });
    expect(state.boards.find((item) => item.id === "mine")?.members).toEqual([{ id: "ann", name: "Ann" }]);
    expect(copy.memberIds).toEqual(["ann"]);
    expect(mirrorsOf(state, card(state, "task")).map((item) => item.id)).toEqual(["copy"]);
    expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
  });

  it("carries a change of either mirror to the other, but not where it lives", () => {
    let state = mirrorCard(base(), "task", "inbox", "laptop", { copyId: "copy" });
    state = edit(state, "copy", (item) => ({
      ...item,
      name: "Task v2",
      listId: "doing",
      checklists: [{ ...item.checklists[0], items: [{ ...item.checklists[0].items[0], checked: true }] }],
      comments: [{ id: "c", text: "Done", author: "Ann", createdAt: "2026-11-02T00:00:00.000Z" }],
    }));
    expect(card(state, "task")).toMatchObject({ name: "Task v2", listId: "todo", boardId: "team" });
    expect(card(state, "task").checklists[0].items[0].checked).toBe(true);
    expect(card(state, "task").comments.map((item) => item.text)).toEqual(["Done"]);
    expect(state.revisions[state.revisions.length - 1]).toMatchObject({ entityKind: "card", entityId: "task" });

    state = edit(state, "task", (item) => ({ ...item, labelIds: [], memberIds: [] }));
    expect(card(state, "copy")).toMatchObject({ labelIds: [], memberIds: [] });
    // Nothing left to carry: no further revisions.
    expect(syncMirrors(state, { ...state, cards: [...state.cards] }, "laptop").revisions).toHaveLength(
      state.revisions.length,
    );
  });

  it("keeps the newer edit when an older one of another mirror arrives from another device", () => {
    vi.useFakeTimers({ now: start });
    const shared = mirrorCard(base(), "task", "inbox", "phone", { copyId: "copy" });
    // The phone renames its mirror first; later the laptop renames the other one.
    vi.setSystemTime(start + 60_000);
    const phone = edit(shared, "copy", (item) => ({ ...item, name: "From phone" }));
    vi.setSystemTime(start + 120_000);
    const laptop = edit(shared, "task", (item) => ({ ...item, name: "From laptop" }));
    // The laptop merges the phone's card: the phone's edit is older, so the laptop's stays everywhere.
    const merged: AppState = {
      ...laptop,
      cards: laptop.cards.map((item) => (item.id === "copy" ? card(phone, "copy") : item)),
      revisions: [...laptop.revisions, ...phone.revisions.filter((item) => item.entityId === "copy")],
      heads: { ...laptop.heads, "card:copy": phone.heads["card:copy"] },
    };
    vi.setSystemTime(start + 180_000);
    const synced = syncMirrors(laptop, merged, "laptop");
    expect([card(synced, "task").name, card(synced, "copy").name]).toEqual(["From laptop", "From laptop"]);
  });

  it("deletes one mirror only, and a mirror back from the trash takes the others' content", () => {
    let state = mirrorCard(base(), "task", "inbox", "laptop", { copyId: "copy" });
    state = syncMirrors(state, moveToTrash(state, "card", "copy", "laptop"), "laptop");
    expect(card(state, "task").deletedAt).toBeUndefined();
    state = edit(state, "task", (item) => ({ ...item, description: "Changed while away" }));
    expect(card(state, "copy").description).toBe("Plan");
    state = syncMirrors(state, restoreFromTrash(state, "card", "copy", "laptop").state, "laptop");
    expect([card(state, "copy").description, card(state, "task").description]).toEqual([
      "Changed while away",
      "Changed while away",
    ]);
  });

  it("stops mirroring, and the last one left is no mirror either", () => {
    let state = mirrorCard(base(), "task", "inbox", "laptop", { copyId: "copy" });
    state = mirrorCard(state, "task", "doing", "laptop", { copyId: "third" });
    expect(new Set(state.cards.map((item) => item.mirrorId)).size).toBe(1);
    state = unlinkMirror(state, "third", "laptop");
    expect(card(state, "third").mirrorId).toBeUndefined();
    state = edit(state, "task", (item) => ({ ...item, name: "Only the copy" }));
    expect([card(state, "copy").name, card(state, "third").name]).toEqual(["Only the copy", "Task"]);
    state = unlinkMirror(state, "copy", "laptop");
    expect(state.cards.every((item) => item.mirrorId === undefined)).toBe(true);
    const broken = { ...state, cards: [{ ...card(state, "task"), mirrorId: 5 }] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});
