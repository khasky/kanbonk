import { useEffect, useRef, useState } from "react";

export function NameEditor({
  value,
  label,
  className,
  onCommit,
}: {
  value: string;
  label: string;
  className?: string;
  onCommit: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  function save() {
    editing.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(value);
      return;
    }
    const name = draft.trim();
    if (name && name !== value) onCommit(name);
    else setDraft(value);
  }
  return (
    <input
      className={className}
      aria-label={label}
      value={draft}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.stopPropagation();
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
