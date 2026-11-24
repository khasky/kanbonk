import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { t } from "../i18n";

const gap = 6;
const margin = 8;

/**
 * A small titled panel under the button that opened it (`anchor`), above everything in the dialog it is in. It stays
 * next to the button while the page scrolls, flips up when there is no room below, and closes on Escape (which goes
 * no further, so the dialog around it stays open), on a press outside it and on its close button. A press on the
 * anchor is left to the anchor, which toggles the popover. On open it focuses its first field.
 *
 * It is marked `data-share-skip`, so it never shows on a printed or saved card.
 */
export function Popover({
  title,
  anchor,
  onClose,
  width = 304,
  children,
}: {
  title: string;
  anchor: HTMLElement;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const box = anchor.getBoundingClientRect();
      const panelWidth = Math.min(width, window.innerWidth - 2 * margin);
      const height = ref.current?.offsetHeight ?? 0;
      const left = Math.max(margin, Math.min(box.left, window.innerWidth - panelWidth - margin));
      const below = box.bottom + gap;
      const above = box.top - gap - height;
      const top =
        below + height <= window.innerHeight - margin || above < margin
          ? Math.max(margin, Math.min(below, window.innerHeight - margin - height))
          : above;
      setPosition({ top, left, width: panelWidth });
    }
    place();
    const resize = new ResizeObserver(place);
    if (ref.current) resize.observe(ref.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>(
        "input:not([type=file],[type=color],[type=checkbox],:disabled), select:not(:disabled), textarea",
      )
      ?.focus();
  }, []);

  useEffect(() => {
    function press(event: PointerEvent) {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Captured on the window before anything else, so the dialog under the popover does not close too.
      event.stopPropagation();
      onClose();
      anchor.focus();
    }
    document.addEventListener("pointerdown", press, true);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      data-share-skip
      className="fixed z-50 flex max-h-[calc(100dvh-16px)] flex-col overflow-y-auto rounded-lg bg-white px-3 pb-3 text-[14px] text-ink shadow-[0_8px_12px_#091e4226,0_0_1px_#091e424f]"
      style={
        position
          ? { top: position.top, left: position.left, width: position.width }
          : { top: 0, left: 0, width, visibility: "hidden" }
      }
    >
      <header className="relative grid h-10 flex-none place-items-center">
        <h4 className="m-0 px-8 text-[14px] font-semibold text-ink-subtle">{title}</h4>
        <button
          type="button"
          className="absolute right-[-4px] grid size-8 place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-surface-sunken"
          onClick={() => {
            onClose();
            anchor.focus();
          }}
          aria-label={t("ui.closePopover", { title: title.toLowerCase() })}
        >
          <Icon name="close" className="size-4" />
        </button>
      </header>
      {children}
    </div>
  );
}
