import type { MouseEvent, ReactNode, SubmitEvent } from "react";
import { Icon } from "./Icon";

const stop = (event: MouseEvent) => event.stopPropagation();

/**
 * A modal over a dimmed backdrop. Pressing on the backdrop calls `onDismiss`; pass none while the dialog must stay
 * open (for example during an import). With `onSubmit` the dialog is a form, so Enter submits it.
 */
export function Modal({
  label,
  className,
  role = "dialog",
  onDismiss,
  onSubmit,
  children,
}: {
  label: string;
  className: string;
  role?: "dialog" | "alertdialog";
  onDismiss?: () => void;
  onSubmit?: (event: SubmitEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onMouseDown={onDismiss}>
      {onSubmit ? (
        <form
          className={className}
          role={role}
          aria-modal="true"
          aria-label={label}
          onMouseDown={stop}
          onSubmit={onSubmit}
        >
          {children}
        </form>
      ) : (
        <section className={className} role={role} aria-modal="true" aria-label={label} onMouseDown={stop}>
          {children}
        </section>
      )}
    </div>
  );
}

/** A panel at the side of the screen with a title and a close button. */
export function SidePanel({
  title,
  label = title,
  className,
  closeLabel = "Close",
  onClose,
  children,
}: {
  title: string;
  label?: string;
  className?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal label={label} className={className ? `side-panel ${className}` : "side-panel"} onDismiss={onClose}>
      <header>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label={closeLabel}>
          <Icon name="close" />
        </button>
      </header>
      {children}
    </Modal>
  );
}

/** Calls `submit` without the browser's default form submission. */
export const submitWith =
  (submit: () => void) =>
  (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submit();
  };
