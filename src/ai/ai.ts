import { t } from "../i18n";
import type { AppState, Card } from "../model";
import { cardRef } from "../model/boardDoc";

/** Bring-your-own-key AI settings. Stored only in this browser's localStorage: never synced, never in backups. */
export type AiProvider = "anthropic" | "openai" | "compatible" | "gemini";
export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const aiProviders: Record<AiProvider, { name: string; model: string; baseUrl?: string }> = {
  anthropic: { name: "Anthropic (Claude)", model: "claude-opus-5-5" },
  openai: { name: "OpenAI (ChatGPT)", model: "" },
  gemini: { name: "Google (Gemini)", model: "", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/" },
  compatible: { name: "OpenAI-compatible URL", model: "" },
};

const storageKey = "kanbonk-ai";

export function readAiSettings(): AiSettings | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<AiSettings> | null;
    return saved?.provider &&
      saved.provider in aiProviders &&
      typeof saved.apiKey === "string" &&
      (saved.apiKey || saved.provider === "compatible") &&
      typeof saved.model === "string" &&
      saved.model
      ? (saved as AiSettings)
      : null;
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings | null): void {
  if (settings) localStorage.setItem(storageKey, JSON.stringify(settings));
  else localStorage.removeItem(storageKey);
}

type JsonSchema = Record<string, unknown>;

/** Server-side refusal fallbacks are available for these Claude models. */
const fallbackModels = /^claude-(opus-5-5|opus-5|fable-5-[12]|sonnet-5-5)$/;

/** One request that must answer with JSON matching `schema`. Sends data to the provider only when called. */
export async function completeJson<T>(
  settings: AiSettings,
  system: string,
  prompt: string,
  schema: JsonSchema,
  schemaName: string,
): Promise<T> {
  if (settings.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    const params = {
      model: settings.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user" as const, content: prompt }],
      output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema } },
    };
    try {
      const response = fallbackModels.test(settings.model)
        ? await client.beta.messages.create({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          })
        : await client.messages.create(params);
      if (response.stop_reason === "refusal") throw new Error(t("ai.refused"));
      if (response.stop_reason === "max_tokens") throw new Error(t("ai.cutOff"));
      const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      return JSON.parse(text) as T;
    } catch (cause) {
      if (cause instanceof Anthropic.AuthenticationError) throw new Error(t("ai.keyRejected"));
      if (cause instanceof Anthropic.RateLimitError) throw new Error(t("ai.rateLimited"));
      if (cause instanceof Anthropic.APIError)
        throw new Error(t("ai.apiError", { status: cause.status ?? "", message: cause.message }));
      throw cause;
    }
  }
  const { default: OpenAI } = await import("openai");
  const baseURL = settings.baseUrl || aiProviders[settings.provider].baseUrl;
  const client = new OpenAI({ apiKey: settings.apiKey || "none", baseURL, dangerouslyAllowBrowser: true });
  // Arbitrary compatible servers often support only JSON mode, so they get the schema in the prompt instead.
  const strict = settings.provider === "openai" || settings.provider === "gemini";
  try {
    const response = await client.chat.completions.create({
      model: settings.model,
      messages: [
        {
          role: "system",
          content: strict
            ? system
            : `${system}\n\nRespond only with JSON matching this schema:\n${JSON.stringify(schema)}`,
        },
        { role: "user", content: prompt },
      ],
      response_format: strict
        ? { type: "json_schema", json_schema: { name: schemaName, schema, strict: true } }
        : { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error(t("ai.emptyResponse"));
    return JSON.parse(text) as T;
  } catch (cause) {
    if (cause instanceof OpenAI.AuthenticationError) throw new Error(t("ai.keyRejected"));
    if (cause instanceof OpenAI.RateLimitError) throw new Error(t("ai.rateLimited"));
    if (cause instanceof OpenAI.APIError)
      throw new Error(t("ai.apiError", { status: cause.status ?? "", message: cause.message }));
    throw cause;
  }
}

/** Board context for prompts: one line per card with its ID so answers can cite cards. */
export function boardContext(
  state: AppState,
  boardId: string,
  limitChars = 400_000,
): { text: string; cards: number; truncated: number } {
  const lists = new Map(
    state.lists.filter((item) => item.boardId === boardId && !item.deletedAt).map((item) => [item.id, item]),
  );
  const cards = state.cards.filter(
    (item) => item.boardId === boardId && lists.has(item.listId) && !item.deletedAt && !item.isTemplate,
  );
  const board = state.boards.find((item) => item.id === boardId);
  const lines = [
    `Board: ${board?.name ?? ""}`,
    `Lists: ${[...lists.values()]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.name)
      .join(" | ")}`,
    "",
    "Cards (id | list | due date | title | description):",
  ];
  let size = lines.join("\n").length;
  let included = 0;
  for (const card of cards) {
    const line = `${card.id} | ${lists.get(card.listId)?.name} | ${card.dueAt?.slice(0, 10) ?? "-"} | ${card.name} | ${card.description.replace(/\s+/g, " ").slice(0, 300)}`;
    if (size + line.length > limitChars) break;
    lines.push(line);
    size += line.length + 1;
    included++;
  }
  return { text: lines.join("\n"), cards: included, truncated: cards.length - included };
}

export interface TriageItem {
  title: string;
  description: string;
  list: string;
  due: string | null;
  source: string;
}

const triageSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "list", "due", "source"],
        properties: {
          title: { type: "string", description: "A short action, up to 80 characters" },
          description: { type: "string", description: "What to do and the definition of done, Markdown" },
          list: { type: "string", description: "Name of one of the board’s existing lists" },
          due: {
            type: ["string", "null"],
            description: "Due date YYYY-MM-DD, only if the input text states it explicitly",
          },
          source: { type: "string", description: "Verbatim quote from the input text that the task comes from" },
        },
      },
    },
  },
};

/** Turns a chaotic inbound text (emails, notes, chat) into proposed cards, each quoting its source. */
export async function triageInbox(
  settings: AiSettings,
  state: AppState,
  boardId: string,
  inbound: string,
): Promise<TriageItem[]> {
  const lists = state.lists.filter((item) => item.boardId === boardId && !item.deletedAt).map((item) => item.name);
  const system =
    "You help run a project on a kanban board. Split the incoming messages into separate, verifiable tasks. Do not invent tasks that are not in the input text; the source field of each task is a verbatim quote. Write titles and descriptions in the same language as the input text.";
  const prompt = `Board lists: ${lists.join(" | ")}\n\nIncoming messages:\n"""\n${inbound}\n"""`;
  const result = await completeJson<{ cards: TriageItem[] }>(settings, system, prompt, triageSchema, "triage");
  // Keep only items whose quote really occurs in the input, and lists that exist.
  const normalized = inbound.replace(/\s+/g, " ").toLocaleLowerCase();
  return result.cards
    .filter(
      (item) => item.title.trim() && normalized.includes(item.source.replace(/\s+/g, " ").trim().toLocaleLowerCase()),
    )
    .map((item) => ({
      ...item,
      list: lists.includes(item.list) ? item.list : (lists[0] ?? ""),
      due: item.due && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : null,
    }));
}

const docSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["markdown"],
  properties: {
    markdown: {
      type: "string",
      description: "Markdown; every statement about the work links to cards as [title](/c/<id>)",
    },
  },
};

/** Writes or answers with Markdown that cites cards as `[name](/c/<id>)`; citations to unknown cards are marked. */
export async function writeWithCitations(
  settings: AiSettings,
  state: AppState,
  boardId: string,
  task: string,
  currentDoc: string,
): Promise<{ markdown: string; cited: number; invalid: number }> {
  const context = boardContext(state, boardId);
  const system =
    "You maintain the project documentation for a kanban board. Write only what follows from the cards and the current document. Back every statement about tasks, status or risks with a link to the source card in the form [title](/c/<id>), where id comes from the card list. Do not invent ids. Keep the decisions and agreements from the current document. Write in the same language as the board content and the current document (or the question, if one is asked).";
  const prompt = `${context.text}\n\nCurrent document:\n"""\n${currentDoc || "(empty)"}\n"""\n\nTask: ${task}`;
  const { markdown } = await completeJson<{ markdown: string }>(settings, system, prompt, docSchema, "document");
  const known = new Set(state.cards.filter((item) => item.boardId === boardId).map((item) => item.id));
  let cited = 0;
  let invalid = 0;
  const checked = markdown.replace(
    /\[([^\]]+)\]\(\/c\/([A-Za-z0-9_-]+)\)/g,
    (_match: string, name: string, id: string) => {
      if (known.has(id)) {
        cited++;
        const card = state.cards.find((item) => item.id === id) as Card;
        return cardRef(card);
      }
      invalid++;
      return `${name} ${t("ai.sourceNotFound")}`;
    },
  );
  return { markdown: checked, cited, invalid };
}
