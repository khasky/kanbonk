import { useState } from "react";
import { CardPicker } from "../ui/CardPicker";
import type { relatedCards } from "../model/links";
import { type AppState, type Card, isCardAvailable } from "../model";
import {
  canConnect,
  cardConnections,
  type Connection,
  type ConnectionGroup,
  type ConnectionKind,
  connectionGroups,
  epicOf,
  groupLink,
  subCardProgress,
} from "../model/connections";
import { t } from "../i18n";
import { tNodes } from "../i18n/nodes";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { ProgressBar } from "../ui/ProgressBar";
import { detailSectionClass, inlineFormClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

/** A linked card's name, as a blue text link. */
const cardLinkClass = "py-0.5";
/** The small "Epic" tag next to an epic's name. */
export const epicBadgeClass =
  "shrink-0 rounded-sm bg-[#dfd8fd] px-1.5 text-[11px] font-bold tracking-wide text-[#5e4db2] uppercase";

/**
 * Everything the card is connected to, as in Jira's issue links: its epic and parent, sub-cards with their progress,
 * the cards it blocks and waits on, related cards and duplicates. Each can be opened or removed, and **Link…** adds
 * any of them; the card itself can be made an epic.
 */
export function CardLinks({
  card,
  state,
  allowSubCards,
  onChange,
  onCreateSubCard,
  onNavigateCard,
  onConnect,
  onDisconnect,
}: {
  card: Card;
  state: AppState;
  /** Sub-cards can be created here: not in the inbox. */
  allowSubCards: boolean;
  onChange: (change: (card: Card) => Card) => void;
  onCreateSubCard: (name: string) => void;
  onNavigateCard: (target: Card) => void;
  onConnect: (kind: ConnectionKind, from: string, to: string) => void;
  onDisconnect: (connection: Connection) => void;
}) {
  const [subCardName, setSubCardName] = useState("");
  const [linking, setLinking] = useState<ConnectionGroup>();
  const groups = cardConnections(state, card.id);
  const progress = subCardProgress(state, card.id);
  const epic = epicOf(state, card);
  const boards = new Map(state.boards.map((board) => [board.id, board.name]));
  const addSubCard = () => {
    onCreateSubCard(subCardName.trim());
    setSubCardName("");
  };
  return (
    <section className={detailSectionClass} aria-label={t("links.title")}>
      <DetailTitle icon="dependency">{t("links.title")}</DetailTitle>
      <div className="grid gap-2.5">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(card.isEpic)}
            onChange={(event) => onChange((item) => ({ ...item, isEpic: event.target.checked || undefined }))}
          />
          {t("links.makeEpic")}
        </label>
        {epic && epic.id !== card.parentCardId && (
          <p className="m-0">
            {tNodes("links.inEpic", {
              card: (
                <Button variant="link-quiet" className={cardLinkClass} onClick={() => onNavigateCard(epic)}>
                  {epic.name}
                </Button>
              ),
            })}
          </p>
        )}
        {progress.total > 0 && (
          <ProgressBar
            done={progress.done}
            total={progress.total}
            label={t("links.progressLabel")}
            caption={t("links.progress", progress)}
          />
        )}
        {connectionGroups.map(
          (group) =>
            groups[group].length > 0 && (
              <div key={group} className="grid gap-0.5">
                <strong className="text-[13px] text-ink-subtle">{t(`links.${group}`)}</strong>
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {groups[group].map(({ card: other, connection }) => (
                    <li key={other.id} className="flex items-center gap-1.5">
                      <Button
                        variant="link-quiet"
                        className={`${cardLinkClass} min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap ${other.doneAt ? "line-through" : ""}`}
                        onClick={() => onNavigateCard(other)}
                      >
                        {other.name}
                      </Button>
                      {other.isEpic && <span className={epicBadgeClass}>{t("links.epic")}</span>}
                      {other.doneAt && <span className="text-[12px] text-success">{t("links.done")}</span>}
                      {other.boardId !== card.boardId && (
                        <span className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-ink-subtle">
                          {t("links.onBoard", { board: boards.get(other.boardId) ?? "" })}
                        </span>
                      )}
                      <Button
                        variant="icon"
                        className="ml-auto"
                        aria-label={t("links.remove", { name: other.name })}
                        onClick={() => onDisconnect(connection)}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
        {allowSubCards && (
          <div className={inlineFormClass}>
            <Input
              size="sm"
              className="min-w-0 flex-1"
              value={subCardName}
              onChange={(event) => setSubCardName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && subCardName.trim()) addSubCard();
              }}
              placeholder={t("card.newSubCard")}
              aria-label={t("card.newSubCardTitle")}
            />
            <Button variant="secondary" disabled={!subCardName.trim()} onClick={addSubCard}>
              {t("common.add")}
            </Button>
          </div>
        )}
        {linking ? (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Select
                size="sm"
                aria-label={t("links.linkType")}
                value={linking}
                onChange={(event) => setLinking(event.target.value as ConnectionGroup)}
              >
                {connectionGroups.map((group) => (
                  <option key={group} value={group}>
                    {t(`links.${group}`)}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => setLinking(undefined)}>
                {t("common.cancel")}
              </Button>
            </div>
            <CardPicker
              label={t("links.findCard")}
              candidates={state.cards.filter((item) => canConnect(state, ...groupLink(linking, card.id, item.id)))}
              describe={(item) =>
                item.boardId === card.boardId ? item.name : `${item.name} · ${boards.get(item.boardId) ?? ""}`
              }
              onPick={(item) => {
                onConnect(...groupLink(linking, card.id, item.id));
                setLinking(undefined);
              }}
            />
          </div>
        ) : (
          <Button variant="secondary" className="justify-self-start" onClick={() => setLinking("blockedBy")}>
            {t("links.link")}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Trello cards linked from this card's description, comments or attachments. */
export function RelatedCards({
  related,
  state,
  onNavigateCard,
}: {
  related: ReturnType<typeof relatedCards>;
  state: AppState;
  onNavigateCard: (target: Card) => void;
}) {
  return (
    <section className={detailSectionClass}>
      <DetailTitle icon="link">{t("card.linkedCards")}</DetailTitle>
      {related.map((link, index) => (
        <div className="flex items-center gap-2.5 border-b border-line py-2 wrap-anywhere" key={`${link.url}-${index}`}>
          <span className="min-w-[70px] text-[12px] text-ink-muted">{link.source}</span>
          {link.target && isCardAvailable(state, link.target) ? (
            <Button variant="link-quiet" onClick={() => onNavigateCard(link.target!)}>
              {link.target.name}
            </Button>
          ) : link.target ? (
            <small className="text-danger">{t("card.cardUnavailableName", { name: link.target.name })}</small>
          ) : (
            <small className="text-danger">{t("card.cardNotImported", { url: link.url })}</small>
          )}
        </div>
      ))}
    </section>
  );
}
