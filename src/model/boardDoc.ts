import { formatDate, t } from "../i18n";
import type { AppState, Card } from "./index";

/** Markdown link to a card; the app resolves `/c/<id>` links to the card itself (see links.ts). */
export function cardRef(card: Pick<Card, "id" | "name">): string {
  return `[${card.name.replace(/[[\]]/g, "")}](/c/${card.id})`;
}

/** IDs of cards a markdown text links to with `/c/<id>`. */
export function mentionedCardIds(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(/\/c\/([A-Za-z0-9_-]+)\)/g)].map((match) => match[1]));
}

const day = 86_400_000;

/**
 * Live state of a board as markdown: lists with card counts, overdue and upcoming cards. Every card is a link,
 * so each statement in the summary points at its source.
 */
export function projectSummary(state: AppState, boardId: string, now = Date.now()): string {
  const board = state.boards.find((item) => item.id === boardId);
  if (!board) return "";
  const lists = state.lists
    .filter((item) => item.boardId === boardId && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  const listIds = new Set(lists.map((item) => item.id));
  const cards = state.cards.filter(
    (item) => item.boardId === boardId && listIds.has(item.listId) && !item.deletedAt && !item.isTemplate,
  );
  const lines = [
    t("model.summaryCards", { count: cards.length }),
    "",
    `| ${t("model.summaryList")} | ${t("model.summaryCardsColumn")} |`,
    "|---|---:|",
  ];
  for (const list of lists)
    lines.push(`| ${list.name.replace(/\|/g, "/")} | ${cards.filter((item) => item.listId === list.id).length} |`);
  const section = (title: string, items: Card[], note: (card: Card) => string = () => "") => {
    if (!items.length) return;
    lines.push("", `### ${title} (${items.length})`);
    for (const item of items.slice(0, 15)) lines.push(`- ${cardRef(item)}${note(item)}`);
    if (items.length > 15) lines.push(`- ${t("model.summaryMore", { count: items.length - 15 })}`);
  };
  const due = (item: Card) => Date.parse(item.dueAt ?? "");
  const date = (time: number) => formatDate(time);
  section(
    t("model.summaryOverdue"),
    cards.filter((item) => due(item) < now).sort((a, b) => due(a) - due(b)),
    (item) => ` — ${t("model.summaryDueOn", { date: date(due(item)) })}`,
  );
  section(
    t("model.summaryDueSoon"),
    cards.filter((item) => due(item) >= now && due(item) <= now + 7 * day).sort((a, b) => due(a) - due(b)),
    (item) => ` — ${date(due(item))}`,
  );
  return lines.join("\n");
}

/** Appends a dated snapshot of the summary to the board document, so the doc keeps a history of the project state. */
export function withSummarySnapshot(doc: string, summary: string, now = new Date()): string {
  return `${doc.trimEnd()}${doc.trim() ? "\n\n" : ""}## ${t("model.statusOn", { date: formatDate(now) })}\n\n${summary}\n`;
}
