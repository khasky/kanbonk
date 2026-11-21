import qrcode from "qrcode-generator";
import type { AppState, Card } from "../model";
import { linkHref } from "../lib/router";
import { saveFile } from "../lib/platform";

/** Absolute link that opens the card page in this app. */
export function cardLink(cardId: string, base = window.location.href): string {
  return new URL(linkHref(`/c/${encodeURIComponent(cardId)}`), base).href;
}

/** QR code for `text` as an SVG string. */
export function qrSvg(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/** Self-contained JSON description of a card with names resolved. */
export function cardExport(state: AppState, card: Card): Record<string, unknown> {
  const name = <T extends { id: string; name: string }>(items: T[], id?: string) =>
    items.find((item) => item.id === id)?.name;
  const members = state.boards.find((item) => item.id === card.boardId)?.members ?? [];
  return {
    format: "kanbonk-card-1",
    exportedAt: new Date().toISOString(),
    board: name(state.boards, card.boardId),
    list: name(state.lists, card.listId),
    parent: name(state.cards, card.parentCardId),
    labels: card.labelIds.flatMap((id) =>
      state.labels
        .filter((item) => item.id === id && !item.deleted)
        .map((item) => ({ name: item.name, color: item.color })),
    ),
    members: (card.memberIds ?? []).flatMap((id) => members.filter((item) => item.id === id).map((item) => item.name)),
    subCards: state.cards.filter((item) => item.parentCardId === card.id && !item.deletedAt).map((item) => item.name),
    card,
  };
}

const fileName = (card: Card, extension: string) =>
  `${
    card.name
      .replace(/[\\/:*?"<>|]+/g, " ")
      .trim()
      .slice(0, 80) || card.id
  }.${extension}`;

export function downloadCardJson(state: AppState, card: Card): Promise<boolean> {
  return saveFile(
    new Blob([JSON.stringify(cardExport(state, card), null, 2)], { type: "application/json" }),
    fileName(card, "json"),
  );
}

export async function downloadCardPng(element: HTMLElement, card: Card): Promise<boolean> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    filter: (node) => !(node instanceof HTMLElement && node.dataset.shareSkip !== undefined),
  });
  if (!blob) throw new Error("Could not create the image.");
  return saveFile(blob, fileName(card, "png"));
}

/** Prints only the card: `body.printing-card` hides everything else (see the print rules in styles/index.css). */
export function printCard(): void {
  document.body.classList.add("printing-card");
  const done = () => {
    document.body.classList.remove("printing-card");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
