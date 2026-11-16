import { describe, expect, it } from "vitest";
import { deleteLabel, emptyState, linkDependency, recordRevision, restoreRevision } from "../src/model";
import { relatedCards } from "../src/links";
import { chooseConflict, mergeStates } from "../src/sync";

const original = { id: "card-1", boardId: "board-1", listId: "list-1", name: "Original", description: "", position: 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] };

describe("LAN version merge", () => {
  it("keeps a deleted label deleted after synchronization and removes it from cards", () => {
    const label = { id: "label-1", boardId: "board-1", name: "Delete me", color: "#f00" };
    const card = { ...original, labelIds: [label.id] };
    const initial = recordRevision(recordRevision({ ...emptyState(), labels: [label], cards: [card] }, "label", label.id, "device-1"), "card", card.id, "device-1");
    const deleted = deleteLabel(initial, label.id, "device-1");
    expect(deleted.labels[0].deleted).toBe(true);
    expect(deleted.cards[0].labelIds).toEqual([]);
    expect(deleted.activity?.some((item) => item.summary.includes("Label “Delete me” deleted"))).toBe(true);
    expect(deleteLabel(deleted, label.id, "device-1")).toBe(deleted);
    const merged = mergeStates(initial, deleted);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.labels[0].deleted).toBe(true);
    expect(merged.state.cards[0].labelIds).toEqual([]);
    const restored = restoreRevision(deleted, initial.revisions[0], "device-1");
    expect(restored.labels[0].deleted).toBeUndefined();
    expect(restored.activity?.some((item) => item.summary.includes("Label “Delete me” restored"))).toBe(true);
  });

  it("synchronizes label edits and resolves concurrent label conflicts", () => {
    const label = { id: "label-1", boardId: "board-1", name: "Original", color: "#f00" };
    const initial = recordRevision({ ...emptyState(), labels: [label] }, "label", label.id, "device-1");
    const local = recordRevision({ ...initial, labels: [{ ...label, name: "Local" }] }, "label", label.id, "device-1");
    const remote = recordRevision({ ...initial, labels: [{ ...label, color: "#00f" }] }, "label", label.id, "device-2");
    const merged = mergeStates(local, remote);
    expect(merged.conflicts.map((item) => item.kind)).toEqual(["label"]);
    const resolved = chooseConflict(merged.state, merged.conflicts[0], "remote", "device-1");
    expect(resolved.labels[0].color).toBe("#00f");
    expect(mergeStates(local, resolved).conflicts).toHaveLength(0);
    expect(mergeStates(remote, resolved).conflicts).toHaveLength(0);
    const later = recordRevision({ ...resolved, labels: [{ ...resolved.labels[0], name: "Later" }] }, "label", label.id, "device-1");
    expect(mergeStates(remote, later).state.labels[0].name).toBe("Later");
  });

  it("takes a causally newer remote version", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    const remote = recordRevision({ ...initial, cards: [{ ...original, name: "New", stickers: ["⭐"] }] }, "card", original.id, "device-2");
    const merged = mergeStates(initial, remote);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.cards[0].name).toBe("New");
    expect(merged.state.cards[0].stickers).toEqual(["⭐"]);
    expect(merged.state.activity).toHaveLength(2);
  });

  it("keeps the originating device's comment author after synchronization", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    const comment = { id: "comment-1", author: "Member device-2", authorDeviceId: "device-2", text: "Done", createdAt: "2026-11-15T10:00:00.000Z" };
    const remote = recordRevision({ ...initial, cards: [{ ...original, comments: [comment] }] }, "card", original.id, "device-2");
    const merged = mergeStates(initial, remote);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.cards[0].comments).toEqual([comment]);
    expect(merged.state.activity?.find((item) => item.category === "comment")?.summary).toBe("Member device-2: Done");
  });

  it("transfers both sides of a local card dependency through version merge", () => {
    const prerequisite = { ...structuredClone(original), id: "card-2", name: "Prerequisite" };
    const base = { ...emptyState(), boards: [{ id: "board-1", workspaceId: "workspace", name: "Board", description: "", background: "#fff", starred: false }], lists: [{ id: "list-1", boardId: "board-1", name: "Tasks", position: 1 }], cards: [original, prerequisite] };
    const initial = recordRevision(recordRevision(base, "card", "card-1", "device-1"), "card", "card-2", "device-1");
    const linked = linkDependency(initial, "card-1", "card-2");
    const remote = recordRevision(recordRevision(linked, "card", "card-1", "device-2"), "card", "card-2", "device-2");
    const merged = mergeStates(initial, remote);
    expect(merged.conflicts).toHaveLength(0);
    expect(relatedCards(merged.state.cards[0], merged.state)[0].target?.id).toBe("card-2");
    expect(relatedCards(merged.state.cards[1], merged.state)[0].target?.id).toBe("card-1");
  });

  it("converges identical concurrent edits before the next change", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    const same = { ...original, name: "Matched" };
    const local = recordRevision({ ...initial, cards: [same] }, "card", original.id, "device-1");
    const remote = recordRevision({ ...initial, cards: [same] }, "card", original.id, "device-2");
    const left = mergeStates(local, remote);
    const right = mergeStates(remote, local);
    expect(left.conflicts).toHaveLength(0);
    expect(right.conflicts).toHaveLength(0);
    expect(left.state.heads[`card:${original.id}`]).toBe(right.state.heads[`card:${original.id}`]);
    const repeated = mergeStates(left.state, right.state);
    expect(repeated.state.heads[`card:${original.id}`]).toBe(left.state.heads[`card:${original.id}`]);
    expect(repeated.state.revisions).toHaveLength(left.state.revisions.length);
    const later = recordRevision({ ...left.state, cards: [{ ...same, name: "Later" }] }, "card", original.id, "device-1");
    const merged = mergeStates(right.state, later);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.cards[0].name).toBe("Later");
  });

  it("recognizes an old ancestor after newer snapshots have been trimmed", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    let remote = initial;
    for (let index = 0; index < 35; index++) {
      remote = recordRevision({ ...remote, cards: [{ ...original, name: `Version ${index}` }] }, "card", original.id, "device-2");
    }
    const merged = mergeStates(initial, remote);
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.state.cards[0].name).toBe("Version 34");
    expect(merged.state.activity).toHaveLength(36);
  });

  it("surfaces divergent edits and resolves them into a common revision", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    const local = recordRevision({ ...initial, cards: [{ ...original, name: "Local" }] }, "card", original.id, "device-1");
    const remote = recordRevision({ ...initial, cards: [{ ...original, name: "Remote" }] }, "card", original.id, "device-2");
    const merged = mergeStates(local, remote);
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.state.cards[0].name).toBe("Local");
    const resolved = chooseConflict(merged.state, merged.conflicts[0], "remote", "device-1");
    expect(resolved.cards[0].name).toBe("Remote");
    expect(mergeStates(remote, resolved).conflicts).toHaveLength(0);
  });

  it("keeps a resolved conflict compatible with both histories after snapshot pruning", () => {
    const initial = recordRevision({ ...emptyState(), cards: [original] }, "card", original.id, "device-1");
    let local = initial;
    let remote = initial;
    for (let index = 0; index < 35; index++) {
      local = recordRevision({ ...local, cards: [{ ...original, name: `Local ${index}` }] }, "card", original.id, "device-1");
      remote = recordRevision({ ...remote, cards: [{ ...original, name: `Remote ${index}` }] }, "card", original.id, "device-2");
    }
    const merged = mergeStates(local, remote);
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.state.revisions.filter((revision) => revision.entityId === original.id)).toHaveLength(30);
    const resolved = chooseConflict(merged.state, merged.conflicts[0], "remote", "device-1");
    expect(resolved.revisions.filter((revision) => revision.entityId === original.id)).toHaveLength(30);
    expect(mergeStates(local, resolved).conflicts).toHaveLength(0);
    expect(mergeStates(remote, resolved).conflicts).toHaveLength(0);
  });
});
