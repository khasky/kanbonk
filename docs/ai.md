# AI assistant and the board document

Implementation: [`src/ai.ts`](../src/ai.ts), [`src/AiPanel.tsx`](../src/AiPanel.tsx), [`src/boardDoc.ts`](../src/boardDoc.ts), [`src/DocView.tsx`](../src/DocView.tsx). Tests: [`tests/ai.test.ts`](../tests/ai.test.ts), [`tests/boardDoc.test.ts`](../tests/boardDoc.test.ts).

## The board document (board + doc twin)

Every board has a project document next to it: the **Doc** tab of the board toolbar (`/b/<id>?view=doc`). It replaces the separate Google Doc, Confluence or Notion page teams keep beside a Trello board.

- **Project doc** is Markdown, edited with the same visual editor as card descriptions (**Write** / **Edit**). It is stored in `Board.doc`, has revisions and syncs like the rest of the board.
- **Link a card** inserts `[card name](/c/<cardId>)`. Links open the card modal, and the card shows **📄 Mentioned in the board doc** with a link back to the document.
- **Board status** on the right is computed live from the cards: totals, a table of lists, overdue cards, cards blocked by dependencies and cards due in the next 7 days, each with links. **Insert status snapshot** appends it to the document as `## Status on <date>`, so the document keeps a dated history of the project.

## Connecting an AI provider

**⋯ → AI assistant → Connect AI** (or **Settings** in the AI panel):

| Provider | Default model | Notes |
|---|---|---|
| Anthropic (Claude) | `claude-opus-5-5` | Official SDK, structured JSON output |
| OpenAI (ChatGPT) | set in the dialog | Official SDK, strict JSON schema |
| Google (Gemini) | set in the dialog | Gemini's OpenAI-compatible endpoint |
| OpenAI-compatible | set in the dialog | Any `/v1/chat/completions` server: LM Studio, Ollama, OpenRouter, a company gateway. **API URL** is required, the key is optional |

The key is the user's own (bring your own key). It is stored only in this device's `localStorage` (`kanbonk-ai`), is not synced to other devices and is not included in backups. **Remove key** removes it.

### Privacy

Nothing is sent until you press an action button. Requests go from the device straight to the provider; Kanbonk has no server in between.

- **Triage inbox** sends the list names of the board and the text you pasted.
- **Update doc** and **Ask about this board** send the current document and one line per card: ID, list, status, due date, title and the first 300 characters of the description, up to 400 000 characters in total. The panel says beforehand how many cards will be sent and how many did not fit.
- Attachments, comments, other boards and the trash are never sent.

## What the assistant does

The assistant turns a chaotic incoming stream of work into structured, checkable execution, and every result points to its source.

- **Triage inbox**: paste emails, meeting notes or chat messages. The assistant proposes cards: title, description, list and due date. Each proposal quotes the sentence it came from; proposals whose quote does not occur in the pasted text are dropped, so the assistant cannot invent work. You edit titles, pick lists, untick what you don't want and press **Create selected**. Created cards keep the quote in their description (`> Source: …`).
- **Update doc**: the assistant writes a new version of the board document from the cards, citing every claim as a card link. Citations to cards that do not exist are marked **[source not found]**. You review the draft and choose **Replace doc**, **Append to doc** or **Discard**; nothing changes without your click.
- **Ask about this board**: ask about the board ("what is blocking the release?") and get an answer with card links.

## Implementation notes

- `completeJson(settings, system, prompt, schema)` is the single call site for all providers. Claude uses `output_config.format` with a JSON schema; OpenAI and Gemini use `response_format: json_schema` (strict); compatible servers get `json_object` with the schema in the prompt.
- For the Claude models that support it, requests opt into server-side fallbacks (`fallbacks: "default"`), so an overloaded model is served by its fallback instead of failing.
- The prompts ask the model to write in the language of the board content: card proposals follow the language of the pasted text, the document and answers follow the cards and the current document (or the question).
- Refusals and truncated output (`max_tokens`) are reported as errors instead of being parsed.
- `triageInbox` and `writeWithCitations` validate the model's output against the board: unknown lists fall back to the first list, dates must be `YYYY-MM-DD`, citations must name existing cards.
