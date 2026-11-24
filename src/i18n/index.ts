import { en } from "./en";
import { isLocaleCode, type LocaleCode, matchLocale } from "./locales";

/**
 * The app's translations. English (`en/`) is the source: every other language file must have every key (a missing one
 * is a type error). A message is a string, or for counts a set of plural forms chosen by `Intl.PluralRules`; `{name}`
 * in a message is replaced by the parameter of that name.
 */
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };

type Messages = typeof en;
type Leaf = string | Plural;

/** Every message key as `namespace.key`. */
export type MessageKey = {
  [N in keyof Messages & string]: `${N}.${keyof Messages[N] & string}`;
}[keyof Messages & string];

/** The shape a translation must have: every namespace and key of the English source. */
export type Translation = {
  [N in keyof Messages]: { [K in keyof Messages[N]]: Messages[N][K] extends string ? string : Plural };
};

export type Params = Record<string, string | number>;

const storageKey = "kanbonk-language";
let locale: LocaleCode = "en";
let messages: Translation = en;
const listeners = new Set<() => void>();

const loaders = import.meta.glob<{ default: Translation }>("./locales/*.ts");

/** The language chosen in Settings on this device, or undefined to follow the browser or system. */
export function chosenLocale(): LocaleCode | undefined {
  try {
    const saved = localStorage.getItem(storageKey);
    return isLocaleCode(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

function systemLocale(): LocaleCode {
  return matchLocale(typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));
}

async function load(code: LocaleCode) {
  const next = code === "en" ? en : (await loaders[`./locales/${code}.ts`]()).default;
  locale = code;
  messages = next;
  if (typeof document !== "undefined") document.documentElement.lang = code;
  for (const listener of listeners) listener();
}

/** Loads the language to show: the one chosen in Settings, else the first supported language of the system. */
export async function initLocale(): Promise<void> {
  await load(chosenLocale() ?? systemLocale()).catch(() => undefined);
}

/** Chooses the interface language on this device; undefined follows the browser or system again. */
export async function chooseLocale(code: LocaleCode | undefined): Promise<void> {
  try {
    if (code) localStorage.setItem(storageKey, code);
    else localStorage.removeItem(storageKey);
  } catch {
    // Without storage the choice lasts until the app is closed.
  }
  await load(code ?? systemLocale());
}

export function currentLocale(): LocaleCode {
  return locale;
}

/** Calls `listener` whenever the language changes; returns the unsubscribe function. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(source: Translation, key: string): Leaf | undefined {
  const dot = key.indexOf(".");
  return (source as unknown as Record<string, Record<string, Leaf>>)[key.slice(0, dot)]?.[key.slice(dot + 1)];
}

/** The message for `key` in the current language (English when it has none), with `params` filled in. */
export function t(key: MessageKey, params?: Params): string {
  const entry = lookup(messages, key) ?? lookup(en, key) ?? key;
  let text: string;
  if (typeof entry === "string") text = entry;
  else {
    const form = new Intl.PluralRules(locale).select(Number(params?.count ?? 0)) as keyof Plural;
    text = entry[form] ?? entry.other;
  }
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : text;
}

/** Whether `text` is the message `key` in the current language, whatever its parameters. */
export function isMessage(text: string, key: MessageKey): boolean {
  const entry = lookup(messages, key) ?? lookup(en, key);
  if (typeof entry !== "string") return false;
  const pattern = entry
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\S]*");
  return new RegExp(`^${pattern}$`).test(text);
}

/** A date and time in the current language, e.g. "3/10/2026, 10:00 AM" in English. */
export function formatDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString(locale, options);
}

/** A date in the current language. */
export function formatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(locale, options);
}

/** A time of day in the current language. */
export function formatTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleTimeString(locale, options);
}
