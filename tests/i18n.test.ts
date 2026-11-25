import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { chooseLocale, currentLocale, isMessage, t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { locales, matchLocale } from "../src/i18n/locales";

it("picks the first supported language of the user's preferences", () => {
  expect(matchLocale(["ko-KR", "de-AT", "en"])).toBe("de");
  expect(matchLocale(["pt-PT"])).toBe("pt-BR");
  expect(matchLocale(["zh-HK"])).toBe("zh-TW");
  expect(matchLocale(["zh-Hans-CN"])).toBe("zh-CN");
  expect(matchLocale(["no"])).toBe("nb");
  expect(matchLocale(["ar"])).toBe("en");
});

it("fills in parameters and chooses plural forms by the language's rules", async () => {
  await chooseLocale("en");
  expect(t("common.days", { count: 1 })).toBe("1 day");
  expect(t("common.days", { count: 7 })).toBe("7 days");
  expect(t("settings.writeNowTitle", { folder: "backups" })).toBe("Write a backup to “backups” now?");
  await chooseLocale("ru");
  expect(currentLocale()).toBe("ru");
  expect(new Set([1, 3, 5].map((count) => t("common.days", { count }))).size).toBe(3);
  await chooseLocale(undefined);
});

const codes = locales.map((item) => item.code).filter((code) => code !== "en");
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

it("has a file for every language", () => {
  const files = readdirSync("src/i18n/locales").map((name) => name.replace(/\.ts$/, ""));
  expect(files.sort()).toEqual([...codes].sort());
});

it.each(codes.filter((code) => existsSync(`src/i18n/locales/${code}.ts`)))(
  "%s has every message with the placeholders and plural forms of English",
  async (code) => {
    expect(readFileSync(`src/i18n/locales/${code}.ts`, "utf8")).toContain("satisfies Translation");
    const { default: messages } = await import(`../src/i18n/locales/${code}.ts`);
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const [namespace, entries] of Object.entries(en))
      for (const [key, source] of Object.entries(entries)) {
        const name = `${namespace}.${key}`;
        const translated = messages[namespace]?.[key];
        expect(translated, name).toBeDefined();
        if (typeof source === "string") {
          expect(typeof translated, name).toBe("string");
          expect(placeholders(translated), name).toEqual(placeholders(source));
          continue;
        }
        for (const category of categories) expect(translated[category], `${name} ${category}`).toBeTypeOf("string");
        expect(placeholders(translated.other), name).toEqual(placeholders(source.other));
        for (const form of Object.values<string>(translated))
          expect(
            placeholders(form).filter((item) => item !== "count"),
            name,
          ).toEqual(placeholders(source.other).filter((item) => item !== "count"));
      }
  },
);

it("recognizes a message whatever its parameters", () => {
  expect(isMessage(t("trello.attachmentNotDownloaded", { name: "a (1).png" }), "trello.attachmentNotDownloaded")).toBe(
    true,
  );
  expect(isMessage(t("trello.zipUnreadable", { name: "x" }), "trello.attachmentNotDownloaded")).toBe(false);
});
