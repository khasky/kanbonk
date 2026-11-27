import { useState } from "react";
import { t } from "../i18n";
import { saveFile } from "../lib/platform";
import type { AppState, Card } from "../model";
import { cardLink } from "../card/share";
import { calendarCsv, calendarIcs, datedCards } from "../export/calendarFiles";
import { fieldLabelClass, optionLabelClass } from "../dialogs/dialogLook";
import { Button } from "../ui/Button";
import { Checkbox, Select } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { Popover } from "../ui/Popover";

export interface CalendarPrintOptions {
  paper: "A4" | "letter";
  orientation: "portrait" | "landscape";
  titles: boolean;
  monochrome: boolean;
}

/**
 * Prints only the board calendar: `body.printing-calendar` hides everything else (see the print rules in
 * styles/index.css), and a page rule sets the paper and orientation for this print.
 */
export function printCalendar(options: CalendarPrintOptions): void {
  const page = document.createElement("style");
  page.textContent = `@page { size: ${options.paper} ${options.orientation}; margin: 10mm; }`;
  document.head.append(page);
  const classes = [
    "printing-calendar",
    ...(options.titles ? [] : ["print-no-titles"]),
    ...(options.monochrome ? ["print-monochrome"] : []),
  ];
  document.body.classList.add(...classes);
  const done = () => {
    document.body.classList.remove(...classes);
    page.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/** Print settings for the calendar shown, and downloads of its dated cards as iCalendar or CSV. */
export function CalendarPrintExport({
  state,
  cards,
  from,
  to,
  fileName,
  anchor,
  onClose,
}: {
  state: AppState;
  cards: Card[];
  from: Date;
  to: Date;
  /** The downloaded files' name without the extension. */
  fileName: string;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<CalendarPrintOptions>({
    paper: "A4",
    orientation: "landscape",
    titles: true,
    monochrome: false,
  });
  const change = (patch: Partial<CalendarPrintOptions>) => setOptions((current) => ({ ...current, ...patch }));
  const download = (text: string, type: string, extension: string) =>
    void saveFile(new Blob([text], { type }), `${fileName}.${extension}`);
  const items = () => datedCards(cards, from, to);
  return (
    <Popover title={t("calendar.printExport")} anchor={anchor} onClose={onClose}>
      <div className="grid gap-2.5">
        <label className={fieldLabelClass}>
          {t("calendar.paper")}
          <Select
            value={options.paper}
            onChange={(event) => change({ paper: event.target.value as CalendarPrintOptions["paper"] })}
          >
            <option value="A4">{t("calendar.a4")}</option>
            <option value="letter">{t("calendar.letter")}</option>
          </Select>
        </label>
        <label className={fieldLabelClass}>
          {t("calendar.orientation")}
          <Select
            value={options.orientation}
            onChange={(event) => change({ orientation: event.target.value as CalendarPrintOptions["orientation"] })}
          >
            <option value="landscape">{t("calendar.landscape")}</option>
            <option value="portrait">{t("calendar.portrait")}</option>
          </Select>
        </label>
        <label className={optionLabelClass}>
          <Checkbox checked={options.titles} onChange={(event) => change({ titles: event.target.checked })} />
          {t("calendar.showTitles")}
        </label>
        <label className={optionLabelClass}>
          <Checkbox checked={options.monochrome} onChange={(event) => change({ monochrome: event.target.checked })} />
          {t("calendar.monochrome")}
        </label>
        <Button
          variant="primary"
          className="justify-self-start"
          onClick={() => {
            onClose();
            printCalendar(options);
          }}
        >
          {t("calendar.print")}
        </Button>
        <div className="grid gap-1.5 border-t border-line pt-2.5">
          <Button
            variant="secondary"
            onClick={() =>
              download(
                calendarIcs(items(), (card) => cardLink(card.id)),
                "text/calendar;charset=utf-8",
                "ics",
              )
            }
          >
            {t("calendar.exportIcs")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => download(`﻿${calendarCsv(state, items())}`, "text/csv;charset=utf-8", "csv")}
          >
            {t("calendar.exportCsv")}
          </Button>
          <Hint>{t("calendar.exportHint")}</Hint>
        </div>
      </div>
    </Popover>
  );
}
