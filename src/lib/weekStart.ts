import { useSyncExternalStore } from "react";
import { currentLocale, subscribeLocale } from "../i18n";
import type { LocaleCode } from "../i18n/locales";
import type { WeekStart } from "../model/calendar";

/** This device's first day of the week: the interface language's, or Monday or Sunday. */
export type WeekStartChoice = "auto" | "monday" | "sunday";

const key = "kanbonk-week-start";
const listeners = new Set<() => void>();

/** Languages whose main region starts the week on Sunday, as in the Unicode CLDR week data. */
const sundayLocales: LocaleCode[] = ["en", "ja", "pt-BR", "th", "zh-CN", "zh-TW"];

function read(): WeekStartChoice {
  try {
    const saved = localStorage.getItem(key);
    return saved === "monday" || saved === "sunday" ? saved : "auto";
  } catch {
    return "auto";
  }
}

let choice: WeekStartChoice = typeof localStorage === "undefined" ? "auto" : read();

export function weekStartChoice(): WeekStartChoice {
  return choice;
}

export function setWeekStartChoice(next: WeekStartChoice) {
  choice = next;
  try {
    if (next === "auto") localStorage.removeItem(key);
    else localStorage.setItem(key, next);
  } catch {
    // Storage may be full or blocked; the choice then lasts until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

/** The first day of the week for a choice and an interface language. */
export function resolveWeekStart(value: WeekStartChoice, locale: LocaleCode): WeekStart {
  if (value === "monday") return 1;
  if (value === "sunday") return 0;
  return sundayLocales.includes(locale) ? 0 : 1;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const unsubscribeLocale = subscribeLocale(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeLocale();
  };
}

/** The first day of the week now, following the setting and the interface language. */
export function useWeekStart(): WeekStart {
  return useSyncExternalStore(subscribe, () => resolveWeekStart(choice, currentLocale()));
}

export function useWeekStartChoice(): WeekStartChoice {
  return useSyncExternalStore(subscribe, () => choice);
}
