import { useState } from "react";
import { AppLink } from "../ui/AppLink";
import { formatDate, formatTime, t } from "../i18n";
import { isCardAvailable, type AppState, type Card } from "../model";
import { Button } from "../ui/Button";

const weekButtonClass = "max-phone:min-h-11";

export function PlannerView({ state, onOpen }: { state: AppState; onOpen: (card: Card) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7,
  );
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
  const cards = state.cards
    .filter((card) => card.dueAt && isCardAvailable(state, card))
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 bg-white p-3.5 text-ink" aria-label={t("panels.planner")}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mx-0 mt-0 mb-1.5 text-[18px]">{t("panels.planner")}</h1>
          <p className="m-0 text-[12px] text-ink-subtle">{t("panels.plannerIntro")}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="secondary"
            size="lg"
            className={weekButtonClass}
            onClick={() => setWeekOffset((value) => value - 1)}
          >
            {t("panels.previousWeek")}
          </Button>
          <Button variant="secondary" size="lg" className={weekButtonClass} onClick={() => setWeekOffset(0)}>
            {t("panels.today")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className={weekButtonClass}
            onClick={() => setWeekOffset((value) => value + 1)}
          >
            {t("panels.nextWeek")}
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-col overflow-auto">
        {days.map((day) => (
          <section className="min-h-[76px] flex-none border-b border-line bg-white px-0 py-3" key={day.toDateString()}>
            <h2 className="mx-0 mt-0 mb-3 text-[14px] text-ink-subtle capitalize">
              {formatDate(day, { weekday: "short", day: "numeric", month: "long" })}
            </h2>
            {cards
              .filter((card) => new Date(card.dueAt!).toDateString() === day.toDateString())
              .map((card) => (
                <AppLink
                  className="mb-1.5 grid w-full gap-1 rounded-md border border-line bg-brand-soft p-2 text-left text-ink no-underline wrap-anywhere"
                  key={card.id}
                  href={`/c/${encodeURIComponent(card.id)}`}
                  onOpen={() => onOpen(card)}
                >
                  <strong>{card.name}</strong>
                  <small className="text-ink-subtle">
                    {state.boards.find((board) => board.id === card.boardId)?.name} ·{" "}
                    {formatTime(card.dueAt!, { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </AppLink>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}
