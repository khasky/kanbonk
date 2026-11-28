import { useMemo, useState } from "react";
import { liveComments } from "../model/comments";
import { type MessageKey, t } from "../i18n";
import type { AppState, Card } from "../model";
import {
  type DuplicatePair,
  findBoardDuplicates,
  type MatchLevel,
  type MatchReason,
  mergeParts,
  pairKey,
} from "../model/dedupe";
import { dialogListClass } from "../dialogs/dialogLook";
import { askConfirm } from "../ui/AskDialog";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";
import { RowActions } from "../ui/PanelRow";
import { Segmented, SegmentedTab } from "../ui/Segmented";

const levels: Array<[MatchLevel, MessageKey, MessageKey]> = [
  ["strict", "duplicates.strict", "duplicates.strictHint"],
  ["normal", "duplicates.normal", "duplicates.normalHint"],
  ["loose", "duplicates.loose", "duplicates.looseHint"],
];

const reasonNames: Record<MatchReason, MessageKey> = {
  same: "duplicates.reasonSame",
  order: "duplicates.reasonOrder",
  typo: "duplicates.reasonTypo",
  extra: "duplicates.reasonExtra",
  similar: "duplicates.reasonSimilar",
};

/** What a card holds, in a few words ("2 comments · 1 checklist"), so the pair can be compared at a glance. */
function contentNote(card: Card): string {
  const parts = [
    card.description.trim() && t("duplicates.hasDescription"),
    card.checklists.length && t("duplicates.checklists", { count: card.checklists.length }),
    liveComments(card.comments).length && t("duplicates.comments", { count: liveComments(card.comments).length }),
    card.attachments.length && t("duplicates.attachments", { count: card.attachments.length }),
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : t("duplicates.empty");
}

/** A Markdown link to a card that survives brackets in its name. */
const cardMarkdown = (card: Card) => `[${card.name.replace(/[[\]\\]/g, "\\$&")}](/c/${card.id})`;

/**
 * The board's cards that look like the same task, in pairs side by side with how and how closely they match. The
 * fuller card of a pair is kept by default; a pair can be swapped, merged after a confirmation that lists what moves,
 * or dismissed as not a duplicate.
 */
export function DuplicatesPanel({
  state,
  boardId,
  ignored,
  onIgnore,
  onMerge,
  onOpenCard,
  onClose,
}: {
  state: AppState;
  boardId: string;
  ignored: Set<string>;
  onIgnore: (key: string) => void;
  onMerge: (keepId: string, dropId: string, notes: { kept: string; dropped: string }) => void;
  onOpenCard: (card: Card) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<MatchLevel>("normal");
  const [sameList, setSameList] = useState(false);
  const [swapped, setSwapped] = useState<Set<string>>(new Set());
  const pairs = useMemo(
    () => findBoardDuplicates(state, boardId, { level, sameList, ignored }),
    [state, boardId, level, sameList, ignored],
  );
  const lists = new Map(state.lists.map((list) => [list.id, list.name]));

  const merge = async (keep: Card, drop: Card) => {
    const parts = mergeParts(state, keep, drop);
    const moving = [
      parts.description && t("duplicates.theDescription"),
      parts.checklists.length && t("duplicates.checklists", { count: parts.checklists.length }),
      liveComments(parts.comments).length && t("duplicates.comments", { count: liveComments(parts.comments).length }),
      parts.attachments.length && t("duplicates.attachments", { count: parts.attachments.length }),
      parts.labelIds.length && t("duplicates.labels", { count: parts.labelIds.length }),
      parts.memberIds.length && t("duplicates.members", { count: parts.memberIds.length }),
      parts.dates && t("duplicates.theDates"),
    ].filter((part): part is string => Boolean(part));
    const message = [
      moving.length ? t("duplicates.moves", { items: moving.join(", ") }) : t("duplicates.movesNothing"),
      t("duplicates.toTrash", { name: drop.name }),
    ].join(" ");
    if (
      await askConfirm({
        title: t("duplicates.mergeTitle", { drop: drop.name, keep: keep.name }),
        message,
        confirm: t("duplicates.merge"),
      })
    )
      onMerge(keep.id, drop.id, {
        kept: t("duplicates.mergedWith", { card: cardMarkdown(drop) }),
        dropped: t("duplicates.mergedInto", { card: cardMarkdown(keep) }),
      });
  };

  const side = (card: Card, kept: boolean) => (
    <div
      className={`grid content-start gap-1 rounded-md border p-2.5 ${kept ? "border-brand bg-brand-soft" : "border-line bg-white"}`}
    >
      <span className="text-[12px] font-bold text-ink-subtle">
        {kept ? t("duplicates.keep") : t("duplicates.mergeAway")}
      </span>
      <Button
        variant="link-quiet"
        className="justify-self-start text-left font-bold wrap-anywhere"
        onClick={() => onOpenCard(card)}
      >
        {card.name}
      </Button>
      <span className="text-[13px] text-ink-subtle">{lists.get(card.listId)}</span>
      <span className="text-[13px] text-ink-subtle">{contentNote(card)}</span>
    </div>
  );

  const view = (pair: DuplicatePair) => {
    const key = pairKey(pair.keep.id, pair.drop.id);
    const [keep, drop] = swapped.has(key) ? [pair.drop, pair.keep] : [pair.keep, pair.drop];
    return (
      <li key={key} className="grid gap-2 rounded-md border border-line p-3" aria-label={`${keep.name} · ${drop.name}`}>
        <span className="text-[13px] text-ink-subtle">
          <strong className="text-ink">{t(reasonNames[pair.reason])}</strong> · {Math.round(pair.score * 100)}%
        </span>
        <div className="grid grid-cols-2 gap-2 max-phone:grid-cols-1">
          {side(keep, true)}
          {side(drop, false)}
        </div>
        <RowActions>
          <Button variant="primary" onClick={() => void merge(keep, drop)}>
            {t("duplicates.mergeButton")}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setSwapped((current) => {
                const next = new Set(current);
                if (!next.delete(key)) next.add(key);
                return next;
              })
            }
          >
            {t("duplicates.swap")}
          </Button>
          <Button variant="secondary" onClick={() => onIgnore(key)}>
            {t("duplicates.notDuplicate")}
          </Button>
        </RowActions>
      </li>
    );
  };

  return (
    <SidePanel title={t("duplicates.title")} width="wide" onClose={onClose}>
      <div className={dialogListClass}>
        <Hint className="m-0">{t("duplicates.hint")}</Hint>
        <Segmented label={t("duplicates.level")} className="self-start">
          {levels.map(([value, name]) => (
            <SegmentedTab key={value} selected={level === value} onClick={() => setLevel(value)}>
              {t(name)}
            </SegmentedTab>
          ))}
        </Segmented>
        <Hint className="m-0">{t(levels.find(([value]) => value === level)?.[2] ?? "duplicates.normalHint")}</Hint>
        <label className="flex items-center gap-2">
          <Checkbox checked={sameList} onChange={(event) => setSameList(event.target.checked)} />
          {t("duplicates.sameList")}
        </label>
        <p className="m-0 font-semibold" role="status">
          {pairs.length ? t("duplicates.found", { count: pairs.length }) : t("duplicates.none")}
        </p>
        <ul className="m-0 grid list-none gap-3 p-0">{pairs.slice(0, 100).map(view)}</ul>
      </div>
    </SidePanel>
  );
}
