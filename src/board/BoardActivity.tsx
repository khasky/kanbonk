import { SidePanel } from "../ui/Modal";
import { useState } from "react";
import type { ActivityEvent, AppState, Card } from "../model";
import { kanbonkCardForUrl } from "../model/links";
import { Button } from "../ui/Button";
import { MarkdownText } from "../ui/MarkdownText";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";
import { formatDateTime, t } from "../i18n";

// A comment's summary is "Author: text" ("Author: commented on card “Name”: text" from a Trello import); the text is
// Markdown, so it is shown apart from the plain heading.
const commentHeading = /^.*?: /;
const trelloCommentHeading = /^.*?: commented on card “.*?”: /;

function splitComment(item: ActivityEvent): { heading: string; text: string } | undefined {
  const heading = (item.deviceId === "trello" ? trelloCommentHeading : commentHeading).exec(item.summary)?.[0];
  return heading ? { heading: heading.trimEnd(), text: item.summary.slice(heading.length) } : undefined;
}

const filterClass =
  "rounded-sm border-0 bg-surface-sunken px-3 py-2 text-ink aria-pressed:bg-brand-soft aria-pressed:font-bold aria-pressed:text-brand";

export function BoardActivity({
  state,
  boardId,
  onClose,
  onOpenCard,
}: {
  state: AppState;
  boardId: string;
  onClose: () => void;
  onOpenCard: (card: Card) => void;
}) {
  const [filter, setFilter] = useState<"all" | "comment">("all");
  const [limit, setLimit] = useState(50);
  const entries = (state.activity ?? [])
    .filter(
      (item) =>
        (item.boardId === boardId || item.previousBoardId === boardId) &&
        (filter === "all" || item.category === "comment"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const cardForUrl = (url: string) => kanbonkCardForUrl(url, state);
  const openCard = (card: Card) => {
    onOpenCard(card);
    onClose();
  };
  return (
    <SidePanel title={t("board.activity")} label={t("board.boardActivity")} onClose={onClose}>
      <div className="flex gap-2 border-b border-line py-3.5">
        <button
          className={filterClass}
          aria-pressed={filter === "all"}
          onClick={() => {
            setFilter("all");
            setLimit(50);
          }}
        >
          {t("board.all")}
        </button>
        <button
          className={filterClass}
          aria-pressed={filter === "comment"}
          onClick={() => {
            setFilter("comment");
            setLimit(50);
          }}
        >
          {t("board.comments")}
        </button>
      </div>
      {entries.length ? (
        entries.slice(0, limit).map((item) => {
          const card = item.entityKind === "card" ? state.cards.find((entry) => entry.id === item.entityId) : undefined;
          const comment = item.category === "comment" ? splitComment(item) : undefined;
          return (
            <PanelRow key={item.id}>
              <PanelRowText>
                {comment ? (
                  <>
                    <strong className="font-normal wrap-anywhere">{comment.heading}</strong>
                    <MarkdownText text={comment.text} localCardForUrl={cardForUrl} onNavigateCard={openCard} />
                  </>
                ) : (
                  <strong className="font-normal wrap-anywhere whitespace-pre-wrap">{item.summary}</strong>
                )}
                <PanelRowNote>{formatDateTime(item.createdAt)}</PanelRowNote>
              </PanelRowText>
              {card && (
                <Button variant="secondary" className="flex-none" onClick={() => openCard(card)}>
                  {t("board.open")}
                </Button>
              )}
            </PanelRow>
          );
        })
      ) : (
        <p className="text-ink-muted">{t("board.noActivity")}</p>
      )}
      {entries.length > limit && (
        <Button variant="secondary" size="lg" className="mt-3.5 w-full" onClick={() => setLimit((value) => value + 50)}>
          {t("board.showMore")}
        </Button>
      )}
    </SidePanel>
  );
}
