import { createElement, Fragment, type ReactNode, useSyncExternalStore } from "react";
import { currentLocale, type MessageKey, type Params, subscribeLocale, t } from "./index";
import type { LocaleCode } from "./locales";

/** The current language; a component using it renders again when the language changes. */
export function useLocale(): LocaleCode {
  return useSyncExternalStore(subscribeLocale, currentLocale);
}

/**
 * A message with elements in it, e.g. `tNodes("settings.defaultLocation", { place: <strong>{label}</strong> })` for
 * "Default: {place}". Plain `params` (such as `count`) are filled in as by `t`; each `{name}` of `nodes` becomes that
 * element, so translators can move it within the sentence.
 */
export function tNodes(key: MessageKey, nodes: Record<string, ReactNode>, params?: Params): ReactNode {
  const parts = t(key, params)
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return name && name in nodes ? nodes[name] : part;
    });
  // Passed as separate children, the parts need no keys.
  return createElement(Fragment, null, ...parts);
}
