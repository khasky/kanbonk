import { expect, it } from "vitest";
import { cardRef, mentionedCardIds, projectSummary, withSummarySnapshot } from "../src/boardDoc";
import { kanbonkCardForUrl, importedCardForUrl } from "../src/links";
import { emptyState, type AppState, type Card } from "../src/model";

const card = (id: string, listId: string, extra: Partial<Card> = {}): Card => ({ id, boardId: "b1", listId, name: `Card ${id}`, description: "", position: 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [], ...extra });
const now = Date.parse("2026-11-15T12:00:00Z");
const state: AppState = {
  ...emptyState(),
  boards: [{ id: "b1", workspaceId: "w", name: "B", description: "", background: "#000", starred: false }],
  lists: [{ id: "l1", boardId: "b1", name: "Todo", position: 1 }, { id: "l2", boardId: "b1", name: "Done", position: 2 }],
  cards: [
    card("late", "l1", { dueAt: "2026-11-10T12:00:00Z" }),
    card("soon", "l1", { dueAt: "2026-11-18T12:00:00Z" }),
    card("blocked", "l1", { checklists: [{ id: "k", name: "deps", items: [{ id: "i", name: "late", checked: false, linkedCardId: "late" }] }] }),
    card("done", "l2", { completed: true }),
  ],
};

it("summarises a board with linked sources", () => {
  const summary = projectSummary(state, "b1", now);
  expect(summary).toContain("**4** cards, **1** done (25%)");
  expect(summary).toContain("| Todo | 3 | 0 |");
  expect(summary).toMatch(/### Overdue \(1\)\n- \[Card late\]\(\/c\/late\)/);
  expect(summary).toContain("- [Card blocked](/c/blocked) — waiting for [Card late](/c/late)");
  expect(summary).toMatch(/### Due in the next 7 days \(1\)\n- \[Card soon\]/);
});

it("finds card mentions and resolves Kanbonk links", () => {
  const doc = withSummarySnapshot("Plan", `See ${cardRef({ id: "soon", name: "Soon [x]" })}`, new Date(now));
  expect(doc).toContain("## Status on");
  expect([...mentionedCardIds(doc)]).toEqual(["soon"]);
  expect(kanbonkCardForUrl("/c/soon", state)?.id).toBe("soon");
  expect(kanbonkCardForUrl("#/c/late", state)?.id).toBe("late");
  expect(kanbonkCardForUrl("http://192.168.1.5:4174/c/done", state)?.id).toBe("done");
  expect(kanbonkCardForUrl("https://trello.com/c/done", state)).toBeUndefined();
  expect(importedCardForUrl("/c/late", state)?.id).toBe("late");
});
