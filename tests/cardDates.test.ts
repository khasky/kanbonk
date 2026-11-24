import { expect, it } from "vitest";
import { parseDay, parseTime } from "../src/card/CardDates";

it("reads M/D/YYYY days and rejects days that do not exist", () => {
  expect(parseDay("11/23/2026")).toEqual(new Date(2026, 10, 23));
  expect(parseDay(" 2/29/2028 ")).toEqual(new Date(2028, 1, 29));
  for (const text of ["2/29/2027", "13/1/2026", "11/31/2026", "2026-11-23", ""]) expect(parseDay(text)).toBeUndefined();
});

it("reads 12-hour and 24-hour times as minutes after midnight", () => {
  expect(parseTime("12:00 AM")).toBe(0);
  expect(parseTime("12:30 pm")).toBe(750);
  expect(parseTime("5:31 PM")).toBe(1051);
  expect(parseTime("17:31")).toBe(1051);
  for (const text of ["13:00 PM", "0:30 AM", "24:00", "5:60", "5 PM"]) expect(parseTime(text)).toBeUndefined();
});
