import { useState } from "react";
import type { Card } from "../model";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { addCardClass, composeActionsClass } from "./boardLook";
import { Input, Select } from "../ui/Field";
import { t } from "../i18n";

export function TemplateComposer({
  templates,
  onCreate,
}: {
  templates: Card[];
  onCreate: (templateId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  if (!templates.length) return null;
  const selected = templates.find((item) => item.id === templateId) ?? templates[0];
  if (!open)
    return (
      <button
        className={addCardClass}
        onClick={() => {
          setTemplateId(selected.id);
          setName(selected.name);
          setOpen(true);
        }}
      >
        {t("board.createFromTemplate")}
      </button>
    );
  return (
    <div className="grid flex-col gap-2">
      <label className="grid gap-1 text-[12px] font-semibold">
        {t("board.template")}
        <Select
          className="w-full"
          value={selected.id}
          onChange={(event) => {
            const next = templates.find((item) => item.id === event.target.value);
            if (next) {
              setTemplateId(next.id);
              setName(next.name);
            }
          }}
        >
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <Input
        className="w-full"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim()) {
            onCreate(selected.id, name);
            setOpen(false);
          }
        }}
        aria-label={t("board.newCardTitle")}
      />
      <div className={composeActionsClass}>
        <Button
          variant="primary"
          disabled={!name.trim()}
          onClick={() => {
            onCreate(selected.id, name);
            setOpen(false);
          }}
        >
          {t("board.createCard")}
        </Button>
        <Button variant="icon" onClick={() => setOpen(false)} aria-label={t("common.cancel")}>
          <Icon name="close" />
        </Button>
      </div>
    </div>
  );
}
