/** An element of a parsed XML document; `children` holds elements and text in document order. */
export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: Array<XmlElement | string>;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (text: string) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] !== "#") return entities[entity] ?? whole;
    const code =
      entity[1] === "x" || entity[1] === "X" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });

const attribute = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

/**
 * Parses well-formed XML (as in Office and OpenDocument files) into a tree; prefixes stay part of the names
 * (`w:p`, `text:p`). Declarations, comments and processing instructions are skipped. Works without a DOM, so the
 * same code runs in the app and in the unit tests.
 */
export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: "", attrs: {}, children: [] };
  const open: XmlElement[] = [root];
  const tag = /<(\/?)([^\s/>!?]+)([^>]*?)(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<[!?][^>]*>/g;
  let last = 0;
  for (let match = tag.exec(source); match; match = tag.exec(source)) {
    const parent = open[open.length - 1];
    if (match.index > last) parent.children.push(decode(source.slice(last, match.index)));
    last = tag.lastIndex;
    const [, closing, name, rest, selfClosing, cdata] = match;
    if (cdata !== undefined) parent.children.push(cdata);
    else if (!name) continue;
    else if (closing) {
      if (open.length > 1) open.pop();
    } else {
      const attrs: Record<string, string> = {};
      for (const pair of rest.matchAll(attribute)) attrs[pair[1]] = decode(pair[3] ?? pair[4]);
      const element: XmlElement = { name, attrs, children: [] };
      parent.children.push(element);
      if (!selfClosing) open.push(element);
    }
  }
  const element = root.children.find((child): child is XmlElement => typeof child !== "string");
  if (!element) throw new Error("Not an XML document");
  return element;
}

/** The child elements, optionally only those with this name. */
export const elements = (element: XmlElement | undefined, name?: string): XmlElement[] =>
  (element?.children ?? []).filter(
    (child): child is XmlElement => typeof child !== "string" && (!name || child.name === name),
  );

/** The first child element with this name. */
export const child = (element: XmlElement | undefined, name: string): XmlElement | undefined =>
  elements(element, name)[0];

/** The first element with this name anywhere below, depth first. */
export function find(element: XmlElement | undefined, name: string): XmlElement | undefined {
  for (const item of elements(element)) {
    if (item.name === name) return item;
    const found = find(item, name);
    if (found) return found;
  }
  return undefined;
}

/** Every element with this name anywhere below, in document order (not looking inside a match). */
export function findAll(element: XmlElement | undefined, name: string): XmlElement[] {
  return elements(element).flatMap((item) => (item.name === name ? [item] : findAll(item, name)));
}

/** All the text below the element. */
export const textOf = (element: XmlElement | undefined): string =>
  (element?.children ?? []).map((item) => (typeof item === "string" ? item : textOf(item))).join("");
