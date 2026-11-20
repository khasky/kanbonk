import { afterEach, expect, it, vi } from "vitest";
import { readLocalAuthor, saveLocalAuthor } from "../src/storage";

afterEach(() => vi.unstubAllGlobals());

it("keeps comment authors distinct across devices and saves a chosen local name", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  values.set("kanbonk-device-id", "device-one");
  expect(readLocalAuthor()).toBe("Member device");
  values.set("kanbonk-device-id", "other-device");
  expect(readLocalAuthor()).toBe("Member other-");
  expect(saveLocalAuthor("  Anna  ")).toBe("Anna");
  expect(readLocalAuthor()).toBe("Anna");
  expect(() => saveLocalAuthor(" ")).toThrow("Enter a name");
  values.set("kanbonk-author-name", "x".repeat(61));
  expect(readLocalAuthor()).toBe("Member other-");
});
