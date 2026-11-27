import { t, type MessageKey } from "../i18n";
import type { AppState, Board, CardAgingMode, CardDoneSettings } from "../model";
import { inboxBoardId } from "../model/inbox";
import { dialogListClass, optionLabelClass } from "../dialogs/dialogLook";
import { Checkbox, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";

const optionClass = `${optionLabelClass} font-normal`;
const modes: Array<[CardAgingMode, MessageKey]> = [
  ["regular", "cardAging.modeRegular"],
  ["pirate", "cardAging.modePirate"],
];

const doneFlags: Array<[keyof CardDoneSettings, MessageKey]> = [
  ["checkItems", "cardDone.checkItems"],
  ["clearDue", "cardDone.clearDue"],
  ["clearLabels", "cardDone.clearLabels"],
  ["clearMembers", "cardDone.clearMembers"],
  ["trash", "cardDone.trash"],
];

/** The board's settings; each change applies right away. */
export function BoardSettingsPanel({
  state,
  board,
  onCardAging,
  onCardDone,
  onClose,
}: {
  state: AppState;
  board: Board;
  /** Turns card aging on in a mode, or off with undefined. */
  onCardAging: (mode: CardAgingMode | undefined) => void;
  /** What finishing a card does; undefined when it only marks the card done. */
  onCardDone: (settings: CardDoneSettings | undefined) => void;
  onClose: () => void;
}) {
  const done = board.cardDone ?? {};
  const changeDone = (change: Partial<CardDoneSettings>) => {
    const next = Object.fromEntries(
      Object.entries({ ...done, ...change }).filter(([, value]) => value !== undefined && value !== false),
    ) as CardDoneSettings;
    onCardDone(Object.keys(next).length ? next : undefined);
  };
  const boards = state.boards.filter((item) => !item.deletedAt && item.id !== inboxBoardId);
  const doneListId = state.lists.some((list) => list.id === done.listId && !list.deletedAt) ? done.listId : undefined;
  return (
    <SidePanel title={t("cardAging.settingsTitle")} onClose={onClose}>
      <section className={dialogListClass}>
        <h3 className="m-0 text-[16px]">{t("cardAging.title")}</h3>
        <label className={optionClass}>
          <Checkbox
            checked={Boolean(board.cardAging)}
            onChange={(event) => onCardAging(event.target.checked ? "regular" : undefined)}
          />
          {t("cardAging.enable")}
        </label>
        {board.cardAging && (
          <fieldset className="m-0 grid gap-1.5 border-0 p-0 pl-6">
            <legend className="mb-1 p-0 text-[13px] font-semibold text-ink-subtle">{t("cardAging.mode")}</legend>
            {modes.map(([mode, label]) => (
              <label className={optionClass} key={mode}>
                <Checkbox
                  type="radio"
                  name="card-aging-mode"
                  checked={board.cardAging === mode}
                  onChange={() => onCardAging(mode)}
                />
                {t(label)}
              </label>
            ))}
          </fieldset>
        )}
        <Hint>{t("cardAging.hint")}</Hint>
      </section>
      <section className={`${dialogListClass} mt-5`}>
        <h3 className="m-0 text-[16px]">{t("cardDone.title")}</h3>
        <label className="grid gap-1 font-semibold">
          {t("cardDone.moveTo")}
          <Select
            size="sm"
            value={doneListId ?? ""}
            disabled={done.trash}
            onChange={(event) => changeDone({ listId: event.target.value || undefined })}
          >
            <option value="">{t("cardDone.stayInList")}</option>
            {boards.map((item) => (
              <optgroup key={item.id} label={item.name}>
                {state.lists
                  .filter((list) => list.boardId === item.id && !list.deletedAt)
                  .sort((a, b) => a.position - b.position)
                  .map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </label>
        {doneListId && !done.trash && (
          <>
            <label className="grid gap-1 font-semibold">
              {t("cardDone.position")}
              <Select
                size="sm"
                value={done.top ? "top" : "bottom"}
                onChange={(event) => changeDone({ top: event.target.value === "top" })}
              >
                <option value="top">{t("cardDone.top")}</option>
                <option value="bottom">{t("cardDone.bottom")}</option>
              </Select>
            </label>
            <label className={optionClass}>
              <Checkbox
                checked={Boolean(done.markInList)}
                onChange={(event) => changeDone({ markInList: event.target.checked })}
              />
              {t("cardDone.markInList")}
            </label>
          </>
        )}
        {doneFlags.map(([key, label]) => (
          <label className={optionClass} key={key}>
            <Checkbox checked={Boolean(done[key])} onChange={(event) => changeDone({ [key]: event.target.checked })} />
            {t(label)}
          </label>
        ))}
        <label className={optionClass}>
          <Checkbox checked={!done.quiet} onChange={(event) => changeDone({ quiet: !event.target.checked })} />
          {t("cardDone.cheer")}
        </label>
        <Hint>{t("cardDone.hint")}</Hint>
      </section>
    </SidePanel>
  );
}
