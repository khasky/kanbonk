import { useMemo, useState } from "react";
import { formatDate, formatDateTime, type MessageKey, t } from "../i18n";
import { saveFile } from "../lib/platform";
import { type AppState, type Card, type ViewCount, viewerName } from "../model";
import { lastDays, viewStats } from "../model/views";
import { viewAge } from "../model/viewText";
import { csvTable } from "../export/calendarFiles";
import { exportFileName } from "../export/exportData";
import { Button } from "../ui/Button";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { Table, Td, Th } from "../ui/Table";

const periods = [7, 30, 90] as const;
type CardSort = "views" | "people" | "last" | "name";
const cardColumns: { by: CardSort; label: MessageKey }[] = [
  { by: "name", label: "views.columnCard" },
  { by: "views", label: "views.columnViews" },
  { by: "people", label: "views.columnPeople" },
  { by: "last", label: "views.columnLastViewed" },
];
const sectionTitleClass = "mt-5 mb-2 text-[15px] font-semibold";

interface CardRow {
  card: Card;
  list: string;
  views: number;
  people: number;
  allTime: number;
  lastAt?: string;
}

/**
 * How a board is used: visits per day, the most and least viewed cards and who visits, over the last 7, 30 or 90
 * days, like Trello's board-analytics Power-Ups. Counts come from every synced device; CSV holds the card table.
 */
export function BoardAnalytics({
  state,
  boardId,
  onClose,
  onOpenCard,
  onError,
}: {
  state: AppState;
  boardId: string;
  onClose: () => void;
  onOpenCard: (card: Card) => void;
  onError: (message: string) => void;
}) {
  const [period, setPeriod] = useState<(typeof periods)[number]>(30);
  const [sort, setSort] = useState<{ by: CardSort; descending: boolean }>({ by: "views", descending: true });
  const board = state.boards.find((item) => item.id === boardId);
  const days = useMemo(() => lastDays(period), [period]);
  const data = useMemo(() => {
    const from = days[0];
    const boardViews = (state.views ?? []).filter((view) => view.boardId === boardId);
    const inPeriod = boardViews.filter((view) => view.day >= from);
    const visits = viewStats(inPeriod.filter((view) => view.kind === "board"));
    const cardViews = inPeriod.filter((view) => view.kind === "card");
    const byCard = new Map<string, ViewCount[]>();
    for (const view of cardViews) byCard.set(view.entityId, [...(byCard.get(view.entityId) ?? []), view]);
    const allTime = new Map<string, number>();
    const lastViewed = new Map<string, string>();
    for (const view of boardViews)
      if (view.kind === "card") {
        allTime.set(view.entityId, (allTime.get(view.entityId) ?? 0) + view.count);
        if (view.lastAt > (lastViewed.get(view.entityId) ?? "")) lastViewed.set(view.entityId, view.lastAt);
      }
    const listName = new Map(state.lists.map((list) => [list.id, list.name]));
    const rows: CardRow[] = state.cards
      .filter((card) => card.boardId === boardId && !card.deletedAt && !card.isTemplate)
      .map((card) => {
        const stats = viewStats(byCard.get(card.id) ?? []);
        return {
          card,
          list: listName.get(card.listId) ?? "",
          views: stats.total,
          people: stats.unique,
          allTime: allTime.get(card.id) ?? 0,
          lastAt: lastViewed.get(card.id),
        };
      });
    const people = new Map<string, { name: string; visits: number; cardViews: number; lastAt: string }>();
    for (const view of inPeriod) {
      const name = viewerName(view);
      const person = people.get(name) ?? { name, visits: 0, cardViews: 0, lastAt: "" };
      if (view.kind === "board") person.visits += view.count;
      else person.cardViews += view.count;
      if (view.lastAt > person.lastAt) person.lastAt = view.lastAt;
      people.set(name, person);
    }
    return {
      visits,
      cardViewTotal: cardViews.reduce((sum, view) => sum + view.count, 0),
      rows,
      people: [...people.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    };
  }, [state, boardId, days]);

  const sortedRows = useMemo(() => {
    const value = (row: CardRow): string | number =>
      sort.by === "name" ? row.card.name : sort.by === "last" ? (row.lastAt ?? "") : row[sort.by];
    return [...data.rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.descending ? -order : order;
    });
  }, [data.rows, sort]);

  if (!board) return null;
  const busiest = Math.max(0, ...days.map((day) => data.visits.byDay.get(day) ?? 0));
  const most = Math.max(1, busiest);
  const notViewed = data.rows.filter((row) => row.views === 0).length;
  const tiles: { label: string; value: number }[] = [
    { label: t("views.boardVisits"), value: data.visits.total },
    { label: t("views.visitors"), value: data.visits.unique },
    { label: t("views.cardViewsTotal"), value: data.cardViewTotal },
    { label: t("views.cardsNotViewed"), value: notViewed },
  ];

  function exportCsv() {
    const header = [
      t("views.columnCard"),
      t("views.columnList"),
      t("views.columnViewsPeriod", { days: period }),
      t("views.columnPeople"),
      t("views.columnViewsAllTime"),
      t("views.columnLastViewed"),
    ];
    const lines = sortedRows.map((row) =>
      [row.card.name, row.list, row.views, row.people, row.allTime, row.lastAt ?? ""].map(String),
    );
    const name = exportFileName(`${board?.name ?? "board"} ${t("views.analytics")}`, "csv");
    saveFile(new Blob([`\ufeff${csvTable([header, ...lines])}\r\n`], { type: "text/csv" }), name).catch((cause) =>
      onError(t("app.fileSaveError", { name, cause: String(cause) })),
    );
  }

  return (
    <SidePanel title={t("views.analytics")} width="wide" onClose={onClose}>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmented label={t("views.period")}>
          {periods.map((days) => (
            <SegmentedTab key={days} selected={period === days} onClick={() => setPeriod(days)}>
              {t("views.lastDays", { count: days })}
            </SegmentedTab>
          ))}
        </Segmented>
        <Button variant="secondary" className="ml-auto" onClick={exportCsv}>
          {t("views.exportCsv")}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 max-phone:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md bg-surface-sunken p-3">
            <div className="text-[24px] leading-tight font-semibold tabular-nums">{tile.value}</div>
            <div className="text-[12px] text-ink-subtle">{tile.label}</div>
          </div>
        ))}
      </div>

      <h3 className={sectionTitleClass}>{t("views.visitsByDay")}</h3>
      <div className="flex h-[140px] items-end gap-[2px] border-b border-ink-faint" role="list">
        {days.map((day) => {
          const count = data.visits.byDay.get(day) ?? 0;
          const label = `${formatDate(`${day}T12:00:00`)}: ${t("views.visitCount", { count })}`;
          return (
            <div
              key={day}
              role="listitem"
              aria-label={label}
              title={label}
              className="group flex h-full min-w-0 flex-1 items-end hover:bg-surface-sunken"
            >
              {count > 0 && (
                <div
                  className="w-full rounded-t-[4px] bg-brand group-hover:opacity-80"
                  style={{ height: `${(count / most) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-subtle">
        <span>{formatDate(`${days[0]}T12:00:00`)}</span>
        <span>{t("views.mostPerDay", { count: busiest })}</span>
        <span>{formatDate(`${days[days.length - 1]}T12:00:00`)}</span>
      </div>

      <h3 className={sectionTitleClass}>{t("views.cards")}</h3>
      <div className="max-h-[320px] overflow-auto">
        <Table>
          <thead className="sticky top-0 bg-white">
            <tr>
              {cardColumns.map((column) => (
                <Th
                  key={column.by}
                  sort={sort.by === column.by ? (sort.descending ? "descending" : "ascending") : undefined}
                  onSort={() =>
                    setSort((current) => ({
                      by: column.by,
                      descending: current.by === column.by ? !current.descending : column.by !== "name",
                    }))
                  }
                >
                  {t(column.label)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.card.id}>
                <Td top>
                  <Button variant="link-quiet" onClick={() => onOpenCard(row.card)}>
                    {row.card.name}
                  </Button>
                  <div className="text-[12px] text-ink-subtle">{row.list}</div>
                </Td>
                <Td top className="tabular-nums">
                  {row.views}
                </Td>
                <Td top className="tabular-nums">
                  {row.people}
                </Td>
                <Td top title={row.lastAt ? formatDateTime(row.lastAt) : undefined}>
                  {row.lastAt ? viewAge(row.lastAt) : t("views.never")}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <h3 className={sectionTitleClass}>{t("views.people")}</h3>
      {data.people.length === 0 ? (
        <Hint tone="subtle" className="m-0">
          {t("views.noViews")}
        </Hint>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("views.columnPerson")}</Th>
              <Th>{t("views.boardVisits")}</Th>
              <Th>{t("views.cardViewsTotal")}</Th>
              <Th>{t("views.columnLastSeen")}</Th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((person) => (
              <tr key={person.name}>
                <Td top>{person.name}</Td>
                <Td top className="tabular-nums">
                  {person.visits}
                </Td>
                <Td top className="tabular-nums">
                  {person.cardViews}
                </Td>
                <Td top title={formatDateTime(person.lastAt)}>
                  {viewAge(person.lastAt)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SidePanel>
  );
}
