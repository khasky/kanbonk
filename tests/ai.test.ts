import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { boardContext, triageInbox, writeWithCitations, type AiSettings } from "../src/ai";
import { emptyState, type AppState, type Card } from "../src/model";

const card = (id: string, name: string): Card => ({ id, boardId: "b1", listId: "l1", name, description: "", position: 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [] });
const state: AppState = {
  ...emptyState(),
  boards: [{ id: "b1", workspaceId: "w", name: "Release", description: "", background: "#000", starred: false }],
  lists: [{ id: "l1", boardId: "b1", name: "Todo", position: 1 }, { id: "l2", boardId: "b1", name: "Doing", position: 2 }],
  cards: [card("api", "Fix API auth"), card("ui", "Polish UI")],
};

/** Records requests and answers like the provider would. */
function mockFetch(reply: (url: string, body: Record<string, unknown>) => unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = JSON.parse(String(init?.body ?? (input instanceof Request ? await input.text() : "{}")));
    calls.push({ url, body });
    return new Response(JSON.stringify(reply(url, body)), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}

const claudeMessage = (json: unknown) => ({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(json) }] });
const claude: AiSettings = { provider: "anthropic", apiKey: "test-key", model: "claude-opus-5-5" };

// src/ai.ts loads the provider SDKs on first use. Loading them here keeps that one-time module
// cost out of the tests, which only check what the requests and answers look like.
beforeAll(async () => {
  await Promise.all([import("@anthropic-ai/sdk"), import("openai")]);
});
afterEach(() => vi.unstubAllGlobals());

it("triages inbound text with Claude, keeping only items quoted from the input", async () => {
  const calls = mockFetch(() => claudeMessage({ cards: [
    { title: "Fix login timeout", description: "Users are logged out", list: "Doing", due: "2026-12-01", source: "login  times out after 5 minutes" },
    { title: "Invented task", description: "", list: "Todo", due: null, source: "this text is not in the input" },
    { title: "Unknown list", description: "", list: "Nope", due: "soon", source: "update the docs" },
  ] }));
  const inbound = "Hi! The login times out after 5 minutes. Also please update the docs.";
  const items = await triageInbox(claude, state, "b1", inbound);
  expect(items.map((item) => [item.title, item.list, item.due])).toEqual([["Fix login timeout", "Doing", "2026-12-01"], ["Unknown list", "Todo", null]]);
  expect(calls[0].url).toContain("api.anthropic.com/v1/messages");
  expect(calls[0].body.model).toBe("claude-opus-5-5");
  expect(calls[0].body.fallbacks).toBe("default");
  expect((calls[0].body.output_config as { format: { type: string } }).format.type).toBe("json_schema");
});

it("writes a document with OpenAI and marks citations to unknown cards", async () => {
  const calls = mockFetch(() => ({ id: "c", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ markdown: "Auth is in progress: [auth](/c/api). Risk: [ghost](/c/nope)." }) } }] }));
  const result = await writeWithCitations({ provider: "openai", apiKey: "k", model: "gpt-test" }, state, "b1", "Update the doc", "");
  expect(result).toEqual({ markdown: "Auth is in progress: [Fix API auth](/c/api). Risk: ghost [source not found].", cited: 1, invalid: 1 });
  expect(calls[0].url).toContain("api.openai.com/v1/chat/completions");
  expect((calls[0].body.response_format as { type: string }).type).toBe("json_schema");
  expect(JSON.stringify(calls[0].body.messages)).toContain("api | Todo | open");
});

it("uses JSON mode and the configured address for compatible servers", async () => {
  const calls = mockFetch(() => ({ id: "c", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "{\"markdown\":\"ok\"}" } }] }));
  await writeWithCitations({ provider: "compatible", apiKey: "", model: "llama", baseUrl: "http://localhost:11434/v1" }, state, "b1", "Q", "");
  expect(calls[0].url).toBe("http://localhost:11434/v1/chat/completions");
  expect((calls[0].body.response_format as { type: string }).type).toBe("json_object");
});

it("reports how many cards did not fit into the prompt", () => {
  const context = boardContext(state, "b1", 120);
  expect(context.cards + context.truncated).toBe(2);
  expect(context.truncated).toBeGreaterThan(0);
});
