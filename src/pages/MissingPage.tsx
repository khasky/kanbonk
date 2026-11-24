import { t } from "../i18n";
import { linkHref } from "../lib/router";
import { messagePageClass, pageTitleClass } from "./pageLook";

export function MissingPage({ what }: { what: string }) {
  return (
    <section className={messagePageClass} aria-label={t("pages.notFound")}>
      <h1 className={pageTitleClass}>{what}</h1>
      <p>{t("pages.missingHint")}</p>
      <p>
        <a className="text-brand" href={linkHref("/")}>
          {t("pages.goHome")}
        </a>{" "}
        ·{" "}
        <a className="text-brand" href={linkHref("/trash")}>
          {t("pages.openTrash")}
        </a>
      </p>
    </section>
  );
}
