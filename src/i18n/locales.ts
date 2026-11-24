/** The interface languages, the same set as Trello's; `name` is the language's own name, shown in Settings. */
export const locales = [
  { code: "en", name: "English" },
  { code: "cs", name: "Čeština" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "hu", name: "Magyar" },
  { code: "nl", name: "Nederlands" },
  { code: "nb", name: "Norsk bokmål" },
  { code: "pl", name: "Polski" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "fi", name: "Suomi" },
  { code: "sv", name: "Svenska" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "tr", name: "Türkçe" },
  { code: "ru", name: "Русский" },
  { code: "uk", name: "Українська" },
  { code: "th", name: "ไทย" },
  { code: "ja", name: "日本語" },
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
] as const;

export type LocaleCode = (typeof locales)[number]["code"];

const codes = new Set<string>(locales.map((item) => item.code));

/** The supported language for one language tag of the browser or system (`pt` → `pt-BR`, `zh-HK` → `zh-TW`). */
function supported(tag: string): LocaleCode | undefined {
  const [language, ...rest] = tag.toLowerCase().split(/[-_]/);
  if (language === "zh") return rest.some((part) => ["tw", "hk", "mo", "hant"].includes(part)) ? "zh-TW" : "zh-CN";
  if (language === "pt") return "pt-BR";
  if (language === "no" || language === "nn" || language === "nb") return "nb";
  return codes.has(language) ? (language as LocaleCode) : undefined;
}

/** The first supported language in the user's order of preference, like Trello's mobile app; English otherwise. */
export function matchLocale(preferred: readonly string[]): LocaleCode {
  for (const tag of preferred) {
    const match = supported(tag);
    if (match) return match;
  }
  return "en";
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && codes.has(value);
}
