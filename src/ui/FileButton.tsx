import { type ReactNode, useId, useState } from "react";
import { type ButtonSize, buttonClass } from "./Button";

/**
 * A file picker that looks like a secondary `Button`. The native input stays in the label (hidden visually, still
 * focusable; `file-button` is a hook of tests). With `placeholder` the names of the chosen files show next to the
 * button (the placeholder until files are chosen) and the input keeps them; without it the picker acts at once and
 * clears itself, so the same file can be chosen again. `className` adds layout only.
 */
export function FileButton({
  children,
  onFiles,
  accept,
  multiple,
  disabled,
  placeholder,
  size,
  className,
}: {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: ButtonSize;
  className?: string;
}) {
  const [names, setNames] = useState<string[]>([]);
  const noteId = useId();
  const label = buttonClass(
    "secondary",
    size,
    "file-button relative inline-flex cursor-pointer items-center has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
  );
  const input = (
    <label className={placeholder === undefined && className ? `${label} ${className}` : label}>
      {children}
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-describedby={placeholder === undefined ? undefined : noteId}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (placeholder === undefined) event.target.value = "";
          else setNames(files.map((file) => file.name));
          onFiles(files);
        }}
      />
    </label>
  );
  if (placeholder === undefined) return input;
  return (
    <span className={className ? `flex min-w-0 items-center gap-2 ${className}` : "flex min-w-0 items-center gap-2"}>
      {input}
      <span id={noteId} className="min-w-0 font-normal wrap-anywhere text-ink-subtle">
        {names.length ? names.join(", ") : placeholder}
      </span>
    </span>
  );
}
