import { SidePanel } from "../ui/Modal";
import { useState } from "react";
import type { ActivityEvent, AppState, Card } from "../model";
import { kanbonkCardForUrl } from "../model/links";
import { Button } from "../ui/Button";
import { MarkdownText } from "../ui/MarkdownText";
import { PanelRow, PanelRowNote, PanelRowText } from "../ui/PanelRow";
import { formatDateTime, t } from "../i18n";
import { Segmented, SegmentedTab } from "../ui/Segmented";

// A comment's summary is "Author: text" ("Author: commented on card “Name”: text" from a Trello import); the text is
// Markdown, so it is shown apart from the plain heading.
const commentHeading = /^.*?: /;
const trelloCommentHeading = /^.*?: commented on card “.*?”: /;

function splitComment(item: ActivityEvent): { heading: string; text: string } | undefined {
  const heading = (item.deviceId === "trello" ? trelloCommentHeading : commentHeading).exec(item.summary)?.[0];
  return heading ? { heading: heading.trimEnd(), text: item.summary.slice(heading.length) } : undefined;
}

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
      <div className="border-b border-line py-3.5">
        <Segmented label={t("board.activity")}>
          <SegmentedTab
            selected={filter === "all"}
            onClick={() => {
              setFilter("all");
              setLimit(50);
            }}
          >
            {t("board.all")}
          </SegmentedTab>
          <SegmentedTab
            selected={filter === "comment"}
            onClick={() => {
              setFilter("comment");
              setLimit(50);
            }}
          >
            {t("board.comments")}
          </SegmentedTab>
        </Segmented>
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
