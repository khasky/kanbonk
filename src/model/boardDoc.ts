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
 * Live state of a board as markdown: lists with progress, overdue, blocked and upcoming cards. Every card is a link,
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
  const byId = new Map(state.cards.map((item) => [item.id, item]));
  const waitingFor = (card: Card) =>
    [
      ...new Set(
        card.checklists.flatMap((list) =>
          list.items.flatMap((entry) => (entry.linkedCardId ? [entry.linkedCardId] : [])),
        ),
      ),
    ]
      .map((id) => byId.get(id))
      .filter((item): item is Card => Boolean(item && !item.completed && !item.deletedAt));
  const done = cards.filter((item) => item.completed).length;
  const lines = [
    `**${cards.length}** ${cards.length === 1 ? "card" : "cards"}, **${done}** done${cards.length ? ` (${Math.round((100 * done) / cards.length)}%)` : ""}.`,
    "",
    "| List | Cards | Done |",
    "|---|---:|---:|",
  ];
  for (const list of lists) {
    const inList = cards.filter((item) => item.listId === list.id);
    lines.push(
      `| ${list.name.replace(/\|/g, "/")} | ${inList.length} | ${inList.filter((item) => item.completed).length} |`,
    );
  }
  const section = (title: string, items: Card[], note: (card: Card) => string = () => "") => {
    if (!items.length) return;
    lines.push("", `### ${title} (${items.length})`);
    for (const item of items.slice(0, 15)) lines.push(`- ${cardRef(item)}${note(item)}`);
    if (items.length > 15) lines.push(`- …and ${items.length - 15} more`);
  };
  const due = (item: Card) => Date.parse(item.dueAt ?? "");
  const date = (time: number) => new Date(time).toLocaleDateString("en-US");
  section(
    "Overdue",
    cards.filter((item) => !item.completed && due(item) < now).sort((a, b) => due(a) - due(b)),
    (item) => ` — due ${date(due(item))}`,
  );
  section(
    "Blocked by dependencies",
    cards.filter((item) => !item.completed && waitingFor(item).length > 0),
    (item) => ` — waiting for ${waitingFor(item).map(cardRef).join(", ")}`,
  );
  section(
    "Due in the next 7 days",
    cards
      .filter((item) => !item.completed && due(item) >= now && due(item) <= now + 7 * day)
      .sort((a, b) => due(a) - due(b)),
    (item) => ` — ${date(due(item))}`,
  );
  return lines.join("\n");
}

/** Appends a dated snapshot of the summary to the board document, so the doc keeps a history of the project state. */
export function withSummarySnapshot(doc: string, summary: string, now = new Date()): string {
  return `${doc.trimEnd()}${doc.trim() ? "\n\n" : ""}## Status on ${now.toLocaleDateString("en-US")}\n\n${summary}\n`;
}
