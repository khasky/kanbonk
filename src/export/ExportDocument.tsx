import { t } from "../i18n";
import { Checkbox } from "../ui/Field";
import { MarkdownText } from "../ui/MarkdownText";
import type { ExportDocModel } from "./exportData";

/**
 * The PDF and Word document as a page: the preview in the export dialog and what is printed to PDF. Print rules in
 * styles/index.css (`.export-document`) break pages before lists and keep a short card on one page.
 */
export function ExportDocument({ model }: { model: ExportDocModel }) {
  const styled = model.style === "styled";
  const accent = styled ? model.accent : "#000000";
  const cellLook = styled ? "border-[#dfe1e6] bg-[#f4f5f7]" : "border-black";
  return (
    <article className="export-document bg-white text-[13px] leading-normal text-black" data-style={model.style}>
      {model.cover ? (
        <header className="export-cover grid content-center gap-2 py-16">
          <h1 className="m-0 text-[30px] leading-tight" style={{ color: accent }}>
            {model.title}
          </h1>
          <p className="m-0 text-[#44546f]">{t("common.cards", { count: model.cardCount })}</p>
          {model.dueRange && (
            <p className="m-0 text-[#44546f]">
              {t("exporting.coverDue", { from: model.dueRange[0], to: model.dueRange[1] })}
            </p>
          )}
          <p className="m-0 text-[#44546f]">{t("exporting.coverExported", { date: model.exportedAt })}</p>
        </header>
      ) : (
        <h1 className="mt-0 mb-4 text-[26px] leading-tight" style={{ color: accent }}>
          {model.title}
        </h1>
      )}
      {model.sections.map((section, index) => (
        <section
          key={section.id}
          className="export-list"
          data-page-break={model.pagePerList && (index > 0 || model.cover) ? "" : undefined}
        >
          <h2
            className="mt-5 mb-3 pb-1 text-[20px]"
            style={{ color: accent, borderBottom: styled ? `2px solid ${accent}` : undefined }}
          >
            {section.name}
          </h2>
          {section.cards.map((card) => (
            <div key={card.id} className="export-card mb-5">
              <h3 className="mt-0 mb-2 text-[16px]" style={{ color: accent }}>
                {card.name}
              </h3>
              {card.details.length > 0 && (
                <table className="mb-2 w-full border-collapse">
                  <tbody>
                    {card.details.map((item) => (
                      <tr key={item.label}>
                        <th className={`w-[26%] border px-2 py-1 text-left align-top ${cellLook}`}>{item.label}</th>
                        <td
                          className={`border px-2 py-1 align-top whitespace-pre-wrap ${styled ? "border-[#dfe1e6]" : "border-black"}`}
                        >
                          {item.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {card.description && (
                <>
                  <h4 className="mt-3 mb-1 text-[13px]">{t("exporting.fieldDescription")}</h4>
                  <MarkdownText text={card.description} />
                </>
              )}
              {card.checklists?.map((checklist) => (
                <div key={checklist.id}>
                  <h4 className="mt-3 mb-1 text-[13px]">
                    {checklist.name} ({checklist.items.filter((item) => item.checked).length}/{checklist.items.length})
                  </h4>
                  <ul className="m-0 list-none pl-3">
                    {checklist.items.map((item) => (
                      <li key={item.id} className="flex items-baseline gap-1.5">
                        <Checkbox checked={item.checked} readOnly tabIndex={-1} aria-label={item.name} />
                        <span className={item.checked ? "text-[#6b778c] line-through" : ""}>{item.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {card.comments && (
                <>
                  <h4 className="mt-3 mb-1 text-[13px]">{t("exporting.fieldComments")}</h4>
                  {card.comments.map((comment, commentIndex) => (
                    <div
                      key={`${comment.date}-${commentIndex}`}
                      className="mb-1.5"
                      style={{ marginLeft: comment.depth * 20 }}
                    >
                      <div className="text-[12px] font-semibold">
                        {comment.depth ? "↳ " : ""}
                        {comment.author} · {comment.date}
                      </div>
                      <div className="pl-3 whitespace-pre-wrap">{comment.text}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
