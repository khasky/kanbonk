import { epicBadgeClass } from "../card/CardRelations";
import { liveComments } from "../model/comments";
import { memo } from "react";
import { CardCover } from "../card/CardCover";
import { ApprovalChip } from "../card/ApprovalChip";
import { PriorityChip, priorityName } from "../card/PriorityPicker";
import { useMyMember } from "../lib/identity";
import { readableTextColor } from "../model/labelColors";
import {
  agingWeeks,
  type Card,
  type CardAge,
  type CardAgingMode,
  type Label,
  type Member,
  type MissingField,
  waitsOn,
} from "../model";
import { missingFieldText } from "../model/requiredFieldsText";
import { AppLink } from "../ui/AppLink";
import { Icon } from "../ui/Icon";
import { formatDate, t } from "../i18n";
import { useViewPreferences } from "../lib/viewPreferences";
import { viewAge, viewedTitle } from "../model/viewText";
import { useLocale } from "../i18n/nodes";
import { endDrag, startDrag } from "./dragState";
import { tileClass, tileMetaClass, tileMetaIconClass, tileMetaItemClass, tileNameClass } from "./tileLook";

/** A thing the card lacks under its board's required fields, as a warning on the tile and in the card. */
export const missingBadgeClass =
  "inline-flex items-center gap-1 rounded-[3px] bg-[#fff7d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#6b4f00]";

/** The red "Blocked" tag of a card waiting on an unfinished card. */
const blockedBadgeClass =
  "inline-flex items-center gap-1 rounded-[3px] bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger";

export interface TileActions {
  open: (id: string) => void;
}

/** One card on a board; memoised so typing or editing elsewhere does not re-render thousands of tiles. */
export const CardTile = memo(function CardTile({
  card: item,
  labels,
  members,
  parentName,
  subCardCount = 0,
  subCardsDone = 0,
  blockers = 0,
  linkCount = 0,
  epicName,
  viewCount = 0,
  lastViewedAt,
  missing,
  age,
  agingMode,
  mirrorCount = 0,
  actions,
  hidden = false,
}: {
  card: Card;
  labels: Map<string, Label>;
  members?: Member[];
  parentName?: string;
  /** Sub-cards at every level below the card, and how many of them are done. */
  subCardCount?: number;
  subCardsDone?: number;
  /** Unfinished cards the card waits on, all its links, and the epic above it (see model/connections). */
  blockers?: number;
  linkCount?: number;
  epicName?: string;
  /** Views of the card by everyone, and when it was last opened (see model/views). */
  viewCount?: number;
  lastViewedAt?: string;
  /** What the card lacks under its board's required fields. */
  missing?: MissingField[];
  /** How long the card has gone without a change, on a board that ages its cards; see model/cardAging. */
  age?: CardAge;
  agingMode?: CardAgingMode;
  /** How many other cards mirror this one. */
  mirrorCount?: number;
  actions: TileActions;
  /** Hidden while it is dragged to another place, which the board shows instead. */
  hidden?: boolean;
}) {
  // A memoised tile still renders again in a newly chosen language.
  useLocale();
  const viewBadge = useViewPreferences().showBadges && viewCount > 0;
  const me = useMyMember(members);
  return (
    <AppLink
      href={`/c/${encodeURIComponent(item.id)}`}
      className={tileClass}
      style={hidden ? { display: "none" } : undefined}
      data-card-id={item.id}
      data-aging={age ? agingMode : undefined}
      data-age={age || undefined}
      title={age ? t("cardAging.agedTitle", { count: agingWeeks[age - 1] }) : undefined}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/kanbonk-card", item.id);
        startDrag(event.currentTarget, { kind: "card", id: item.id });
      }}
      onDragEnd={endDrag}
      onOpen={() => actions.open(item.id)}
    >
      <CardCover card={item} />
      {(item.priority || item.approvals?.length || item.labelIds.some((id) => labels.get(id)?.color)) && (
        <span className="flex flex-wrap gap-1">
          <ApprovalChip card={item} mine={waitsOn(item, me?.id)} className="px-2 py-0.5 text-[11px]" />
          {item.priority && (
            <span title={t("priority.tileTitle", { priority: priorityName(item.priority) })}>
              <PriorityChip priority={item.priority} className="px-2 py-0.5 text-[11px]" />
            </span>
          )}
          {item.labelIds.map((id) => {
            const label = labels.get(id);
            return (
              label?.color && (
                <span
                  key={id}
                  className="min-w-10 rounded-[3px] px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: label.color, color: readableTextColor(label.color) }}
                >
                  {label.name}
                </span>
              )
            );
          })}
        </span>
      )}
      <span className={tileNameClass}>
        {item.doneAt && (
          <span className="mr-1 inline-grid size-4 place-items-center rounded-full bg-success align-[-2px] text-white">
            <Icon name="check" className="size-3" />
            <span className="sr-only">{t("cardDone.tileTitle")}</span>
          </span>
        )}
        {item.name}
      </span>
      {(item.isEpic || blockers > 0) && (
        <span className="flex flex-wrap gap-1">
          {item.isEpic && <span className={epicBadgeClass}>{t("links.epic")}</span>}
          {blockers > 0 && (
            <span className={blockedBadgeClass} title={t("links.blockedBadge", { count: blockers })}>
              <Icon name="dependency" className="size-3.5 flex-none" />
              {t("graph.statusBlocked")}
            </span>
          )}
        </span>
      )}
      {item.isTemplate && (
        <span className="self-start rounded-[3px] bg-line px-[5px] py-0.5 text-[11px] font-bold text-ink-subtle">
          {t("board.template")}
        </span>
      )}
      {parentName && (
        <span className="truncate text-[12px] opacity-75" title={t("board.parentCard")}>
          ↳ {parentName}
        </span>
      )}
      {epicName && epicName !== parentName && (
        <span className="truncate text-[12px] opacity-75" title={t("links.epic")}>
          {t("links.inEpic", { card: epicName })}
        </span>
      )}
      {missing && missing.length > 0 && (
        <span className="flex flex-wrap gap-1" aria-label={t("required.missing")}>
          {missing
            .map((entry) =>
              missingFieldText(
                entry,
                (id) => labels.get(id)?.name ?? members?.find((member) => member.id === id)?.name,
              ),
            )
            .map((text) => (
              <span key={text} className={missingBadgeClass}>
                <Icon name="alert" className="size-3.5 flex-none" />
                {text}
              </span>
            ))}
        </span>
      )}
      {(item.memberIds ?? []).length > 0 && (
        <span className="flex flex-wrap gap-1 self-end" aria-label={t("board.cardMembers")}>
          {(item.memberIds ?? []).map((id) => {
            const member = members?.find((entry) => entry.id === id);
            return (
              member && (
                <span
                  key={id}
                  className="grid h-6 w-6 place-items-center rounded-[50%] bg-line text-[10px] font-bold text-ink"
                  title={member.name}
                >
                  {member.name.slice(0, 2).toUpperCase()}
                </span>
              )
            );
          })}
        </span>
      )}
      {item.description ||
      item.dueAt ||
      item.attachments.length ||
      liveComments(item.comments).length ||
      item.checklists.length ||
      subCardCount ||
      linkCount ||
      mirrorCount ||
      viewBadge ? (
        <span className={tileMetaClass}>
          {mirrorCount > 0 && (
            <span className={tileMetaItemClass} title={t("mirrors.tileTitle", { count: mirrorCount })}>
              <Icon name="mirror" className={tileMetaIconClass} />
            </span>
          )}
          {item.description && <Icon name="text" className={tileMetaIconClass} />}
          {item.dueAt && (
            <span className={tileMetaItemClass}>
              <Icon name="clock" className={tileMetaIconClass} />
              {formatDate(item.dueAt)}
            </span>
          )}
          {item.attachments.length > 0 && (
            <span className={tileMetaItemClass}>
              <Icon name="clip" className={tileMetaIconClass} />
              {item.attachments.length}
            </span>
          )}
          {liveComments(item.comments).length > 0 && (
            <span className={tileMetaItemClass}>
              <Icon name="message" className={tileMetaIconClass} />
              {liveComments(item.comments).length}
            </span>
          )}
          {subCardCount > 0 && (
            <span
              className={tileMetaItemClass}
              title={t("links.progressBadge", { done: subCardsDone, total: subCardCount })}
            >
              <Icon name="sub-cards" className={tileMetaIconClass} />
              {subCardsDone}/{subCardCount}
            </span>
          )}
          {linkCount > 0 && (
            <span className={tileMetaItemClass} title={t("links.connectionsBadge", { count: linkCount })}>
              <Icon name="link" className={tileMetaIconClass} />
              {linkCount}
            </span>
          )}
          {item.checklists.map((checklist) => (
            <span key={checklist.id} className={tileMetaItemClass}>
              <Icon name="check-square" className={tileMetaIconClass} />
              {checklist.items.filter((entry) => entry.checked).length}/{checklist.items.length}
            </span>
          ))}
          {viewBadge && (
            <span className={tileMetaItemClass} title={viewedTitle(viewCount, lastViewedAt)}>
              <Icon name="eye" className={tileMetaIconClass} />
              {viewCount}
              {lastViewedAt && ` · ${viewAge(lastViewedAt)}`}
            </span>
          )}
        </span>
      ) : null}
    </AppLink>
  );
});
