import { useEffect, useId, useRef } from "react";

/** Native colour picker that commits once when the picker closes, not on every drag step (each commit is a revision). */
export function ColorInput({
  value,
  onCommit,
  label,
  presets,
  className,
}: {
  value: string;
  onCommit: (color: string) => void;
  label: string;
  presets?: string[];
  /** The look of the input; it has none of its own. */
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.value = value;
    const changed = () => {
      if (element.value !== value) commit.current(element.value);
    };
    element.addEventListener("change", changed);
    return () => element.removeEventListener("change", changed);
  }, [value]);
  const id = useId();
  const listId = presets ? `colors${id}` : undefined;
  return (
    <>
      <input ref={input} type="color" className={className} defaultValue={value} list={listId} aria-label={label} />
      {presets && (
        <datalist id={listId}>
          {presets.map((color) => (
            <option key={color} value={color} />
          ))}
        </datalist>
      )}
    </>
  );
}
