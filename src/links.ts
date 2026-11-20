import type { AppState, Card } from "./model";

export interface RelatedCard {
  url: string;
  source: string;
  target?: Card;
}

const cardUrl = /https?:\/\/(?:www\.)?trello\.com\/c\/([A-Za-z0-9]+)(?:\/[^\s)\]>]*)?/g;

/** Card behind a Kanbonk link: `/c/<id>`, `#/c/<id>` (extension) or a shared absolute link to a card of this state. */
export function kanbonkCardForUrl(url: string, state: AppState): Card | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url, "http://kanbonk.local/");
  } catch {
    return undefined;
  }
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || /(^|\.)trello\.com$/.test(parsed.hostname))
    return undefined;
  const id = /^\/c\/([A-Za-z0-9_-]+)\/?$/.exec(parsed.hash ? parsed.hash.slice(1) : parsed.pathname)?.[1];
  return id ? state.cards.find((card) => card.id === id) : undefined;
}

export function importedCardForUrl(url: string, state: AppState): Card | undefined {
  const local = kanbonkCardForUrl(url, state);
  if (local) return local;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
  if (parsed.hostname !== "trello.com" && parsed.hostname !== "www.trello.com") return undefined;
  const id = /^\/c\/([A-Za-z0-9]+)(?:\/|$)/.exec(parsed.pathname)?.[1];
  return id ? state.cards.find((card) => card.sourceTrelloShortLink === id || card.sourceTrelloId === id) : undefined;
}

export function relatedCards(card: Card, state: AppState): RelatedCard[] {
  const direct = [
    ...card.checklists.flatMap((checklist) =>
      checklist.items
        .filter((item) => item.linkedCardId)
        .map((item) => ({ id: item.linkedCardId!, source: checklist.name })),
    ),
    ...card.attachments
      .filter((attachment) => attachment.linkedCardId)
      .map((attachment) => ({ id: attachment.linkedCardId!, source: "Attachment" })),
  ];
  const sources = [
    { text: card.name, source: "Title" },
    { text: card.description, source: "Description" },
    ...card.checklists.flatMap((checklist) =>
      checklist.items.map((item) => ({ text: item.name, source: checklist.name })),
    ),
    ...card.attachments
      .filter((attachment) => attachment.status === "link")
      .map((attachment) => ({ text: attachment.sourceUrl || "", source: "Attachment" })),
  ];
  const links: RelatedCard[] = direct.map((item) => ({
    url: `kanbonk://card/${item.id}`,
    source: item.source,
    target: state.cards.find((card) => card.id === item.id),
  }));
  const seen = new Set(links.map((item) => `${item.source}\0${item.url}`));
  for (const source of sources) {
    for (const match of source.text.matchAll(cardUrl)) {
      const key = `${source.source}\0${match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const target = importedCardForUrl(match[0], state);
      links.push({ url: match[0], source: source.source, target });
    }
  }
  return links;
}
