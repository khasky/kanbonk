import { isCardAvailable, type AppState, type Card } from "./index";

export function reminderSignature(card: Card): string {
  return `${card.dueAt}/${card.dueReminderMinutes}`;
}

export function dueReminders(state: AppState, now: number, dismissed: Record<string, string>): Card[] {
  return state.cards
    .filter((card) => {
      if (
        !card.dueAt ||
        card.dueReminderMinutes === undefined ||
        !Number.isFinite(card.dueReminderMinutes) ||
        card.dueReminderMinutes < 0 ||
        card.isTemplate ||
        !isCardAvailable(state, card)
      )
        return false;
      const due = Date.parse(card.dueAt);
      return (
        Number.isFinite(due) &&
        due > now - 24 * 60 * 60 * 1000 &&
        due - card.dueReminderMinutes * 60_000 <= now &&
        dismissed[card.id] !== reminderSignature(card)
      );
    })
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
}
