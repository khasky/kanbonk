import { useState } from "react";

/** A set of strings kept in localStorage under `key`; `add` saves it at once. */
export function useStoredSet(key: string) {
  const [items, setItems] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      return new Set();
    }
  });
  function add(item: string) {
    setItems((current) => {
      const next = new Set(current);
      next.add(item);
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    });
  }
  return [items, add] as const;
}
