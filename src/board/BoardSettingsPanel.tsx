import { t, type MessageKey } from "../i18n";
import type { Board, CardAgingMode } from "../model";
import { dialogListClass, optionLabelClass } from "../dialogs/dialogLook";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";

const optionClass = `${optionLabelClass} font-normal`;
const modes: Array<[CardAgingMode, MessageKey]> = [
  ["regular", "cardAging.modeRegular"],
  ["pirate", "cardAging.modePirate"],
];

/** The board's settings; each change applies right away. */
export function BoardSettingsPanel({
  board,
  onCardAging,
  onClose,
}: {
  board: Board;
  /** Turns card aging on in a mode, or off with undefined. */
  onCardAging: (mode: CardAgingMode | undefined) => void;
  onClose: () => void;
}) {
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
                <input
                  type="radio"
                  name="card-aging-mode"
                  className="accent-brand"
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
    </SidePanel>
  );
}
