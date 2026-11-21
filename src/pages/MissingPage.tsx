import { linkHref } from "../lib/router";

export function MissingPage({ what }: { what: string }) {
  return (
    <section className="page empty-page" aria-label="Not found">
      <h1>{what}</h1>
      <p>It may have been moved to the trash or not synced to this device yet.</p>
      <p>
        <a href={linkHref("/")}>Go home</a> · <a href={linkHref("/trash")}>Open trash</a>
      </p>
    </section>
  );
}
