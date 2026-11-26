import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { activeFilterCount } from "../board/BoardFilterPanel";
import { t } from "../i18n";
import { readBoardFilters } from "../lib/uiPreferences";
import {
  emptyBoardFilter,
  filterBoardCards,
  cardViewStats,
  boardCardAges,
  isCardAvailable,
  missingFields,
  type AppState,
  type BoardFilter,
  type Card,
  type MissingField,
} from "../model";

/**
 * What the open board shows: its lists, the cards that pass the board's filter grouped by list, and lookup maps for
 * the card tiles. Filters are kept per board in localStorage.
 */
export function useBoardView(
  state: AppState,
  boardId: string | null,
  onError: (message: string) => void,
  /** The time cards age against. */
  now: number,
) {
  const [boardFilters, setBoardFilters] = useState<Record<string, BoardFilter>>(readBoardFilters);
  const reportError = useEffectEvent(onError);
  useEffect(() => {
    try {
      localStorage.setItem("kanbonk-board-filters", JSON.stringify(boardFilters));
    } catch (cause) {
      reportError(t("app.boardFilterSaveError", { cause: String(cause) }));
    }
  }, [boardFilters]);

  const board = state.boards.find((item) => item.id === boardId && !item.deletedAt);
  const lists = state.lists
    .filter((item) => item.boardId === boardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  const filter = useMemo(() => boardFilters[boardId ?? ""] ?? emptyBoardFilter(), [boardFilters, boardId]);
  const deferredFilter = useDeferredValue(filter);
  const filteredCards = useMemo(
    () => (boardId ? filterBoardCards(state, boardId, deferredFilter) : []),
    [state, boardId, deferredFilter],
  );
  const filteredCardIds = useMemo(() => new Set(filteredCards.map((item) => item.id)), [filteredCards]);
  const cardsByList = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const item of filteredCards) {
      const group = groups.get(item.listId);
      if (group) group.push(item);
      else groups.set(item.listId, [item]);
    }
    for (const group of groups.values()) group.sort((a, b) => a.position - b.position);
    return groups;
  }, [filteredCards]);
  const labelMap = useMemo(
    () => new Map(state.labels.filter((item) => !item.deleted).map((item) => [item.id, item])),
    [state.labels],
  );
  const cardById = useMemo(() => new Map(state.cards.map((item) => [item.id, item])), [state.cards]);
  /** How many open sub-cards each parent card has, as its dialog lists them. */
  const subCardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of state.cards)
      if (item.parentCardId && isCardAvailable(state, item))
        counts.set(item.parentCardId, (counts.get(item.parentCardId) ?? 0) + 1);
    return counts;
  }, [state]);

  /** Views of each card of the open board, for the view badges. */
  const cardViews = useMemo(() => cardViewStats(state, boardId ?? undefined), [state, boardId]);
  /** What each card of the open board lacks under the board's required fields, for the warning badges. */
  const rules = board?.requiredFields;
  const missingByCard = useMemo(() => {
    const missing = new Map<string, MissingField[]>();
    for (const item of state.cards) {
      const found = item.boardId === boardId ? missingFields(item, rules) : [];
      if (found.length) missing.set(item.id, found);
    }
    return missing;
  }, [state.cards, boardId, rules]);
  /** How long each card of the open board has gone without a change, when the board ages its cards. */
  const cardAges = useMemo(() => (boardId ? boardCardAges(state, boardId, now) : new Map()), [state, boardId, now]);

  function updateFilter(change: Partial<BoardFilter>) {
    if (!boardId) return;
    setBoardFilters((current) => ({
      ...current,
      [boardId]: { ...(current[boardId] ?? emptyBoardFilter()), ...change },
    }));
  }

  /** Clears a deleted label from the filter of its board. */
  function forgetLabel(labelBoardId: string, labelId: string) {
    setBoardFilters((current) =>
      current[labelBoardId]?.labelId === labelId
        ? { ...current, [labelBoardId]: { ...current[labelBoardId], labelId: "" } }
        : current,
    );
  }

  return {
    board,
    lists,
    filter,
    filterCount: activeFilterCount(filter),
    updateFilter,
    forgetLabel,
    filteredCardIds,
    cardsByList,
    labelMap,
    cardById,
    subCardCounts,
    cardViews,
    missingByCard,
    cardAges,
    agingMode: board?.cardAging,
    totalCardCount: boardId ? filterBoardCards(state, boardId, emptyBoardFilter()).length : 0,
    templates: state.cards.filter((item) => item.boardId === boardId && item.isTemplate),
  };
}

export type BoardViewData = ReturnType<typeof useBoardView>;
