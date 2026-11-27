import { askConfirm } from "../ui/AskDialog";
import { SidePanel } from "../ui/Modal";
import { useState } from "react";
import type { AppState, AutomationRule, Board } from "../model";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowText } from "../ui/PanelRow";
import { Input, Select } from "../ui/Field";
import { type MessageKey, t } from "../i18n";

const labelClass = "grid gap-[5px]";

type Trigger = NonNullable<AutomationRule["trigger"]>;
const approvalTriggers: Trigger[] = ["approved", "declined"];

/** How a due-date rule reads in the list of rules, by its lead time in minutes. */
const dueLeads: Record<number, MessageKey> = {
  0: "board.atDueTime",
  60: "board.hourBeforeDue",
  1440: "board.dayBeforeDue",
  10080: "board.weekBeforeDue",
};

export function AutomationPanel({
  board,
  state,
  onClose,
  onAdd,
  onRemove,
}: {
  board: Board;
  state: AppState;
  onClose: () => void;
  onAdd: (
    listId: string,
    action: AutomationRule["action"],
    labelId: string,
    trigger: Trigger,
    name: string,
    leadMinutes: number,
    targetListId: string,
  ) => void;
  onRemove: (ruleId: string) => void;
}) {
  const lists = state.lists.filter((item) => item.boardId === board.id && !item.deletedAt);
  const labels = state.labels.filter((item) => item.boardId === board.id && !item.deleted);
  const [trigger, setTrigger] = useState<Trigger>("move");
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [action, setAction] = useState<AutomationRule["action"]>("trash");
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "");
  const [leadMinutes, setLeadMinutes] = useState(0);
  const [targetListId, setTargetListId] = useState(lists[0]?.id ?? "");
  // Moving to a list is the action of approval rules only: a card moved by a move rule would trigger others.
  const canMove = approvalTriggers.includes(trigger);
  const chosenAction = !canMove && action === "move-to-list" ? "trash" : action;
  const actionText = (rule: AutomationRule) =>
    rule.action === "trash"
      ? t("board.actionTrash")
      : rule.action === "move-to-list"
        ? t("approvals.actionMove", {
            list: lists.find((item) => item.id === rule.targetListId)?.name ?? t("board.listUnavailable"),
          })
        : t("board.actionAddLabel", {
            name: labels.find((item) => item.id === rule.labelId)?.name ?? t("board.unavailable"),
          });
  return (
    <SidePanel
      title={t("board.automation")}
      label={t("board.boardAutomation")}
      closeLabel={t("board.closeAutomation")}
      onClose={onClose}
    >
      <p className="text-ink-muted">{t("board.automationIntro")}</p>
      <form
        className="mx-0 mt-4 mb-6 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(listId, chosenAction, labelId, trigger, name, leadMinutes, targetListId);
          if (trigger === "button") setName("");
        }}
      >
        <label className={labelClass}>
          {t("board.ruleType")}
          <Select className="w-full" value={trigger} onChange={(event) => setTrigger(event.target.value as Trigger)}>
            <option value="move">{t("board.movedToList")}</option>
            <option value="due">{t("board.dueArrives")}</option>
            <option value="button">{t("board.cardButton")}</option>
            <option value="approved">{t("approvals.triggerApproved")}</option>
            <option value="declined">{t("approvals.triggerDeclined")}</option>
          </Select>
        </label>
        {trigger === "move" ? (
          <label className={labelClass}>
            {t("board.list")}
            <Select className="w-full" value={listId} onChange={(event) => setListId(event.target.value)}>
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
        ) : trigger === "button" ? (
          <label className={labelClass}>
            {t("board.buttonName")}
            <Input
              className="w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder={t("board.buttonNamePlaceholder")}
            />
          </label>
        ) : null}
        {trigger === "due" && (
          <label className={labelClass}>
            {t("board.when")}
            <Select
              className="w-full"
              value={leadMinutes}
              onChange={(event) => setLeadMinutes(Number(event.target.value))}
            >
              <option value={0}>{t("board.atDueTime")}</option>
              <option value={60}>{t("board.hourBefore")}</option>
              <option value={1440}>{t("board.dayBefore")}</option>
              <option value={10080}>{t("board.weekBefore")}</option>
            </Select>
          </label>
        )}
        <label className={labelClass}>
          {t("board.action")}
          <Select
            className="w-full"
            value={chosenAction}
            onChange={(event) => setAction(event.target.value as AutomationRule["action"])}
          >
            <option value="trash">{t("board.moveToTrash")}</option>
            <option value="add-label">{t("board.addLabel")}</option>
            {canMove && <option value="move-to-list">{t("approvals.moveToList")}</option>}
          </Select>
        </label>
        {chosenAction === "move-to-list" && (
          <label className={labelClass}>
            {t("approvals.targetList")}
            <Select className="w-full" value={targetListId} onChange={(event) => setTargetListId(event.target.value)}>
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {chosenAction === "add-label" && (
          <label className={labelClass}>
            {t("board.label")}
            <Select className="w-full" value={labelId} onChange={(event) => setLabelId(event.target.value)}>
              {labels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <Button
          variant="primary"
          type="submit"
          disabled={
            (trigger === "move" && !listId) ||
            (trigger === "button" && !name.trim()) ||
            (chosenAction === "add-label" && !labelId) ||
            (chosenAction === "move-to-list" && !targetListId)
          }
        >
          {t("board.addRule")}
        </Button>
        {chosenAction === "add-label" && !labels.length && <small>{t("board.createLabelFirst")}</small>}
      </form>
      <h3 className="mx-0 mt-0 mb-2 text-[15px]">{t("board.boardRules")}</h3>
      {(board.automationRules ?? []).length ? (
        board.automationRules!.map((rule) => (
          <PanelRow key={rule.id}>
            <PanelRowText>
              {t("board.ruleSummary", {
                trigger:
                  rule.trigger === "approved"
                    ? t("approvals.ruleApproved")
                    : rule.trigger === "declined"
                      ? t("approvals.ruleDeclined")
                      : rule.trigger === "button"
                        ? t("board.ruleButton", { name: rule.name ?? "" })
                        : rule.trigger === "due"
                          ? dueLeads[rule.leadMinutes ?? 0]
                            ? t(dueLeads[rule.leadMinutes ?? 0])
                            : ""
                          : t("board.ruleMoved", {
                              list:
                                state.lists.find((item) => item.id === rule.listId)?.name ?? t("board.listUnavailable"),
                            }),
                action: actionText(rule),
              })}
            </PanelRowText>
            <Button
              variant="secondary"
              className="flex-none"
              onClick={async () => {
                if (await askConfirm({ title: t("board.deleteRuleTitle"), confirm: t("common.delete"), danger: true }))
                  onRemove(rule.id);
              }}
            >
              {t("common.delete")}
            </Button>
          </PanelRow>
        ))
      ) : (
        <p className="text-ink-muted">{t("board.noRules")}</p>
      )}
    </SidePanel>
  );
}
