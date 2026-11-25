import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { linkHref } from "../lib/router";

/**
 * A link to a page of the app (`href` is an app path such as "/b/id"). A plain click calls `onOpen` instead of loading
 * the page; a middle click, Ctrl/⌘/Shift-click or the context menu work as on any link, e.g. open it in a new tab.
 */
export function AppLink({
  href,
  onOpen,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & { href: string; onOpen: () => void }) {
  return (
    <a
      {...props}
      href={linkHref(href)}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
    />
  );
}
