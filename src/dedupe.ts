import { recordRevisions, type AppState, type Card } from "./model";
import { moveToTrash } from "./trash";

const stopWords = new Set("a an the and or but nor so yet if then than that this these those there here of to in on at by for with from into onto over under about after before between through during without within up down out off again also just only very too not no is are was were be been being am do does did done have has had having it its it's he she they them their his her we us our you your i me my mine what which who whom whose when where why how all any both each few more most other some such own same can will would should could may might must shall let new".split(" "));

/** Ordered suffix rules: the first one that leaves a stem of at least 3 letters wins. */
const suffixes: [string, string][] = [["ations", "ate"], ["ation", "ate"], ["tions", "t"], ["tion", "t"], ["ments", ""], ["ment", ""], ["ings", ""], ["ing", ""], ["edly", ""], ["ed", ""], ["ies", "y"], ["ly", ""], ["es", ""], ["s", ""]];

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
  return (text.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).map((word) => word.replace(/^'+|'+$/g, "")).filter((word) => word.length > 1 && !stopWords.has(word)).map((word) => stem(word.replace(/'s$/, "")));
}

function trigrams(text: string): string[] {
  const clean = ` ${text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
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
  for (const token of card.checklists.flatMap((list) => list.items.flatMap((item) => stems(item.name))).slice(0, 100)) add(token, 0.5);
  return weights;
}

export interface DuplicatePair { a: Card; b: Card; score: number }

/** Finds pairs of semantically similar cards (TF-IDF cosine) — by default only across different boards. */
export function findDuplicates(state: AppState, options: { threshold?: number; crossBoardOnly?: boolean; ignored?: Set<string> } = {}): DuplicatePair[] {
  const threshold = options.threshold ?? 0.55;
  const crossBoardOnly = options.crossBoardOnly ?? true;
  const cards = state.cards.filter((card) => !card.deletedAt && !card.isTemplate && card.name.trim());
  const vectors = cards.map(features);
  const documentFrequency = new Map<string, number>();
  for (const vector of vectors) for (const token of vector.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
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
    for (const token of vector.keys()) if (!token.startsWith("#") && (documentFrequency.get(token) ?? 0) <= Math.max(50, count * 0.05)) {
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
    const entries = [...vector].map(([token, value]) => {
      let tokenId = tokenIds.get(token);
      if (tokenId === undefined) { tokenId = tokenIds.size; tokenIds.set(token, tokenId); }
      return [tokenId, value] as const;
    }).sort((first, second) => first[0] - second[0]);
    return { ids: Int32Array.from(entries, (entry) => entry[0]), values: Float64Array.from(entries, (entry) => entry[1]) };
  });
  const dot = (first: typeof sparse[number], second: typeof sparse[number]) => {
    let score = 0;
    for (let i = 0, j = 0; i < first.ids.length && j < second.ids.length;) {
      if (first.ids[i] === second.ids[j]) score += first.values[i++] * second.values[j++];
      else if (first.ids[i] < second.ids[j]) i++;
      else j++;
    }
    return score;
  };
  // stamp[y] === x marks y as already compared with x, so each pair is scored once without string keys.
  const stamp = new Int32Array(count).fill(-1);
  const pairs: DuplicatePair[] = [];
  for (let x = 0; x < count; x++) {
    const a = cards[x];
    for (const token of indexedTokens[x]) for (const y of index.get(token)!) {
      if (y <= x || stamp[y] === x) continue;
      stamp[y] = x;
      const b = cards[y];
      if (crossBoardOnly && a.boardId === b.boardId) continue;
      if (options.ignored?.has(pairKey(a.id, b.id))) continue;
      const score = dot(sparse[x], sparse[y]);
      if (score >= threshold) pairs.push({ a, b, score: Math.min(1, score) });
    }
  }
  return pairs.sort((first, second) => second.score - first.score);
}

export function pairKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

/** Moves comments, checklists, attachments and dependency links of `dropId` into `keepId`, then trashes `dropId`. */
export function mergeDuplicate(state: AppState, keepId: string, dropId: string, deviceId: string): AppState {
  const keep = state.cards.find((card) => card.id === keepId);
  const drop = state.cards.find((card) => card.id === dropId);
  if (!keep || !drop || keepId === dropId) return state;
  const attachmentKeys = new Set(keep.attachments.map((item) => item.sourceUrl ?? item.id));
  const merged: Card = {
    ...keep,
    description: drop.description.trim() && !keep.description.includes(drop.description.trim()) ? [keep.description.trim(), drop.description.trim()].filter(Boolean).join("\n\n---\n\n") : keep.description,
    comments: [...keep.comments, ...drop.comments.filter((comment) => !keep.comments.some((item) => item.id === comment.id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    checklists: [...keep.checklists, ...drop.checklists.filter((list) => !keep.checklists.some((item) => item.id === list.id))],
    attachments: [...keep.attachments, ...drop.attachments.filter((item) => !attachmentKeys.has(item.sourceUrl ?? item.id))],
    startAt: keep.startAt ?? drop.startAt,
    dueAt: keep.dueAt ?? drop.dueAt,
  };
  const relinked: string[] = [];
  let next: AppState = { ...state, cards: state.cards.map((card) => {
    if (card.id === keepId) return merged;
    if (card.id === dropId) return card;
    const links = card.checklists.some((list) => list.items.some((item) => item.linkedCardId === dropId)) || card.attachments.some((item) => item.linkedCardId === dropId);
    if (!links) return card;
    relinked.push(card.id);
    return {
      ...card,
      checklists: card.checklists.map((list) => ({ ...list, items: list.items.map((item) => item.linkedCardId === dropId ? { ...item, linkedCardId: keepId } : item) })),
      attachments: card.attachments.map((item) => item.linkedCardId === dropId ? { ...item, linkedCardId: keepId } : item),
    };
  }) };
  next = recordRevisions(next, [keepId, ...relinked].map((id) => ({ kind: "card" as const, id })), deviceId);
  return moveToTrash(next, "card", dropId, deviceId);
}
