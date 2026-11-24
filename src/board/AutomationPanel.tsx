import { askConfirm } from "../ui/AskDialog";
import { SidePanel } from "../ui/Modal";
import { useState } from "react";
import type { AppState, AutomationRule, Board } from "../model";
import { Button } from "../ui/Button";
import { PanelRow, PanelRowText } from "../ui/PanelRow";
import { Input, Select } from "../ui/Field";

const labelClass = "grid gap-[5px]";

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
    trigger: "move" | "button" | "due",
    name: string,
    leadMinutes: number,
  ) => void;
  onRemove: (ruleId: string) => void;
}) {
  const lists = state.lists.filter((item) => item.boardId === board.id && !item.deletedAt);
  const labels = state.labels.filter((item) => item.boardId === board.id && !item.deleted);
  const [trigger, setTrigger] = useState<"move" | "button" | "due">("move");
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [action, setAction] = useState<AutomationRule["action"]>("trash");
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "");
  const [leadMinutes, setLeadMinutes] = useState(0);
  const actionText = (rule: AutomationRule) =>
    rule.action === "trash"
      ? "move to trash"
      : `add label “${labels.find((item) => item.id === rule.labelId)?.name ?? "unavailable"}”`;
  return (
    <SidePanel title="Automation" label="Board automation" closeLabel="Close automation" onClose={onClose}>
      <p className="text-ink-muted">
        Rules run when a card is moved to a list, when a due date arrives, or when a card button is pressed. Due dates
        are checked while the app is open and on the next launch.
      </p>
      <form
        className="mx-0 mt-4 mb-6 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(listId, action, labelId, trigger, name, leadMinutes);
          if (trigger === "button") setName("");
        }}
      >
        <label className={labelClass}>
          Type
          <Select
            className="w-full"
            value={trigger}
            onChange={(event) => setTrigger(event.target.value as "move" | "button" | "due")}
          >
            <option value="move">Moved to list</option>
            <option value="due">Due date arrives</option>
            <option value="button">Card button</option>
          </Select>
        </label>
        {trigger === "move" ? (
          <label className={labelClass}>
            List
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
            Button name
            <Input
              className="w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="For example, Finish"
            />
          </label>
        ) : null}
        {trigger === "due" && (
          <label className={labelClass}>
            When
            <Select
              className="w-full"
              value={leadMinutes}
              onChange={(event) => setLeadMinutes(Number(event.target.value))}
            >
              <option value={0}>At due time</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
              <option value={10080}>1 week before</option>
            </Select>
          </label>
        )}
        <label className={labelClass}>
          Action
          <Select
            className="w-full"
            value={action}
            onChange={(event) => setAction(event.target.value as AutomationRule["action"])}
          >
            <option value="trash">Move to trash</option>
            <option value="add-label">Add label</option>
          </Select>
        </label>
        {action === "add-label" && (
          <label className={labelClass}>
            Label
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
            (action === "add-label" && !labelId)
          }
        >
          Add rule
        </Button>
        {action === "add-label" && !labels.length && <small>Create a label on the board first.</small>}
      </form>
      <h3 className="mx-0 mt-0 mb-2 text-[15px]">Board rules</h3>
      {(board.automationRules ?? []).length ? (
        board.automationRules!.map((rule) => (
          <PanelRow key={rule.id}>
            <PanelRowText>
              {rule.trigger === "button"
                ? `Button “${rule.name}”`
                : rule.trigger === "due"
                  ? (
                      {
                        0: "At due time",
                        60: "1 hour before due",
                        1440: "1 day before due",
                        10080: "1 week before due",
                      } as Record<number, string>
                    )[rule.leadMinutes ?? 0]
                  : "When moved to “" +
                    (state.lists.find((item) => item.id === rule.listId)?.name ?? "list unavailable") +
                    "”"}{" "}
              — {actionText(rule)}
            </PanelRowText>
            <Button
              variant="secondary"
              className="flex-none"
              onClick={async () => {
                if (await askConfirm({ title: "Delete rule?", confirm: "Delete", danger: true })) onRemove(rule.id);
              }}
            >
              Delete
            </Button>
          </PanelRow>
        ))
      ) : (
        <p className="text-ink-muted">No rules yet.</p>
      )}
    </SidePanel>
  );
}
