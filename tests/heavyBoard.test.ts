import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  emptyState,
  filterBoardCards,
  emptyBoardFilter,
  recordRevision,
  searchCards,
  type AppState,
} from "../src/model";
import { addImportedBoardWithRevisions, parseTrelloBoard } from "../src/trello/import";
import { exportTrelloCsv, exportTrelloJson, parseTrelloCsv } from "../src/trello/formats";
import { mergeStates } from "../src/sync";
import { validState } from "../src/backup";
import { findDuplicates } from "../src/dedupe";
import { moveToTrash, visibleState } from "../src/trash";
// Plain JS generator shared with the browser load test.
import { bigBoard } from "../scripts/generate-big-board.mjs";

/** Time budgets (ms) for one operation on a big board; generous enough for slow CI machines, far below what users notice as a freeze. */
const budget = {
  import: 1500,
  export: 1000,
  merge: 1000,
  search: 100,
  filter: 100,
  dedupe: 3000,
  edit: 150,
  trash: 500,
};

function timed<T>(run: () => T): { result: T; ms: number } {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
}

function importBoard(raw: unknown): AppState {
  const base: AppState = { ...emptyState(), workspaces: [{ id: "w1", name: "W" }] };
  return addImportedBoardWithRevisions(base, parseTrelloBoard(raw, "w1"), "d");
}

it("keeps every core operation fast on a 5000-card board", { timeout: 60_000 }, () => {
  const raw = bigBoard(5000, 50);
  const imported = timed(() => importBoard(raw));
  const state = imported.result;
  const board = state.boards[0];
  expect(state.cards).toHaveLength(5000);
  expect(imported.ms).toBeLessThan(budget.import);

  expect(timed(() => exportTrelloJson(state, board.id)).ms).toBeLessThan(budget.export);
  expect(timed(() => exportTrelloCsv(state, board.id)).ms).toBeLessThan(budget.export);
  expect(timed(() => mergeStates(state, structuredClone(state))).ms).toBeLessThan(budget.merge);

  const search = timed(() => searchCards(state, "deploy sync"));
  expect(search.result.length).toBeGreaterThan(0);
  expect(search.ms).toBeLessThan(budget.search);
  expect(timed(() => filterBoardCards(state, board.id, { ...emptyBoardFilter(), keyword: "release" })).ms).toBeLessThan(
    budget.filter,
  );

  const card = state.cards[2500];
  const edited = {
    ...state,
    cards: state.cards.map((item) => (item.id === card.id ? { ...item, name: "Renamed" } : item)),
  };
  expect(timed(() => recordRevision(edited, "card", card.id, "d")).ms).toBeLessThan(budget.edit);

  const trashed = timed(() => moveToTrash(state, "list", state.lists[0].id, "d"));
  expect(trashed.ms).toBeLessThan(budget.trash);
  expect(timed(() => visibleState(trashed.result)).ms).toBeLessThan(budget.filter);

  expect(timed(() => findDuplicates(state, { crossBoardOnly: false })).ms).toBeLessThan(budget.dedupe);
});

const heavyExport = process.env.KANBONK_HEAVY_EXPORT ?? "";

// A real 14.6 MB Trello export (1945 cards, 2296 attachments, 1000 actions); runs where the file is available.
it.runIf(existsSync(heavyExport))("round-trips a heavy real Trello export", { timeout: 60_000 }, () => {
  const raw = JSON.parse(readFileSync(heavyExport, "utf8"));
  const source = parseTrelloBoard(raw, "w1");
  const imported = timed(() => importBoard(raw));
  const state = imported.result;
  expect(imported.ms).toBeLessThan(budget.import);
  expect(validState(state as unknown as Record<string, unknown>)).toBe(true);
  const boardId = state.boards[0].id;
  const openCards = (raw.cards as Array<{ closed: boolean }>).length;
  expect(state.cards).toHaveLength(openCards);

  const json = timed(() => exportTrelloJson(state, boardId));
  expect(json.ms).toBeLessThan(budget.export);
  const again = parseTrelloBoard(JSON.parse(JSON.stringify(json.result)), "w1");
  expect(again.cards).toHaveLength(source.cards.length);
  expect(again.lists).toHaveLength(source.lists.length);
  expect(again.cards.reduce((sum, item) => sum + item.checklists.length, 0)).toBe(
    source.cards.reduce((sum, item) => sum + item.checklists.length, 0),
  );
  expect(again.cards.reduce((sum, item) => sum + item.comments.length, 0)).toBe(
    source.cards.reduce((sum, item) => sum + item.comments.length, 0),
  );
  expect(new Set(again.cards.map((item) => item.name))).toEqual(new Set(source.cards.map((item) => item.name)));

  const csv = timed(() => exportTrelloCsv(state, boardId));
  expect(csv.ms).toBeLessThan(budget.export);
  expect(parseTrelloCsv(csv.result, "w1").cards).toHaveLength(source.cards.length);
});
