import { useState } from "react";
import { t } from "../i18n";
import type { Lifetime } from "../model";
import { Checkbox, Input } from "../ui/Field";
import { Hint } from "../ui/Hint";

/** A board made temporary in the creation dialog or the settings starts with a day. */
export const defaultLifetime: Lifetime = { days: 1, hours: 0 };

const numberClass = "w-20";

/**
 * "Temporary board" with the time it lives in days and hours, as in the creation dialog, the board's settings and
 * the dialog that brings an expired board back. `value` undefined is a board kept for good; `onChange` gets a
 * lifetime only while it is at least an hour long, so half-typed numbers change nothing.
 */
export function BoardLifetimeField({
  value,
  onChange,
  note,
}: {
  value: Lifetime | undefined;
  onChange: (lifetime: Lifetime | undefined) => void;
  /** A line under the fields, e.g. when the board moves to the trash. */
  note?: string;
}) {
  const [days, setDays] = useState(String(value?.days ?? defaultLifetime.days));
  const [hours, setHours] = useState(String(value?.hours ?? defaultLifetime.hours));
  const parse = (text: string, max: number) => {
    const number = Number(text);
    return text.trim() !== "" && Number.isInteger(number) && number >= 0 && number <= max ? number : undefined;
  };
  const change = (nextDays: string, nextHours: string) => {
    setDays(nextDays);
    setHours(nextHours);
    const lifetime = { days: parse(nextDays, 3650), hours: parse(nextHours, 23) };
    if (lifetime.days !== undefined && lifetime.hours !== undefined && lifetime.days + lifetime.hours > 0)
      onChange({ days: lifetime.days, hours: lifetime.hours });
  };
  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-2">
        <Checkbox
          checked={Boolean(value)}
          onChange={(event) => {
            if (!event.target.checked) onChange(undefined);
            else change(days, hours);
          }}
        />
        {t("board.temporaryBoard")}
      </label>
      {value && (
        <div className="flex flex-wrap items-center gap-3 pl-6">
          <label className="flex items-center gap-1.5">
            <Input
              className={numberClass}
              size="sm"
              type="number"
              min={0}
              max={3650}
              value={days}
              onChange={(event) => change(event.target.value, hours)}
            />
            {t("board.lifetimeDays")}
          </label>
          <label className="flex items-center gap-1.5">
            <Input
              className={numberClass}
              size="sm"
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(event) => change(days, event.target.value)}
            />
            {t("board.lifetimeHours")}
          </label>
        </div>
      )}
      {value && note && <span className="pl-6 text-[13px] text-ink-subtle">{note}</span>}
      <Hint>{t("board.temporaryHint")}</Hint>
    </div>
  );
}
