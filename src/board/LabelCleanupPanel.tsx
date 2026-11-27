import { useState } from "react";
import { t } from "../i18n";
import { type AppState, duplicateLabels, type Label, labelUsage, unusedLabels } from "../model";
import { readableTextColor } from "../model/labelColors";
import { dialogListClass } from "../dialogs/dialogLook";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { SidePanel } from "../ui/Modal";

const sectionClass = "mb-3 grid gap-1.5";
const titleClass = "m-0 text-[14px]";
const emptyClass = "m-0 text-[13px] text-ink-subtle";

function LabelChip({ label }: { label: Label }) {
  const color = label.color || "#dfe1e6";
  return (
    <span
      className="flex min-h-7 min-w-12 items-center rounded-sm px-2.5 font-semibold wrap-anywhere"
      style={{ background: color, color: readableTextColor(color) }}
    >
      {label.name || t("labelCleanup.unnamed")}
    </span>
  );
}

/** The board's unused labels to delete, its duplicate labels to merge, and how many cards carry each label. */
export function LabelCleanupPanel({
  state,
  boardId,
  onDelete,
  onMerge,
  onClose,
}: {
  state: AppState;
  boardId: string;
  onDelete: (labelIds: string[]) => void;
  onMerge: (keepId: string, dropIds: string[]) => void;
  onClose: () => void;
}) {
  const unused = unusedLabels(state, boardId);
  const duplicates = duplicateLabels(state, boardId);
  const usage = labelUsage(state, boardId);
  // Labels left unchecked; every unused label starts checked.
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  // The label to keep in each duplicate group, by the group's first label; the most used one otherwise.
  const [keep, setKeep] = useState<Record<string, string>>({});
  const checked = unused.filter((label) => !unchecked.has(label.id));
  return (
    <SidePanel title={t("labelCleanup.title")} onClose={onClose}>
      <div className={dialogListClass}>
        <Hint>{t("labelCleanup.hint")}</Hint>
        <section className={sectionClass} aria-label={t("labelCleanup.unused")}>
          <h3 className={titleClass}>{t("labelCleanup.unused")}</h3>
          <Hint>{t("labelCleanup.unusedHint")}</Hint>
          {unused.length ? (
            <>
              {unused.map((label) => (
                <label key={label.id} className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={!unchecked.has(label.id)}
                    onChange={() =>
                      setUnchecked((current) => {
                        const next = new Set(current);
                        if (!next.delete(label.id)) next.add(label.id);
                        return next;
                      })
                    }
                  />
                  <LabelChip label={label} />
                </label>
              ))}
              <Button
                variant="danger"
                className="justify-self-start"
                disabled={!checked.length}
                onClick={() => onDelete(checked.map((label) => label.id))}
              >
                {t("labelCleanup.deleteChecked")}
              </Button>
            </>
          ) : (
            <p className={emptyClass}>{t("labelCleanup.noUnused")}</p>
          )}
        </section>
        <section className={sectionClass} aria-label={t("labelCleanup.duplicates")}>
          <h3 className={titleClass}>{t("labelCleanup.duplicates")}</h3>
          <Hint>{t("labelCleanup.duplicatesHint")}</Hint>
          {duplicates.length ? (
            duplicates.map((group) => {
              const groupId = group[0].label.id;
              const kept = group.some((usage) => usage.label.id === keep[groupId]) ? keep[groupId] : groupId;
              return (
                <fieldset key={groupId} className="m-0 grid gap-1.5 rounded-md border border-line p-2">
                  {group.map((usage) => (
                    <label key={usage.label.id} className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="radio"
                        name={`keep-${groupId}`}
                        checked={usage.label.id === kept}
                        aria-label={t("labelCleanup.keep", { name: usage.label.name })}
                        onChange={() => setKeep((current) => ({ ...current, [groupId]: usage.label.id }))}
                      />
                      <LabelChip label={usage.label} />
                      <small className="text-ink-muted">{t("labelCleanup.cards", { count: usage.cards })}</small>
                    </label>
                  ))}
                  <Button
                    variant="secondary"
                    className="justify-self-start"
                    onClick={() =>
                      onMerge(
                        kept,
                        group.map((usage) => usage.label.id).filter((id) => id !== kept),
                      )
                    }
                  >
                    {t("labelCleanup.merge")}
                  </Button>
                </fieldset>
              );
            })
          ) : (
            <p className={emptyClass}>{t("labelCleanup.noDuplicates")}</p>
          )}
        </section>
        <section className={sectionClass} aria-label={t("labelCleanup.usage")}>
          <h3 className={titleClass}>{t("labelCleanup.usage")}</h3>
          {usage.length ? (
            <ul className="m-0 grid list-none gap-1 p-0">
              {usage.map((item) => (
                <li key={item.label.id} className="flex items-center gap-2.5">
                  <LabelChip label={item.label} />
                  <span className="text-[13px] text-ink-subtle">
                    {t("labelCleanup.cards", { count: item.cards })}
                    {item.inRules && ` · ${t("labelCleanup.inRules")}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={emptyClass}>{t("labelCleanup.noLabels")}</p>
          )}
        </section>
      </div>
    </SidePanel>
  );
}
