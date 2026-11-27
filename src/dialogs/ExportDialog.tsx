import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildDocx } from "../export/docx";
import { Table, Td, Th } from "../ui/Table";
import { ExportDocument } from "../export/ExportDocument";
import {
  boardScope,
  checklistLayouts,
  emptyExportFilter,
  type ExportField,
  type ExportFilter,
  type ExportFormat,
  type ExportSettings,
  exportDocModel,
  exportFields,
  exportFileName,
  exportFormats,
  exportTable,
  fieldNames,
  isTrelloFormat,
  matchesExportFilter,
  pickedGroups,
  pickedState,
  readExportSettings,
  saveExportSettings,
} from "../export/exportData";
import { buildXlsx } from "../export/xlsx";
import { type MessageKey, t } from "../i18n";
import { saveFile } from "../lib/platform";
import type { AppState } from "../model";
import { exportTrelloCsv, exportTrelloJson, parseCsv } from "../trello/formats";
import { Button } from "../ui/Button";
import { ColorInput } from "../ui/ColorInput";
import { Checkbox, Input, Select } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Dialog } from "../ui/Modal";
import { fieldLabelClass, optionLabelClass } from "./dialogLook";

const formatNames: Record<ExportFormat, MessageKey> = {
  xlsx: "exporting.formatXlsx",
  docx: "exporting.formatDocx",
  pdf: "exporting.formatPdf",
  "trello-csv": "exporting.formatTrelloCsv",
  "trello-json": "exporting.formatTrelloJson",
};

const layoutNames = {
  inline: "exporting.layoutInline",
  block: "exporting.layoutBlock",
  row: "exporting.layoutRow",
  column: "exporting.layoutColumn",
} as const;

const optionClass = `${optionLabelClass} font-normal`;
const sectionTitleClass = "m-0 text-[14px] font-semibold";
const previewRows = 50;
const previewChars = 20000;

/**
 * Exports a board as Excel, Word, PDF or Trello's CSV and JSON: the lists and cards to include, filters, the fields
 * and, for documents, their look, with a live preview. The format, fields and look are remembered on this device.
 */
export function ExportDialog({
  state,
  boardId,
  onClose,
  onError,
}: {
  state: AppState;
  boardId: string;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [settings, setSettings] = useState<ExportSettings>(readExportSettings);
  const change = (patch: Partial<ExportSettings>) => setSettings((current) => ({ ...current, ...patch }));
  useEffect(() => saveExportSettings(settings), [settings]);
  const trello = isTrelloFormat(settings.format);
  const includeTrash = settings.includeTrash && !trello;
  const scope = useMemo(() => boardScope(state, boardId, includeTrash), [state, boardId, includeTrash]);
  const [title, setTitle] = useState(scope?.board.name ?? "");
  const [filter, setFilter] = useState<ExportFilter>(emptyExportFilter);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [excludedCardIds, setExcludedCardIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [printing, setPrinting] = useState(false);

  const listIds = useMemo(
    () => new Set(scope?.lists.filter((list) => !unticked.has(list.id)).map((list) => list.id)),
    [scope, unticked],
  );
  const groups = useMemo(
    () => (scope ? pickedGroups(scope, { listIds, excludedCardIds }, filter) : []),
    [scope, listIds, excludedCardIds, filter],
  );
  const cardCount = groups.reduce((sum, group) => sum + group.cards.length, 0);
  const docModel = useMemo(
    () =>
      scope && (settings.format === "pdf" || settings.format === "docx")
        ? exportDocModel(scope, groups, settings.fields, { ...settings, title: title.trim() || scope.board.name })
        : undefined,
    [scope, groups, settings, title],
  );

  useEffect(() => {
    if (!printing) return;
    const previousTitle = document.title;
    // The browser offers the page title as the PDF's file name.
    document.title = title.trim() || previousTitle;
    document.body.classList.add("printing-export");
    const done = () => {
      document.body.classList.remove("printing-export");
      document.title = previousTitle;
      setPrinting(false);
    };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing, title]);

  if (!scope) return null;
  const board = scope.board;
  const query = search.trim().toLowerCase();
  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  function table() {
    if (!scope) return { header: [], rows: [] };
    if (settings.format === "trello-csv") {
      const [header = [], ...rows] = parseCsv(exportTrelloCsv(pickedState(state, boardId, groups), boardId));
      return { header, rows };
    }
    return exportTable(scope, groups, settings.fields, settings.checklistLayout);
  }

  function save(blob: Blob, name: string) {
    saveFile(blob, name).catch((cause) => onError(t("app.fileSaveError", { name, cause: String(cause) })));
  }

  function download() {
    if (!scope) return;
    const name = title.trim() || board.name;
    switch (settings.format) {
      case "xlsx":
        return save(
          new Blob([new Uint8Array(buildXlsx(table(), name))], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          exportFileName(name, "xlsx"),
        );
      case "docx":
        return (
          docModel &&
          save(
            new Blob([new Uint8Array(buildDocx(docModel))], {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }),
            exportFileName(name, "docx"),
          )
        );
      case "pdf":
        return setPrinting(true);
      case "trello-csv":
        return save(
          new Blob([`\ufeff${exportTrelloCsv(pickedState(state, boardId, groups), boardId)}`], {
            type: "text/csv;charset=utf-8",
          }),
          exportFileName(board.name, "csv"),
        );
      case "trello-json":
        return save(
          new Blob([JSON.stringify(exportTrelloJson(pickedState(state, boardId, groups), boardId), null, 2)], {
            type: "application/json",
          }),
          exportFileName(board.name, "json"),
        );
    }
  }

  function preview() {
    if (docModel)
      return (
        <div className="rounded-sm border border-line bg-white p-6 shadow-tile-soft">
          <ExportDocument model={docModel} />
        </div>
      );
    if (settings.format === "trello-json") {
      const text = JSON.stringify(exportTrelloJson(pickedState(state, boardId, groups), boardId), null, 2);
      return (
        <pre className="m-0 overflow-auto rounded-sm bg-surface-sunken p-3 text-[12px] leading-snug">
          {text.length > previewChars ? `${text.slice(0, previewChars)}\n…` : text}
        </pre>
      );
    }
    const { header, rows } = table();
    return (
      <div className="overflow-auto rounded-sm border border-line">
        <Table grid>
          <thead className="sticky top-0 bg-surface-sunken">
            <tr>
              {header.map((name, index) => (
                <Th key={`${name}-${index}`}>{name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, previewRows).map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row[0]}`}>
                {row.map((value, index) => (
                  <Td top key={`${header[index]}-${index}`} className="max-w-[260px] whitespace-pre-wrap">
                    {value.length > 300 ? `${value.slice(0, 300)}…` : value}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        {rows.length > previewRows && (
          <p className="m-0 p-2 text-[12px] text-ink-muted">
            {t("exporting.previewMoreRows", { count: rows.length - previewRows })}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Dialog label={t("exporting.title")} size="xl" className="grid gap-4" onDismiss={onClose}>
        <h2 className="m-0 text-[20px]">{t("exporting.title")}</h2>
        <div className="grid grid-cols-[minmax(280px,340px)_1fr] gap-5 max-tablet:grid-cols-1">
          <div className="grid max-h-[70vh] content-start gap-4 overflow-auto pr-1">
            <label className={fieldLabelClass}>
              {t("exporting.format")}
              <Select
                value={settings.format}
                onChange={(event) => change({ format: event.target.value as ExportFormat })}
              >
                {exportFormats.map((format) => (
                  <option key={format} value={format}>
                    {t(formatNames[format])}
                  </option>
                ))}
              </Select>
            </label>
            {settings.format === "pdf" && <p className="m-0 text-[13px] text-ink-muted">{t("exporting.pdfHint")}</p>}
            {trello && <p className="m-0 text-[13px] text-ink-muted">{t("exporting.trelloHint")}</p>}

            <section className="grid gap-2">
              <h3 className={sectionTitleClass}>{t("exporting.listsAndCards")}</h3>
              <Input
                size="sm"
                type="search"
                value={search}
                placeholder={t("exporting.searchCards")}
                aria-label={t("exporting.searchCards")}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUnticked(new Set());
                    setExcludedCardIds(new Set());
                  }}
                >
                  {t("exporting.selectAll")}
                </Button>
                <Button variant="secondary" onClick={() => setUnticked(new Set(scope.lists.map((list) => list.id)))}>
                  {t("exporting.selectNone")}
                </Button>
              </div>
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {scope.lists.map((list) => {
                  const cards = (scope.cardsByList.get(list.id) ?? []).filter((card) =>
                    matchesExportFilter(card, filter),
                  );
                  const shown = query ? cards.filter((card) => card.name.toLowerCase().includes(query)) : cards;
                  if (query && shown.length === 0) return null;
                  const ticked = listIds.has(list.id);
                  const picked = ticked ? cards.filter((card) => !excludedCardIds.has(card.id)).length : 0;
                  const open = expanded.has(list.id) || Boolean(query);
                  return (
                    <li key={list.id}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="grid size-6 place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-line"
                          aria-expanded={open}
                          aria-label={t("exporting.showCards", { name: list.name })}
                          onClick={() => setExpanded((current) => toggle(current, list.id, !current.has(list.id)))}
                        >
                          <Icon name={open ? "chevron-down" : "chevron-right"} />
                        </button>
                        <label className={`${optionClass} min-w-0 flex-1`}>
                          <Checkbox
                            checked={ticked}
                            ref={(input) => {
                              if (input) input.indeterminate = ticked && picked > 0 && picked < cards.length;
                            }}
                            onChange={(event) =>
                              setUnticked((current) => toggle(current, list.id, !event.target.checked))
                            }
                          />
                          <span className="truncate">
                            {list.name}
                            {list.deletedAt ? ` (${t("exporting.inTrash")})` : ""}
                          </span>
                        </label>
                        <span className="text-[12px] text-ink-muted">
                          {picked}/{cards.length}
                        </span>
                      </div>
                      {open && (
                        <ul className="m-0 grid list-none gap-0.5 py-0.5 pr-0 pl-[30px]">
                          {shown.map((card) => (
                            <li key={card.id}>
                              <label className={optionClass}>
                                <Checkbox
                                  checked={ticked && !excludedCardIds.has(card.id)}
                                  disabled={!ticked}
                                  onChange={(event) =>
                                    setExcludedCardIds((current) => toggle(current, card.id, !event.target.checked))
                                  }
                                />
                                <span className="truncate">
                                  {card.name}
                                  {card.deletedAt ? ` (${t("exporting.inTrash")})` : ""}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="grid gap-2">
              <h3 className={sectionTitleClass}>{t("exporting.filters")}</h3>
              <label className={fieldLabelClass}>
                {t("exporting.label")}
                <Select
                  size="sm"
                  value={filter.labelId}
                  onChange={(event) => setFilter({ ...filter, labelId: event.target.value })}
                >
                  <option value="">{t("exporting.any")}</option>
                  {scope.labels.map((label) => (
                    <option key={label.id} value={label.id}>
                      {label.name || label.color}
                    </option>
                  ))}
                </Select>
              </label>
              {scope.members.length > 0 && (
                <label className={fieldLabelClass}>
                  {t("exporting.member")}
                  <Select
                    size="sm"
                    value={filter.memberId}
                    onChange={(event) => setFilter({ ...filter, memberId: event.target.value })}
                  >
                    <option value="">{t("exporting.any")}</option>
                    {scope.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className={fieldLabelClass}>
                  {t("exporting.dueFrom")}
                  <Input
                    size="sm"
                    type="date"
                    value={filter.dueFrom}
                    onChange={(event) => setFilter({ ...filter, dueFrom: event.target.value })}
                  />
                </label>
                <label className={fieldLabelClass}>
                  {t("exporting.dueTo")}
                  <Input
                    size="sm"
                    type="date"
                    value={filter.dueTo}
                    onChange={(event) => setFilter({ ...filter, dueTo: event.target.value })}
                  />
                </label>
              </div>
              <label className={optionClass}>
                <Checkbox
                  checked={includeTrash}
                  disabled={trello}
                  onChange={(event) => change({ includeTrash: event.target.checked })}
                />
                {t("exporting.includeTrash")}
              </label>
            </section>

            {!trello && (
              <section className="grid gap-2">
                <h3 className={sectionTitleClass}>{t("exporting.fields")}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {exportFields.map((field: ExportField) => (
                    <label key={field} className={optionClass}>
                      <Checkbox
                        checked={settings.fields.includes(field)}
                        onChange={(event) =>
                          change({
                            fields: exportFields.filter((item) =>
                              item === field ? event.target.checked : settings.fields.includes(item),
                            ),
                          })
                        }
                      />
                      {t(fieldNames[field])}
                    </label>
                  ))}
                </div>
                {settings.format === "xlsx" && settings.fields.includes("checklists") && (
                  <label className={fieldLabelClass}>
                    {t("exporting.checklistLayout")}
                    <Select
                      size="sm"
                      value={settings.checklistLayout}
                      onChange={(event) =>
                        change({ checklistLayout: event.target.value as ExportSettings["checklistLayout"] })
                      }
                    >
                      {checklistLayouts.map((layout) => (
                        <option key={layout} value={layout}>
                          {t(layoutNames[layout])}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
              </section>
            )}

            {docModel && (
              <section className="grid gap-2">
                <h3 className={sectionTitleClass}>{t("exporting.document")}</h3>
                <label className={fieldLabelClass}>
                  {t("exporting.documentTitle")}
                  <Input size="sm" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className={fieldLabelClass}>
                  {t("exporting.style")}
                  <Select
                    size="sm"
                    value={settings.style}
                    onChange={(event) => change({ style: event.target.value as ExportSettings["style"] })}
                  >
                    <option value="styled">{t("exporting.styleStyled")}</option>
                    <option value="plain">{t("exporting.stylePlain")}</option>
                  </Select>
                </label>
                {settings.style === "styled" && (
                  <label className={optionClass}>
                    <ColorInput
                      className="h-7 w-10 cursor-pointer rounded-sm border border-ink-faint p-0.5"
                      value={settings.accent}
                      label={t("exporting.accent")}
                      onCommit={(accent) => change({ accent })}
                    />
                    {t("exporting.accent")}
                  </label>
                )}
                <label className={optionClass}>
                  <Checkbox checked={settings.cover} onChange={(event) => change({ cover: event.target.checked })} />
                  {t("exporting.coverPage")}
                </label>
                <label className={optionClass}>
                  <Checkbox
                    checked={settings.pagePerList}
                    onChange={(event) => change({ pagePerList: event.target.checked })}
                  />
                  {t("exporting.pagePerList")}
                </label>
              </section>
            )}
          </div>
          <section
            className="grid max-h-[70vh] min-w-0 content-start gap-2 overflow-auto"
            aria-label={t("exporting.preview")}
          >
            <h3 className={sectionTitleClass}>{t("exporting.preview")}</h3>
            {cardCount === 0 ? <p className="m-0 text-ink-muted">{t("exporting.nothing")}</p> : preview()}
          </section>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-[13px] text-ink-muted">{t("common.cards", { count: cardCount })}</span>
          <Button variant="secondary" size="lg" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="button" disabled={cardCount === 0} onClick={download}>
            {settings.format === "pdf" ? t("exporting.printPdf") : t("exporting.download")}
          </Button>
        </div>
      </Dialog>
      {printing &&
        docModel &&
        createPortal(
          <div className="export-print">
            <ExportDocument model={docModel} />
          </div>,
          document.body,
        )}
    </>
  );
}
