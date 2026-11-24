import type { MouseEvent, ReactNode, SubmitEvent } from "react";
import { Icon } from "./Icon";
import { t } from "../i18n";

const stop = (event: MouseEvent) => event.stopPropagation();

/** The dimmed full-screen layer under a dialog. Pressing on it (not on the dialog) calls `onMouseDown`. */
export function Backdrop({ onMouseDown, children }: { onMouseDown?: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center overflow-auto bg-[#000b] px-6 py-12 max-phone:p-0"
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}

/**
 * A modal over a dimmed backdrop. Pressing on the backdrop calls `onDismiss`; pass none while the dialog must stay
 * open (for example during an import). With `onSubmit` the dialog is a form, so Enter submits it. `className` styles
 * the dialog box itself.
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
    <Backdrop onMouseDown={onDismiss}>
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
    </Backdrop>
  );
}

const dialogWidth = { sm: "w-[min(420px,100%)]", md: "w-[min(520px,100%)]", lg: "w-[min(620px,100%)]" };

/**
 * A centered dialog box: a `Modal` with the app's dialog look, 420px wide (`md` 520px, `lg` 620px). On phones every
 * button in it except inline text links (`data-inline`) becomes a 44px touch target. `className` adds layout only (grid, scrolling).
 */
export function Dialog({
  size = "sm",
  className,
  ...props
}: Omit<Parameters<typeof Modal>[0], "className"> & { size?: keyof typeof dialogWidth; className?: string }) {
  const box = `m-auto rounded-[10px] bg-white p-6 shadow-dialog ${dialogWidth[size]} max-phone:[&_button:not([data-inline],.markdown-card-link)]:min-h-11`;
  return <Modal className={className ? `${box} ${className}` : box} {...props} />;
}

const sidePanelWidth = { default: "w-[min(400px,100%)]", wide: "w-[min(640px,100%)]" };

/**
 * A panel at the side of the screen with a title and a close button; full screen on phones, where every button in it
 * except inline text links (`data-inline`) becomes a 44px touch target. `className` adds layout or a hook name only.
 */
export function SidePanel({
  title,
  label = title,
  className,
  width = "default",
  closeLabel = t("common.close"),
  closeIcon = <Icon name="close" />,
  onClose,
  children,
}: {
  title: string;
  label?: string;
  className?: string;
  width?: "default" | "wide";
  closeLabel?: string;
  closeIcon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = `ml-auto h-[calc(100dvh-96px)] overflow-auto rounded-lg bg-white p-4 ${sidePanelWidth[width]} max-phone:h-dvh max-phone:max-h-dvh max-phone:w-full max-phone:rounded-none max-phone:[&_button:not([data-inline],.markdown-card-link)]:min-h-11`;
  return (
    <Modal label={label} className={className ? `${panel} ${className}` : panel} onDismiss={onClose}>
      <header className="flex items-center justify-between border-b border-line">
        <h2 className="text-[20px]">{title}</h2>
        <button
          className="rounded-sm border-0 bg-transparent p-1.5 text-ink-subtle hover:bg-line"
          onClick={onClose}
          aria-label={closeLabel}
        >
          {closeIcon}
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
