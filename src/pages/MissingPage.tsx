import { linkHref } from "../lib/router";
import { messagePageClass, pageTitleClass } from "./pageLook";

export function MissingPage({ what }: { what: string }) {
  return (
    <section className={messagePageClass} aria-label="Not found">
      <h1 className={pageTitleClass}>{what}</h1>
      <p>It may have been moved to the trash or not synced to this device yet.</p>
      <p>
        <a className="text-brand" href={linkHref("/")}>
          Go home
        </a>{" "}
        ·{" "}
        <a className="text-brand" href={linkHref("/trash")}>
          Open trash
        </a>
      </p>
    </section>
  );
}
