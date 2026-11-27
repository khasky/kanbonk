import { useState } from "react";
import { t } from "../i18n";
import type { BoardList } from "../model";
import { fieldLabelClass } from "../dialogs/dialogLook";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";
import { submitWith } from "../ui/Modal";

/** A form that adds a card by name to one of the lists; `title` names the form and heads it. */
export function NewCardForm({
  title,
  lists,
  className,
  onCreate,
}: {
  title: string;
  lists: BoardList[];
  className?: string;
  onCreate: (listId: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const chosen = lists.some((list) => list.id === listId) ? listId : lists[0]?.id;
  if (!chosen) return null;
  return (
    <form
      className={`grid gap-2${className ? ` ${className}` : ""}`}
      aria-label={title}
      onSubmit={submitWith(() => {
        if (!name.trim()) return;
        onCreate(chosen, name.trim());
        setName("");
      })}
    >
      <h3 className="m-0 text-[14px]">{title}</h3>
      <label className={fieldLabelClass}>
        {t("calendar.cardName")}
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className={fieldLabelClass}>
        {t("calendar.list")}
        <Select value={chosen} onChange={(event) => setListId(event.target.value)}>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
      </label>
      <Button variant="primary" type="submit" disabled={!name.trim()} className="justify-self-start">
        {t("calendar.add")}
      </Button>
    </form>
  );
}
