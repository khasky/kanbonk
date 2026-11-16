import { newId, recordRevision, recordRevisions, type AppState, type BoardList, type Zone } from "./model";

/** Colors cycled for new zones (readable as a thin frame on any board background). */
export const zoneColors = ["#0c66e4", "#1f845a", "#a54800", "#ae2e24", "#6e5dc6", "#206a83", "#943d73", "#5b7f24"];

export interface ZoneRun { zone?: Zone; lists: BoardList[] }

/** Splits visible lists (already sorted by position) into consecutive runs; each zoned run is drawn as one frame. */
export function zoneRuns(lists: BoardList[], zones: Zone[] = []): ZoneRun[] {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  const runs: ZoneRun[] = [];
  for (const list of lists) {
    const zone = list.zoneId ? byId.get(list.zoneId) : undefined;
    const last = runs[runs.length - 1];
    if (last && last.zone?.id === zone?.id) last.lists.push(list);
    else runs.push({ zone, lists: [list] });
  }
  return runs;
}

function boardLists(state: AppState, boardId: string): BoardList[] {
  return state.lists.filter((list) => list.boardId === boardId && !list.archived && !list.deletedAt).sort((a, b) => a.position - b.position);
}

/** Writes new positions and zone ids for the given ordered lists and records revisions for every list that changed. */
function applyOrder(state: AppState, ordered: BoardList[], zoneOf: (list: BoardList) => string | undefined, deviceId: string): AppState {
  const changes = new Map<string, BoardList>();
  ordered.forEach((list, index) => {
    const zoneId = zoneOf(list);
    if (list.position !== index + 1 || list.zoneId !== zoneId) changes.set(list.id, { ...list, position: index + 1, zoneId });
  });
  if (!changes.size) return state;
  const next: AppState = { ...state, lists: state.lists.map((list) => changes.get(list.id) ?? list) };
  return recordRevisions(next, [...changes.keys()].map((id) => ({ kind: "list" as const, id })), deviceId);
}

/** Puts a list into a zone (or out of any zone) and keeps every zone contiguous: the list moves to the end of the zone. */
export function assignListToZone(state: AppState, listId: string, zoneId: string | undefined, deviceId: string): AppState {
  const list = state.lists.find((item) => item.id === listId);
  if (!list || list.zoneId === zoneId) return state;
  const ordered = boardLists(state, list.boardId);
  const without = ordered.filter((item) => item.id !== listId);
  // Joining: go right after the zone's last list. Leaving: step out right after the zone it left.
  const anchorZone = zoneId ?? list.zoneId;
  const anchor = anchorZone ? without.map((item) => item.zoneId).lastIndexOf(anchorZone) : -1;
  without.splice(anchor >= 0 ? anchor + 1 : ordered.findIndex((item) => item.id === listId), 0, list);
  return applyOrder(state, without, (item) => item.id === listId ? zoneId : item.zoneId, deviceId);
}

/** Creates a zone on the board and places the list into it. */
export function createZone(state: AppState, boardId: string, name: string, listIds: string[], deviceId: string, zoneId = newId()): { state: AppState; zoneId: string } {
  const board = state.boards.find((item) => item.id === boardId);
  if (!board || !name.trim()) return { state, zoneId };
  const zones = board.zones ?? [];
  const zone: Zone = { id: zoneId, name: name.trim(), color: zoneColors[zones.length % zoneColors.length] };
  let next = recordRevision({ ...state, boards: state.boards.map((item) => item.id === boardId ? { ...item, zones: [...zones, zone] } : item) }, "board", boardId, deviceId);
  for (const listId of listIds) next = assignListToZone(next, listId, zoneId, deviceId);
  return { state: next, zoneId };
}

export function updateZone(state: AppState, boardId: string, zoneId: string, change: Partial<Omit<Zone, "id">>, deviceId: string): AppState {
  return recordRevision({ ...state, boards: state.boards.map((board) => board.id === boardId ? { ...board, zones: (board.zones ?? []).map((zone) => zone.id === zoneId ? { ...zone, ...change } : zone) } : board) }, "board", boardId, deviceId);
}

/** Removes the zone only; its lists (including ones in the trash) stay on the board without a zone. */
export function deleteZone(state: AppState, boardId: string, zoneId: string, deviceId: string): AppState {
  let next = recordRevision({ ...state, boards: state.boards.map((board) => board.id === boardId ? { ...board, zones: (board.zones ?? []).filter((zone) => zone.id !== zoneId) } : board) }, "board", boardId, deviceId);
  const ids = next.lists.filter((list) => list.boardId === boardId && list.zoneId === zoneId).map((list) => list.id);
  next = { ...next, lists: next.lists.map((list) => ids.includes(list.id) ? { ...list, zoneId: undefined } : list) };
  return recordRevisions(next, ids.map((id) => ({ kind: "list" as const, id })), deviceId);
}

/** Drag-and-drop of a list: it lands before/after the target list and joins the target's zone (or leaves zones). */
export function moveListToList(state: AppState, listId: string, targetId: string, after: boolean, deviceId: string): AppState {
  const list = state.lists.find((item) => item.id === listId);
  const target = state.lists.find((item) => item.id === targetId);
  if (!list || !target || list.id === target.id || list.boardId !== target.boardId) return state;
  const ordered = boardLists(state, list.boardId).filter((item) => item.id !== listId);
  ordered.splice(ordered.findIndex((item) => item.id === targetId) + Number(after), 0, list);
  return applyOrder(state, ordered, (item) => item.id === listId ? target.zoneId : item.zoneId, deviceId);
}

/** Drag-and-drop of a whole zone: its lists move together next to the target list's zone block (or the target list). */
export function moveZone(state: AppState, boardId: string, zoneId: string, targetId: string, after: boolean, deviceId: string): AppState {
  const ordered = boardLists(state, boardId);
  const target = ordered.find((item) => item.id === targetId);
  if (!target || target.zoneId === zoneId) return state;
  const block = ordered.filter((item) => item.zoneId === zoneId);
  const rest = ordered.filter((item) => item.zoneId !== zoneId);
  const targetBlock = target.zoneId ? rest.filter((item) => item.zoneId === target.zoneId) : [target];
  const edge = after ? rest.indexOf(targetBlock[targetBlock.length - 1]) + 1 : rest.indexOf(targetBlock[0]);
  rest.splice(edge, 0, ...block);
  return applyOrder(state, rest, (item) => item.zoneId, deviceId);
}
