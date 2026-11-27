import { type ReactNode, useMemo, useState } from "react";
import { t } from "../i18n";
import { Hint } from "../ui/Hint";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { SheetTable } from "../ui/SheetTable";
import { type Block, type OfficeContent, type Paragraph, type Run, readOffice, type Sheet } from "./officeFiles";
import { columnName } from "../export/xlsx";

const safeLink = /^(https?:|mailto:)/i;

function RunView({ run }: { run: Run }) {
  if ("image" in run) return <img className="max-w-full align-middle" src={run.image} alt={run.alt ?? ""} />;
  let node: ReactNode = run.text;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.italic) node = <em>{node}</em>;
  if (run.underline) node = <u>{node}</u>;
  if (run.strike) node = <s>{node}</s>;
  if (run.href && safeLink.test(run.href))
    node = (
      <a href={run.href} target="_blank" rel="noopener noreferrer">
        {node}
      </a>
    );
  return node;
}

const headingLooks = ["", "text-[24px]", "text-[20px]", "text-[17px]", "text-[15px]", "text-[14px]", "text-[13px]"];

function ParagraphView({ paragraph, marker }: { paragraph: Paragraph; marker?: string }) {
  const content = paragraph.runs.map((run, index) => <RunView key={index} run={run} />);
  if (paragraph.heading) {
    const Heading = `h${paragraph.heading}` as "h1";
    return <Heading className={`mt-4 mb-2 font-bold ${headingLooks[paragraph.heading]}`}>{content}</Heading>;
  }
  if (paragraph.list)
    return (
      <p className="m-0 flex gap-2" style={{ paddingLeft: `${paragraph.list.level * 24}px` }}>
        <span className="min-w-5 flex-none text-right text-ink-subtle">{marker}</span>
        <span className="min-w-0 flex-1 whitespace-pre-wrap">{content}</span>
      </p>
    );
  return <p className="m-0 min-h-[1.5em] whitespace-pre-wrap">{content}</p>;
}

/** Paragraphs and tables in order, numbering list items as Word and Writer do (restarting after other text). */
function Blocks({ blocks }: { blocks: Block[] }) {
  const counters: number[] = [];
  return (
    <div className="grid gap-1 leading-[1.5] text-ink wrap-anywhere">
      {blocks.map((block, index) => {
        if ("table" in block) {
          counters.length = 0;
          return (
            <div key={index} className="overflow-auto">
              <table className="my-2 border-collapse">
                <tbody>
                  {block.table.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border border-line px-2 py-1 align-top">
                          <Blocks blocks={cell.map((paragraph) => ({ paragraph }))} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const { list } = block.paragraph;
        let marker: string | undefined;
        if (list) {
          counters.length = list.level + 1;
          counters[list.level] = (counters[list.level] ?? 0) + 1;
          marker = list.ordered ? `${counters[list.level]}.` : "•";
        } else counters.length = 0;
        return <ParagraphView key={index} paragraph={block.paragraph} marker={marker} />;
      })}
    </div>
  );
}

function Sheets({ sheets }: { sheets: Sheet[] }) {
  const [shown, setShown] = useState(0);
  const sheet = sheets[shown] ?? sheets[0];
  const columns = Math.max(0, ...sheet.rows.map((row) => row.length));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {sheets.length > 1 && (
        <Segmented label={t("card.sheets")} className="self-start">
          {sheets.map((item, index) => (
            <SegmentedTab key={`${item.name}-${index}`} selected={index === shown} onClick={() => setShown(index)}>
              {item.name}
            </SegmentedTab>
          ))}
        </Segmented>
      )}
      {sheet.rows.length ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-line bg-white">
          <SheetTable
            header={Array.from({ length: columns }, (_, index) => columnName(index + 1))}
            rows={sheet.rows}
            rowNumbers
          />
        </div>
      ) : (
        <Hint className="m-0">{t("card.emptySheet")}</Hint>
      )}
      {sheet.cut && <Hint className="m-0">{t("card.sheetCut")}</Hint>}
    </div>
  );
}

/**
 * A Word, Excel, PowerPoint, OpenDocument or CSV file read in the app, without Office: a document's text, headings,
 * lists, tables and pictures; a workbook's sheets as tables; a deck's slides one after another. The look is simplified.
 */
export default function OfficeView({ data, name }: { data: ArrayBuffer; name: string }) {
  const content = useMemo((): OfficeContent | undefined => {
    try {
      return readOffice(name, data);
    } catch {
      return undefined;
    }
  }, [data, name]);

  if (!content) return <Hint>{t("card.officeError")}</Hint>;
  if (content.type === "sheets") return <Sheets sheets={content.sheets} />;
  if (content.type === "slides")
    return (
      <ol className="m-0 grid list-none gap-4 p-0">
        {content.slides.map((slide, index) => (
          <li key={index}>
            <section
              className="mx-auto grid w-full max-w-[900px] gap-2 rounded-md border border-line bg-white p-6 shadow-tile"
              aria-label={t("card.slideNumber", { number: index + 1 })}
            >
              <span className="text-[12px] text-ink-subtle">{t("card.slideNumber", { number: index + 1 })}</span>
              <Blocks blocks={slide} />
            </section>
          </li>
        ))}
      </ol>
    );
  return (
    <article className="mx-auto w-full max-w-[820px] rounded-md bg-white p-8 shadow-tile max-phone:p-4">
      {content.blocks.length ? (
        <Blocks blocks={content.blocks} />
      ) : (
        <Hint className="m-0">{t("card.emptyDocument")}</Hint>
      )}
    </article>
  );
}
