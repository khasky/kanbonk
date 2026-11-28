import type { Card } from "./types";

/** What fills a board's background, a workspace's tile or a card: one color, one gradient or one stored image. */
export interface Fill {
  color?: string;
  /** A key of `fillGradients`. */
  gradient?: string;
  /** A stored file (a card's: one of its attachments). */
  imageId?: string;
}

/** The standard colors offered for every fill, as in Trello. */
export const fillColors = [
  "#0c66e4",
  "#1f845a",
  "#a54800",
  "#c9372c",
  "#5e4db2",
  "#ae4787",
  "#5b7f24",
  "#227d9b",
  "#626f86",
  "#4bce97",
  "#f5cd47",
  "#fea362",
  "#f87168",
  "#9f8fef",
  "#579dff",
  "#6cc3e0",
  "#94c748",
  "#e774bb",
];

/** The standard gradients, keyed as Trello names them in its board preferences. */
export const fillGradients: Record<string, [string, string]> = {
  "gradient-snow": ["#e9f2ff", "#85b8ff"],
  "gradient-ocean": ["#0c66e4", "#09326c"],
  "gradient-crystal": ["#579dff", "#9f8fef"],
  "gradient-rainbow": ["#fdd0ec", "#c6edfb"],
  "gradient-peach": ["#fea362", "#f87168"],
  "gradient-flower": ["#e774bb", "#5e4db2"],
  "gradient-earth": ["#4bce97", "#1f6a52"],
  "gradient-alien": ["#352c63", "#1f845a"],
  "gradient-volcano": ["#c9372c", "#42221f"],
};

const hex = /^#[\da-f]{6}$/i;

export function gradientCss(stops: string[]): string {
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

/**
 * The CSS `background` of a fill; an image needs its loaded URL and, with `scrim`, is darkened so white text reads on
 * it. Without anything to show it is undefined.
 */
export function fillBackground(fill: Fill | undefined, imageUrl?: string, scrim = false): string | undefined {
  if (fill?.imageId && imageUrl)
    return `${scrim ? "linear-gradient(#0000004d, #0000008c), " : ""}url("${imageUrl}") center / cover no-repeat${fill.color ? ` ${fill.color}` : ""}`;
  const stops = fill?.gradient ? fillGradients[fill.gradient] : undefined;
  return stops ? gradientCss(stops) : fill?.color;
}

const darkText = "#172b4d";
const lightText = "#ffffff";

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Text that reads on the fill: white on an image (darkened by its scrim), else dark or white, whichever contrasts
 * better with the worst part of the color or gradient.
 */
export function fillTextColor(fill: Fill | undefined): string | undefined {
  if (fill?.imageId) return lightText;
  const stops = fill?.gradient ? fillGradients[fill.gradient] : fill?.color && hex.test(fill.color) ? [fill.color] : [];
  if (!stops?.length) return undefined;
  const worst = (text: string) => Math.min(...stops.map((stop) => contrast(text, stop)));
  return worst(darkText) > worst(lightText) ? darkText : lightText;
}

type Backdrop = { background?: string; backgroundGradient?: string; backgroundImageId?: string };

/** The fill of a board's or a workspace's background. */
export function backdropFill(item: Backdrop): Fill {
  return { color: item.background, gradient: item.backgroundGradient, imageId: item.backgroundImageId };
}

/** The board or workspace with the fill as its background; a gradient or image keeps a color under it. */
export function withBackdrop<T extends Backdrop>(item: T, fill: Fill): T {
  const stops = fill.gradient ? fillGradients[fill.gradient] : undefined;
  return {
    ...item,
    background: fill.color ?? stops?.[0] ?? item.background,
    backgroundGradient: fill.gradient,
    backgroundImageId: fill.imageId,
  };
}

/** The fill of a card: its cover's color, gradient or image attachment. */
export function coverFill(card: Card): Fill | undefined {
  return card.cover && { color: card.cover.color, gradient: card.cover.gradient, imageId: card.cover.attachmentId };
}

export function withCover(card: Card, fill: Fill | undefined): Card {
  return {
    ...card,
    cover: fill && { attachmentId: fill.imageId, color: fill.color, gradient: fill.gradient },
  };
}
