import { expect, it } from "vitest";
import { emptyState, recordRevision, type AppState } from "../src/model";
import { mergeStates } from "../src/sync";
import { validState } from "../src/backup";
import { assignListToZone, createZone, deleteZone, moveListToList, moveZone, zoneRuns } from "../src/zones";

const names = ["Backlog", "Todo", "In progress", "Testing", "Deployment", "Done"];

function sample(): AppState {
  return {
    ...emptyState(),
    workspaces: [{ id: "w1", name: "W" }],
    boards: [{ id: "b1", workspaceId: "w1", name: "B", description: "", background: "#000", starred: false }],
    lists: names.map((name, index) => ({ id: `l${index}`, boardId: "b1", name, position: index + 1 })),
  };
}

const order = (state: AppState) =>
  state.lists
    .filter((list) => list.boardId === "b1")
    .sort((a, b) => a.position - b.position)
    .map(
      (list) =>
        `${list.name}${list.zoneId ? `@${state.boards[0].zones?.find((zone) => zone.id === list.zoneId)?.name}` : ""}`,
    );

function development(): AppState {
  return createZone(sample(), "b1", "Development", ["l1", "l2", "l3", "l4"], "d", "z1").state;
}

it("groups lists into a zone and draws consecutive runs", () => {
  const state = development();
  expect(order(state)).toEqual([
    "Backlog",
    "Todo@Development",
    "In progress@Development",
    "Testing@Development",
    "Deployment@Development",
    "Done",
  ]);
  const lists = [...state.lists].sort((a, b) => a.position - b.position);
  expect(zoneRuns(lists, state.boards[0].zones).map((run) => [run.zone?.name ?? "-", run.lists.length])).toEqual([
    ["-", 1],
    ["Development", 4],
    ["-", 1],
  ]);
});

it("keeps a zone contiguous when a distant list joins or leaves it", () => {
  const joined = assignListToZone(
    createZone(sample(), "b1", "Development", ["l1", "l2"], "d", "z1").state,
    "l5",
    "z1",
    "d",
  );
  expect(order(joined)).toEqual([
    "Backlog",
    "Todo@Development",
    "In progress@Development",
    "Done@Development",
    "Testing",
    "Deployment",
  ]);
  const left = assignListToZone(joined, "l1", undefined, "d");
  expect(order(left)).toEqual([
    "Backlog",
    "In progress@Development",
    "Done@Development",
    "Todo",
    "Testing",
    "Deployment",
  ]);
});

it("moves a dragged list into the zone of the list it was dropped on, and out of it", () => {
  const into = moveListToList(development(), "l0", "l2", true, "d");
  expect(order(into)).toEqual([
    "Todo@Development",
    "In progress@Development",
    "Backlog@Development",
    "Testing@Development",
    "Deployment@Development",
    "Done",
  ]);
  const out = moveListToList(into, "l3", "l5", true, "d");
  expect(order(out)).toEqual([
    "Todo@Development",
    "In progress@Development",
    "Backlog@Development",
    "Deployment@Development",
    "Done",
    "Testing",
  ]);
});

it("moves a whole zone and deletes a zone without deleting its lists", () => {
  const moved = moveZone(development(), "b1", "z1", "l5", true, "d");
  expect(order(moved)).toEqual([
    "Backlog",
    "Done",
    "Todo@Development",
    "In progress@Development",
    "Testing@Development",
    "Deployment@Development",
  ]);
  const removed = deleteZone(moved, "b1", "z1", "d");
  expect(order(removed)).toEqual(["Backlog", "Done", "Todo", "In progress", "Testing", "Deployment"]);
  expect(removed.boards[0].zones).toEqual([]);
});

it("syncs zones to another device and survives backup validation", () => {
  let shared = recordRevision(sample(), "board", "b1", "d");
  for (const list of shared.lists) shared = recordRevision(shared, "list", list.id, "d");
  const local = createZone(shared, "b1", "Development", ["l1", "l2", "l3", "l4"], "d", "z1").state;
  const merged = mergeStates(shared, local);
  expect(order(merged.state)).toEqual(order(local));
  expect(merged.conflicts).toEqual([]);
  expect(validState(local as unknown as Record<string, unknown>)).toBe(true);
});
