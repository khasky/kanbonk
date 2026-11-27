import { newId, recordRevisions, type AppState, type Card, type Comment } from "./index";
import { moveToTrash } from "./trash";

const stopWords = new Set(
  "a an the and or but nor so yet if then than that this these those there here of to in on at by for with from into onto over under about after before between through during without within up down out off again also just only very too not no is are was were be been being am do does did done have has had having it its it's he she they them their his her we us our you your i me my mine what which who whom whose when where why how all any both each few more most other some such own same can will would should could may might must shall let new".split(
    " ",
  ),
);

/** Ordered suffix rules: the first one that leaves a stem of at least 3 letters wins. */
const suffixes: [string, string][] = [
  ["ations", "ate"],
  ["ation", "ate"],
  ["tions", "t"],
  ["tion", "t"],
  ["ments", ""],
  ["ment", ""],
  ["ings", ""],
  ["ing", ""],
  ["edly", ""],
  ["ed", ""],
  ["ies", "y"],
  ["ly", ""],
  ["es", ""],
  ["s", ""],
];

/** Light deterministic English stemmer: strips one common suffix, a trailing "e", maps a final "y" to "i" and collapses a final double consonant. */
function stem(word: string): string {
  if (word.length <= 3 || /^\p{N}+$/u.test(word)) return word;
  let result = word;
  for (const [suffix, replacement] of suffixes) {
    if (!result.endsWith(suffix) || result.length - suffix.length < 3) continue;
    if (suffix === "s" && /(ss|us|is)$/.test(result)) break;
    result = result.slice(0, -suffix.length) + replacement;
    break;
  }
  if (result.length > 3 && result.endsWith("e")) result = result.slice(0, -1);
  if (result.length > 3 && result.endsWith("y")) result = `${result.slice(0, -1)}i`;
  if (result.length > 3 && /([b-df-hj-km-np-rtv-xz])\1$/.test(result)) result = result.slice(0, -1);
  return result;
}

/** Lowercase English word stems with stop words removed, so inflected forms ("preparing reports" / "prepare report") meet. */
export function stems(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .map((word) => stem(word.replace(/'s$/, "")));
}

function trigrams(text: string): string[] {
  const clean = ` ${text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
  const grams: string[] = [];
  for (let index = 0; index + 3 <= clean.length; index++) grams.push(`#${clean.slice(index, index + 3)}`);
  return grams;
}

function features(card: Card): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (token: string, weight: number) => weights.set(token, (weights.get(token) ?? 0) + weight);
  for (const token of stems(card.name)) add(token, 3);
  for (const token of trigrams(card.name)) add(token, 1);
  for (const token of stems(card.description).slice(0, 300)) add(token, 1);
  for (const token of card.checklists.flatMap((list) => list.items.flatMap((item) => stems(item.name))).slice(0, 100))
    add(token, 0.5);
  return weights;
}

export type MatchLevel = "strict" | "normal" | "loose";

/** Why two cards look like duplicates, from the closest kind of match to the loosest. */
export type MatchReason = "same" | "order" | "typo" | "extra" | "similar";

export const matchReasons: MatchReason[] = ["same", "order", "typo", "extra", "similar"];

export interface DuplicatePair {
  /** The card to keep by default: the one with more content. */
  keep: Card;
  drop: Card;
  score: number;
  reason: MatchReason;
}

const levelReasons: Record<MatchLevel, MatchReason[]> = {
  strict: ["same"],
  normal: ["same", "order", "typo"],
  loose: matchReasons,
};

/** A title's words, whatever the capitals, accents or punctuation. */
export function titleWords(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Levenshtein distance, giving up (returning `limit + 1`) once it cannot stay within `limit`. */
export function editDistance(first: string, second: string, limit = Number.POSITIVE_INFINITY): number {
  if (Math.abs(first.length - second.length) > limit) return limit + 1;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let i = 1; i <= first.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= second.length; j++) {
      const cost = first[i - 1] === second[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      best = Math.min(best, current[j]);
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[second.length];
}

/** Typos a word may have and still be the same word: none in short words, one from 4 letters, two from 8. */
const typoAllowance = (word: string) => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

const isNumber = (word: string) => /^\p{N}+$/u.test(word);

interface Title {
  words: string[];
  text: string;
  sorted: string;
  /** Numbers must match exactly: "Task 1" and "Task 2" are not typos of each other. */
  numbers: string;
}

function title(name: string): Title {
  const words = titleWords(name);
  return {
    words,
    text: words.join(" "),
    sorted: [...words].sort().join(" "),
    numbers: words.filter(isNumber).sort().join(" "),
  };
}

/** How close two titles with as many words are when each word may carry a few typos; undefined if they are not. */
function typoScore(first: string[], second: string[]): number | undefined {
  if (first.length !== second.length || !first.length) return undefined;
  let edits = 0;
  let letters = 0;
  for (let index = 0; index < first.length; index++) {
    const [a, b] = [first[index], second[index]];
    const allowance = Math.min(typoAllowance(a), typoAllowance(b));
    const distance = editDistance(a, b, allowance);
    if (distance > allowance) return undefined;
    edits += distance;
    letters += Math.max(a.length, b.length);
  }
  return edits ? 1 - edits / letters : undefined;
}

/** The closest kind of match between two card titles, with its score; undefined when the titles do not match. */
export function titleMatch(first: string, second: string): { reason: MatchReason; score: number } | undefined {
  return matchTitles(title(first), title(second));
}

function matchTitles(first: Title, second: Title): { reason: MatchReason; score: number } | undefined {
  if (!first.words.length || !second.words.length || first.numbers !== second.numbers) return undefined;
  if (first.text === second.text) return { reason: "same", score: 1 };
  if (first.sorted === second.sorted) return { reason: "order", score: 0.97 };
  const typo = typoScore(first.words, second.words) ?? typoScore([...first.words].sort(), [...second.words].sort());
  if (typo !== undefined) return { reason: "typo", score: Math.min(0.95, typo) };
  const [small, large] = first.words.length <= second.words.length ? [first, second] : [second, first];
  const larger = new Set(large.words);
  if (
    small.words.length >= 2 &&
    small.words.length < large.words.length &&
    small.words.every((word) => larger.has(word))
  )
    return { reason: "extra", score: small.words.length / large.words.length };
  return undefined;
}

/** How much a card holds, to keep the fuller card of a pair. */
export function cardContent(card: Card): number {
  return (
    (card.description.trim() ? 1 : 0) +
    card.comments.length +
    card.checklists.reduce((sum, list) => sum + list.items.length + 1, 0) +
    card.attachments.length +
    card.labelIds.length +
    (card.memberIds?.length ?? 0) +
    (card.dueAt ? 1 : 0)
  );
}

/** The keys a title is indexed under: its words and, so that typos meet, each word with one letter left out. */
function neighbourKeys(words: string[]): string[] {
  const keys = new Set<string>();
  for (const word of words) {
    if (isNumber(word)) continue;
    keys.add(word);
    if (typoAllowance(word))
      for (let index = 0; index < word.length; index++) keys.add(`~${word.slice(0, index)}${word.slice(index + 1)}`);
  }
  return [...keys];
}

/**
 * Pairs of cards on a board that look like the same task: the same title whatever the capitals, accents or
 * punctuation (strict); also words in another order and typos (normal); also a title with extra words or a similar
 * text (loose). With `sameList`, only cards in the same list are paired. The fuller card of a pair is the one to keep.
 */
export function findBoardDuplicates(
  state: AppState,
  boardId: string,
  options: { level?: MatchLevel; sameList?: boolean; ignored?: Set<string> } = {},
): DuplicatePair[] {
  const reasons = levelReasons[options.level ?? "normal"];
  const cards = state.cards.filter(
    (card) => card.boardId === boardId && !card.deletedAt && !card.isTemplate && card.name.trim(),
  );
  const titles = cards.map((card) => title(card.name));
  const found = new Map<string, DuplicatePair>();
  const consider = (x: number, y: number, match: { reason: MatchReason; score: number } | undefined) => {
    if (!match || !reasons.includes(match.reason)) return;
    const [a, b] = [cards[x], cards[y]];
    const key = pairKey(a.id, b.id);
    if ((options.sameList && a.listId !== b.listId) || options.ignored?.has(key)) return;
    const known = found.get(key);
    if (known && matchReasons.indexOf(known.reason) <= matchReasons.indexOf(match.reason)) return;
    const keepFirst = cardContent(a) >= cardContent(b);
    found.set(key, { keep: keepFirst ? a : b, drop: keepFirst ? b : a, ...match });
  };

  // Candidates share their whole title, a word, or a word with one letter left out; keys shared by too many cards
  // ("bug", "fix") say nothing and are skipped, so a big board stays fast. Identical titles are always compared.
  const index = new Map<string, number[]>();
  titles.forEach((item, position) => {
    for (const key of new Set([`=${item.sorted}`, ...neighbourKeys(item.words)])) {
      const bucket = index.get(key) ?? [];
      bucket.push(position);
      index.set(key, bucket);
    }
  });
  const cap = Math.max(50, cards.length * 0.05);
  const compared = new Set<number>();
  for (const [key, bucket] of index) {
    if (!key.startsWith("=") && bucket.length > cap) continue;
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        const [x, y] = [bucket[i], bucket[j]];
        const id = x * cards.length + y;
        if (compared.has(id)) continue;
        compared.add(id);
        consider(x, y, matchTitles(titles[x], titles[y]));
      }
  }
  if (reasons.includes("similar"))
    for (const [x, y, score] of similarPairs(cards, 0.55)) consider(x, y, { reason: "similar", score });

  return [...found.values()].sort((first, second) => second.score - first.score);
}

/** Finds pairs of semantically similar cards on any boards (TF-IDF cosine) — by default only across different boards. */
export function findDuplicates(
  state: AppState,
  options: { threshold?: number; crossBoardOnly?: boolean; ignored?: Set<string> } = {},
): { a: Card; b: Card; score: number }[] {
  const crossBoardOnly = options.crossBoardOnly ?? true;
  const cards = state.cards.filter((card) => !card.deletedAt && !card.isTemplate && card.name.trim());
  return similarPairs(cards, options.threshold ?? 0.55)
    .map(([x, y, score]) => ({ a: cards[x], b: cards[y], score }))
    .filter(({ a, b }) => !(crossBoardOnly && a.boardId === b.boardId) && !options.ignored?.has(pairKey(a.id, b.id)))
    .sort((first, second) => second.score - first.score);
}

/** Pairs of semantically similar cards (TF-IDF cosine over titles, descriptions and checklists), as card indexes. */
function similarPairs(cards: Card[], threshold: number): [number, number, number][] {
  const vectors = cards.map(features);
  const documentFrequency = new Map<string, number>();
  for (const vector of vectors)
    for (const token of vector.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  const count = cards.length;
  const weighted = vectors.map((vector) => {
    const result = new Map<string, number>();
    let norm = 0;
    for (const [token, frequency] of vector) {
      const value = frequency * Math.log(1 + count / (documentFrequency.get(token) ?? 1));
      result.set(token, value);
      norm += value * value;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [token, value] of result) result.set(token, value / norm);
    return result;
  });
  // Candidate pairs share at least one word stem that is not ubiquitous.
  const index = new Map<string, number[]>();
  const indexedTokens = weighted.map((vector, position) => {
    const tokens: string[] = [];
    for (const token of vector.keys())
      if (!token.startsWith("#") && (documentFrequency.get(token) ?? 0) <= Math.max(50, count * 0.05)) {
        tokens.push(token);
        const bucket = index.get(token) ?? [];
        bucket.push(position);
        index.set(token, bucket);
      }
    return tokens;
  });
  // Sparse vectors as token ids sorted ascending: a dot product is a linear merge instead of map lookups.
  const tokenIds = new Map<string, number>();
  const sparse = weighted.map((vector) => {
    const entries = [...vector]
      .map(([token, value]) => {
        let tokenId = tokenIds.get(token);
        if (tokenId === undefined) {
          tokenId = tokenIds.size;
          tokenIds.set(token, tokenId);
        }
        return [tokenId, value] as const;
      })
      .sort((first, second) => first[0] - second[0]);
    return {
      ids: Int32Array.from(entries, (entry) => entry[0]),
      values: Float64Array.from(entries, (entry) => entry[1]),
    };
  });
  const dot = (first: (typeof sparse)[number], second: (typeof sparse)[number]) => {
    let score = 0;
    for (let i = 0, j = 0; i < first.ids.length && j < second.ids.length; ) {
      if (first.ids[i] === second.ids[j]) score += first.values[i++] * second.values[j++];
      else if (first.ids[i] < second.ids[j]) i++;
      else j++;
    }
    return score;
  };
  // stamp[y] === x marks y as already compared with x, so each pair is scored once without string keys.
  const stamp = new Int32Array(count).fill(-1);
  const pairs: [number, number, number][] = [];
  for (let x = 0; x < count; x++) {
    for (const token of indexedTokens[x])
      for (const y of index.get(token)!) {
        if (y <= x || stamp[y] === x) continue;
        stamp[y] = x;
        const score = dot(sparse[x], sparse[y]);
        if (score >= threshold) pairs.push([x, y, Math.min(1, score)]);
      }
  }
  return pairs;
}

export function pairKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/** What a merge moves from the duplicate into the card kept: what the kept card does not have yet. */
export function mergeParts(state: AppState, keep: Card, drop: Card) {
  const attachmentKeys = new Set(keep.attachments.map((item) => item.sourceUrl ?? item.id));
  const sameBoard = keep.boardId === drop.boardId;
  const board = state.boards.find((item) => item.id === keep.boardId);
  // From another board, a label comes over as the kept board's label of the same name and colour, a member only when
  // they are on the kept board too.
  const labelIds = drop.labelIds
    .map((id) => {
      if (sameBoard) return id;
      const label = state.labels.find((item) => item.id === id);
      return state.labels.find(
        (item) => item.boardId === keep.boardId && item.name === label?.name && item.color === label?.color,
      )?.id;
    })
    .filter((id): id is string => Boolean(id) && !keep.labelIds.includes(id as string));
  const memberIds = (drop.memberIds ?? []).filter(
    (id) =>
      !(keep.memberIds ?? []).includes(id) && (sameBoard || (board?.members ?? []).some((member) => member.id === id)),
  );
  const description = drop.description.trim();
  return {
    description: description && !keep.description.includes(description) ? description : "",
    comments: drop.comments.filter((comment) => !keep.comments.some((item) => item.id === comment.id)),
    checklists: drop.checklists.filter((list) => !keep.checklists.some((item) => item.id === list.id)),
    attachments: drop.attachments.filter((item) => !attachmentKeys.has(item.sourceUrl ?? item.id)),
    labelIds: [...new Set(labelIds)],
    memberIds,
    dates: Boolean((!keep.startAt && drop.startAt) || (!keep.dueAt && drop.dueAt)),
  };
}

/** The comments a merge leaves on both cards, linking each to the other. */
export interface MergeNotes {
  author: string;
  /** For the kept card, e.g. "Merged with [Old name](/c/id)". */
  kept: string;
  /** For the duplicate in the trash, e.g. "Merged into [Name](/c/id)". */
  dropped: string;
}

/**
 * Moves the description, comments, checklists, attachments, labels, members, dates and dependency links of `dropId`
 * into `keepId`, then trashes `dropId` (it can be restored from the trash). With `notes`, both cards get a comment
 * linking to the other.
 */
export function mergeDuplicate(
  state: AppState,
  keepId: string,
  dropId: string,
  deviceId: string,
  notes?: MergeNotes,
  now = new Date().toISOString(),
): AppState {
  const keep = state.cards.find((card) => card.id === keepId);
  const drop = state.cards.find((card) => card.id === dropId);
  if (!keep || !drop || keepId === dropId) return state;
  const parts = mergeParts(state, keep, drop);
  const note = (text: string): Comment => ({
    id: newId(),
    text,
    author: notes?.author ?? "",
    authorDeviceId: deviceId,
    createdAt: now,
  });
  const merged: Card = {
    ...keep,
    description: parts.description
      ? [keep.description.trim(), parts.description].filter(Boolean).join("\n\n---\n\n")
      : keep.description,
    comments: [...keep.comments, ...parts.comments, ...(notes ? [note(notes.kept)] : [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
    checklists: [...keep.checklists, ...parts.checklists],
    attachments: [...keep.attachments, ...parts.attachments],
    labelIds: [...keep.labelIds, ...parts.labelIds],
    memberIds: parts.memberIds.length ? [...(keep.memberIds ?? []), ...parts.memberIds] : keep.memberIds,
    startAt: keep.startAt ?? drop.startAt,
    dueAt: keep.dueAt ?? drop.dueAt,
  };
  const dropped: Card = notes ? { ...drop, comments: [...drop.comments, note(notes.dropped)] } : drop;
  const relinked: string[] = [];
  let next: AppState = {
    ...state,
    cards: state.cards.map((card) => {
      if (card.id === keepId) return merged;
      if (card.id === dropId) return dropped;
      const links =
        card.checklists.some((list) => list.items.some((item) => item.linkedCardId === dropId)) ||
        card.attachments.some((item) => item.linkedCardId === dropId);
      if (!links) return card;
      relinked.push(card.id);
      return {
        ...card,
        checklists: card.checklists.map((list) => ({
          ...list,
          items: list.items.map((item) => (item.linkedCardId === dropId ? { ...item, linkedCardId: keepId } : item)),
        })),
        attachments: card.attachments.map((item) =>
          item.linkedCardId === dropId ? { ...item, linkedCardId: keepId } : item,
        ),
      };
    }),
  };
  next = recordRevisions(
    next,
    [keepId, ...(notes ? [dropId] : []), ...relinked].map((id) => ({ kind: "card" as const, id })),
    deviceId,
  );
  return moveToTrash(next, "card", dropId, deviceId);
}
