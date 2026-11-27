import { useState } from "react";
import { t, type MessageKey } from "../i18n";
import { type AppState, type Board, missingFields, type RequiredFields } from "../model";
import { LabelChip } from "../ui/LabelChip";
import { optionLabelClass } from "../dialogs/dialogLook";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select } from "../ui/Field";
import { SidePanel } from "../ui/Modal";
import { Hint } from "../ui/Hint";

type Flag = "description" | "members" | "startDate" | "dueDate" | "labels" | "checklists" | "checklistsDone";
const flags: Flag[] = ["description", "members", "startDate", "dueDate", "labels", "checklists", "checklistsDone"];
type Op = NonNullable<RequiredFields["descriptionRule"]>["op"];
const ops: Array<[Op | "", MessageKey]> = [
  ["", "required.opNone"],
  ["contains", "required.opContains"],
  ["equals", "required.opEquals"],
  ["starts-with", "required.opStartsWith"],
];

const groupClass = "m-0 grid min-w-0 gap-1.5 border-0 p-0";
const legendClass = "mb-1 p-0 text-[13px] font-semibold text-ink-subtle";
const optionClass = `${optionLabelClass} font-normal`;

/** Only what asks something of cards, or nothing; members and labels that are gone are dropped. */
function cleaned(rules: RequiredFields, memberIds: string[], labelIds: string[]): RequiredFields | undefined {
  const next: RequiredFields = {};
  for (const key of flags) if (rules[key]) next[key] = true;
  const members = rules.memberIds?.filter((id) => memberIds.includes(id));
  if (members?.length) next.memberIds = members;
  const labels = rules.labelIds?.filter((id) => labelIds.includes(id));
  if (labels?.length) next.labelIds = labels;
  const text = rules.descriptionRule?.text.trim();
  if (rules.descriptionRule && text) next.descriptionRule = { op: rules.descriptionRule.op, text };
  if (rules.checklistName?.trim()) next.checklistName = rules.checklistName.trim();
  if (Object.keys(next).length && rules.blockMoves) next.blockMoves = true;
  return Object.keys(next).length ? next : undefined;
}

/** The board's required fields: what every card must have, and whether an incomplete card may leave its list. */
export function RequiredFieldsPanel({
  state,
  board,
  onSave,
  onClose,
}: {
  state: AppState;
  board: Board;
  onSave: (rules: RequiredFields | undefined) => void;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<RequiredFields>(board.requiredFields ?? {});
  const [op, setOp] = useState<Op | "">(board.requiredFields?.descriptionRule?.op ?? "");
  const members = board.members ?? [];
  const labels = state.labels.filter((label) => label.boardId === board.id && !label.deleted);
  const change = (patch: Partial<RequiredFields>) => setRules((current) => ({ ...current, ...patch }));
  const toggle = (list: string[] | undefined, id: string) =>
    list?.includes(id) ? list.filter((item) => item !== id) : [...(list ?? []), id];
  const draft = cleaned(
    { ...rules, descriptionRule: op ? { op, text: rules.descriptionRule?.text ?? "" } : undefined },
    members.map((member) => member.id),
    labels.map((label) => label.id),
  );
  const incomplete = state.cards.filter(
    (card) => card.boardId === board.id && !card.deletedAt && missingFields(card, draft).length > 0,
  ).length;
  return (
    <SidePanel title={t("required.title")} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <Hint className="m-0">{t("required.hint")}</Hint>
        <fieldset className={groupClass}>
          <legend className={legendClass}>{t("required.everyCard")}</legend>
          {flags.map((flag) => (
            <label className={optionClass} key={flag}>
              <Checkbox checked={Boolean(rules[flag])} onChange={(event) => change({ [flag]: event.target.checked })} />
              {t(`required.${flag}`)}
            </label>
          ))}
        </fieldset>
        {members.length > 0 && (
          <fieldset className={groupClass}>
            <legend className={legendClass}>{t("required.specificMembers")}</legend>
            {members.map((member) => (
              <label className={optionClass} key={member.id}>
                <Checkbox
                  checked={Boolean(rules.memberIds?.includes(member.id))}
                  onChange={() => change({ memberIds: toggle(rules.memberIds, member.id) })}
                />
                {member.name}
              </label>
            ))}
          </fieldset>
        )}
        {labels.length > 0 && (
          <fieldset className={groupClass}>
            <legend className={legendClass}>{t("required.specificLabels")}</legend>
            {labels.map((label) => (
              <label className="flex cursor-pointer items-center gap-2.5" key={label.id}>
                <Checkbox
                  checked={Boolean(rules.labelIds?.includes(label.id))}
                  onChange={() => change({ labelIds: toggle(rules.labelIds, label.id) })}
                />
                <LabelChip label={label} />
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className={groupClass}>
          <legend className={legendClass}>{t("required.descriptionText")}</legend>
          <label className="grid gap-1 text-[13px]">
            {t("required.descriptionOp")}
            <Select value={op} onChange={(event) => setOp(event.target.value as Op | "")}>
              {ops.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </label>
          {op && (
            <Input
              value={rules.descriptionRule?.text ?? ""}
              onChange={(event) => change({ descriptionRule: { op, text: event.target.value } })}
              aria-label={t("required.descriptionTextField")}
            />
          )}
        </fieldset>
        <label className="grid gap-1 text-[13px] font-semibold text-ink-subtle">
          {t("required.checklistName")}
          <Input
            value={rules.checklistName ?? ""}
            onChange={(event) => change({ checklistName: event.target.value })}
          />
        </label>
        <label className={optionClass}>
          <Checkbox
            checked={Boolean(rules.blockMoves)}
            onChange={(event) => change({ blockMoves: event.target.checked })}
          />
          {t("required.blockMoves")}
        </label>
        <Hint className="m-0" role="status">
          {incomplete ? t("required.incompleteCards", { count: incomplete }) : t("required.allComplete")}
        </Hint>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="lg" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
