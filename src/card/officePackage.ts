import { strFromU8, unzipSync } from "fflate";
import { parseXml, type XmlElement } from "../lib/xml";

/** A piece of a paragraph: text with its emphasis and link, or a picture. */
export type Run =
  | { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; href?: string }
  | { image: string; alt?: string };

export interface Paragraph {
  runs: Run[];
  /** 1–6 for a heading (a title is 1). */
  heading?: number;
  /** A list item: its nesting level from 0, and whether the list is numbered. */
  list?: { level: number; ordered: boolean };
}

export type Block = { paragraph: Paragraph } | { table: Paragraph[][][] };

export interface Sheet {
  name: string;
  rows: string[][];
  /** Whether rows or columns past the shown ones were left out. */
  cut: boolean;
}

/** What the preview shows of an office file: a document's blocks, a workbook's sheets or a deck's slides. */
export type OfficeContent =
  | { type: "document"; blocks: Block[] }
  | { type: "sheets"; sheets: Sheet[] }
  | { type: "slides"; slides: Block[][] };

/** A sheet is shown up to this many rows and columns. */
export const sheetLimits = { rows: 1000, columns: 100 };

/** A zip package's files, read as text or as data URLs on demand. */
export class Package {
  constructor(private files: Record<string, Uint8Array>) {}

  static open(data: ArrayBuffer) {
    return new Package(unzipSync(new Uint8Array(data)));
  }

  xml(path: string): XmlElement | undefined {
    const file = this.files[path];
    return file ? parseXml(strFromU8(file)) : undefined;
  }

  /** A picture of the package as a data URL, so the preview needs no object URLs to release. */
  image(path: string): string | undefined {
    const file = this.files[path];
    const type = imageTypes[path.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? ""];
    if (!file || !type) return undefined;
    let binary = "";
    for (let index = 0; index < file.length; index += 0x8000)
      binary += String.fromCharCode(...file.subarray(index, index + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  }
}

const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** A package path relative to the part at `from` (`word/document.xml` + `media/a.png` → `word/media/a.png`). */
export function resolvePath(from: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}
