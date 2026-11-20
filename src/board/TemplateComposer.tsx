import { useState } from "react";
import type { Card } from "../model";
import { Icon } from "../ui/Icon";

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
        className="add-card"
        onClick={() => {
          setTemplateId(selected.id);
          setName(selected.name);
          setOpen(true);
        }}
      >
        Create from template
      </button>
    );
  return (
    <div className="compose template-compose">
      <label>
        Template
        <select
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
        </select>
      </label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim()) {
            onCreate(selected.id, name);
            setOpen(false);
          }
        }}
        aria-label="New card title"
      />
      <div>
        <button
          className="primary-button"
          disabled={!name.trim()}
          onClick={() => {
            onCreate(selected.id, name);
            setOpen(false);
          }}
        >
          Create card
        </button>
        <button className="plain-icon" onClick={() => setOpen(false)} aria-label="Cancel">
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
