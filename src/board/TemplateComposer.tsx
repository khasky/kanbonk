import { useState } from "react";
import { t } from "../i18n";
import type { Card } from "../model";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";

/**
 * Trello's "Card templates" popover of a list: the board's templates, one of which becomes a new card under the title
 * given, and a new template made in the list.
 */
export function TemplateComposer({
  templates,
  anchor,
  onCreate,
  onCreateTemplate,
  onClose,
}: {
  templates: Card[];
  anchor: HTMLElement;
  onCreate: (templateId: string, name: string) => void;
  onCreateTemplate: (name: string) => void;
  onClose: () => void;
}) {
  /** The template a card is made from, or "new" while a new template is named. */
  const [step, setStep] = useState<Card | "new">();
  const [name, setName] = useState("");

  if (step) {
    const creating = step === "new";
    const submit = () => {
      if (!name.trim()) return;
      if (creating) onCreateTemplate(name.trim());
      else onCreate(step.id, name.trim());
      onClose();
    };
    return (
      <Popover
        title={creating ? t("board.newTemplate") : t("board.createFromTemplateTitle")}
        anchor={anchor}
        onClose={onClose}
        onBack={() => setStep(undefined)}
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="grid gap-1 text-[12px] font-semibold text-ink-subtle">
            {creating ? t("board.templateTitle") : t("board.cardTitle")}
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button variant="primary" type="submit" className="justify-self-start" disabled={!name.trim()}>
            {creating ? t("common.add") : t("board.createCard")}
          </Button>
        </form>
      </Popover>
    );
  }

  return (
    <Popover title={t("board.cardTemplates")} anchor={anchor} onClose={onClose}>
      <div className="grid gap-2">
        {templates.length ? (
          <div className="grid">
            {templates.map((item) => (
              <MenuItem
                key={item.id}
                onClick={() => {
                  setName(item.name);
                  setStep(item);
                }}
              >
                {item.name}
              </MenuItem>
            ))}
          </div>
        ) : (
          <p className="m-0 px-1 text-ink-subtle">{t("board.noTemplates")}</p>
        )}
        <Button
          variant="secondary"
          className="gap-1.5"
          onClick={() => {
            setName("");
            setStep("new");
          }}
        >
          <Icon name="plus" className="size-4" />
          {t("board.newTemplate")}
        </Button>
      </div>
    </Popover>
  );
}
