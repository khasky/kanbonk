import { useState } from "react";
import { isCardAvailable, type AppState, type Card } from "../model";

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
    <section className="planner-view" aria-label="Planner">
      <header>
        <div>
          <h1>Planner</h1>
          <p>Cards with due dates from your boards and inbox.</p>
        </div>
        <div>
          <button onClick={() => setWeekOffset((value) => value - 1)}>Previous week</button>
          <button onClick={() => setWeekOffset(0)}>Today</button>
          <button onClick={() => setWeekOffset((value) => value + 1)}>Next week</button>
        </div>
      </header>
      <div className="planner-week">
        {days.map((day) => (
          <section className="planner-day" key={day.toDateString()}>
            <h2>{day.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" })}</h2>
            {cards
              .filter((card) => new Date(card.dueAt!).toDateString() === day.toDateString())
              .map((card) => (
                <button className="planner-card" key={card.id} onClick={() => onOpen(card)}>
                  <strong>{card.name}</strong>
                  <small>
                    {state.boards.find((board) => board.id === card.boardId)?.name} ·{" "}
                    {new Date(card.dueAt!).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    {card.completed ? " · done" : ""}
                  </small>
                </button>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}
