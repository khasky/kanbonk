import { describe, expect, it } from "vitest";
import { validState } from "../src/backup/backup";
import { type AppState, type Board, boardLabel, emptyState, type Label, shareLabels, updateLabel } from "../src/model";

const board = (id: string, deletedAt?: string): Board => ({
  id,
  workspaceId: "w1",
  name: id,
  description: "",
  background: "#0c66e4",
  starred: false,
  deletedAt,
});
const label = (id: string, boardId: string, name: string, color: string): Label => ({ id, boardId, name, color });
const onBoard = (state: AppState, boardId: string) =>
  state.labels
    .filter((item) => item.boardId === boardId && !item.deleted)
    .map((item) => [item.name, item.color, item.linkId]);

describe("label sharing", () => {
  const start: AppState = {
    ...emptyState(),
    boards: [board("b1"), board("b2"), board("b3"), board("gone", "2026-11-01T00:00:00.000Z")],
    labels: [
      label("urgent", "b1", "Urgent", "#f00"),
      label("blue", "b1", "", "#00f"),
      label("other", "b1", "Later", "#0f0"),
      label("b2-urgent", "b2", " urgent ", "#0a0"),
    ],
  };

  it("adds the labels to the chosen boards, takes over a label of the same name, and skips deleted boards", () => {
    const shared = shareLabels(start, ["urgent", "blue"], ["b2", "b3", "gone"], "laptop");
    const urgent = shared.labels.find((item) => item.id === "urgent")!.linkId!;
    const blue = shared.labels.find((item) => item.id === "blue")!.linkId!;
    expect(urgent).toBeTruthy();
    expect(onBoard(shared, "b2")).toEqual([
      ["Urgent", "#f00", urgent],
      ["", "#00f", blue],
    ]);
    expect(onBoard(shared, "b3")).toEqual([
      ["Urgent", "#f00", urgent],
      ["", "#00f", blue],
    ]);
    expect(onBoard(shared, "gone")).toEqual([]);
    expect(shared.labels.find((item) => item.id === "other")?.linkId).toBeUndefined();
    expect(shared.revisions.map((item) => item.entityKind)).toEqual(Array(6).fill("label"));

    // Sharing again changes nothing.
    const again = shareLabels(shared, ["urgent", "blue"], ["b2", "b3"], "laptop");
    expect(again.labels).toEqual(shared.labels);
    expect(again.revisions).toHaveLength(shared.revisions.length);
  });

  it("renames and recolors a shared label on every board, and a moved card gets the board's shared label", () => {
    const shared = shareLabels(start, ["urgent"], ["b2", "b3"], "laptop");
    const b3Urgent = shared.labels.find((item) => item.boardId === "b3")!;
    const edited = updateLabel(shared, b3Urgent.id, "Now", "#123", "laptop");
    expect(edited.labels.filter((item) => item.name === "Now").map((item) => item.boardId)).toEqual(["b1", "b2", "b3"]);
    expect(edited.labels.find((item) => item.id === "other")?.name).toBe("Later");
    expect(edited.revisions.length - shared.revisions.length).toBe(3);

    const renamed = { ...edited.labels.find((item) => item.id === "urgent")!, name: "Renamed here only" };
    expect(boardLabel([...edited.labels], renamed, "b2").id).toBe("b2-urgent");
  });

  it("keeps the link in backups", () => {
    const shared = shareLabels(start, ["urgent"], ["b2"], "laptop");
    expect(validState(shared as unknown as Record<string, unknown>)).toBe(true);
    const broken = { ...shared, labels: [{ ...shared.labels[0], linkId: 5 }] };
    expect(validState(broken as unknown as Record<string, unknown>)).toBe(false);
  });
});
