import { useMemo, useState } from "react";
import type { AppState, Board, Card } from "./model";
import { MarkdownText } from "./MarkdownText";
import { aiProviders, boardContext, triageInbox, writeWithCitations, type AiProvider, type AiSettings, type TriageItem } from "./ai";
import { kanbonkCardForUrl } from "./links";

export interface ProposedCard extends TriageItem { listId: string }

/** AI over the board: inbound triage into cards, a cited project document, and questions with cited answers. */
export function AiPanel({ state, board, settings, onOpenSettings, onCreateCards, onDocChange, onOpenCard }: { state: AppState; board: Board; settings: AiSettings | null; onOpenSettings: () => void; onCreateCards: (cards: ProposedCard[]) => void; onDocChange: (doc: string) => void; onOpenCard: (card: Card) => void }) {
  const [mode, setMode] = useState<"triage" | "doc" | "ask">("triage");
  const [inbound, setInbound] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposals, setProposals] = useState<Array<ProposedCard & { selected: boolean }>>([]);
  const [draft, setDraft] = useState<{ markdown: string; cited: number; invalid: number } | null>(null);
  const lists = state.lists.filter((item) => item.boardId === board.id && !item.archived && !item.deletedAt).sort((a, b) => a.position - b.position);
  const context = useMemo(() => mode === "triage" ? null : boardContext(state, board.id), [mode, state, board.id]);
  const cardForUrl = (url: string) => kanbonkCardForUrl(url, state);

  if (!settings) return <section className="ai-panel"><h3>AI assistant</h3><p className="hint">Connect your own API key (Claude, ChatGPT, Gemini or a compatible server) to triage incoming tasks and keep a project doc with links to cards. The key is stored only on this device.</p><button onClick={onOpenSettings}>Connect AI</button></section>;

  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); }
  }
  const provider = aiProviders[settings.provider].name;
  return <section className="ai-panel" aria-label="AI assistant">
    <header className="ai-header"><h3>AI assistant</h3><small>{provider} · {settings.model}</small><button onClick={onOpenSettings}>Settings</button></header>
    <div className="segmented" role="tablist" aria-label="AI action">{([["triage", "Triage inbox"], ["doc", "Update doc"], ["ask", "Ask about this board"]] as const).map(([id, name]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => { setMode(id); setError(""); setDraft(null); }}>{name}</button>)}</div>
    {mode === "triage" && <>
      <textarea className="ai-input" value={inbound} onChange={(event) => setInbound(event.target.value)} placeholder="Paste emails, meeting notes, chat messages…" aria-label="Incoming messages" rows={6} />
      <button className="primary-button" disabled={busy || !inbound.trim() || !lists.length} onClick={() => void run(async () => setProposals((await triageInbox(settings, state, board.id, inbound)).map((item) => ({ ...item, listId: lists.find((list) => list.name === item.list)?.id ?? lists[0].id, selected: true }))))}>{busy ? "Triaging…" : `Triage (sends text to ${provider})`}</button>
      {proposals.length > 0 && <div className="ai-proposals">{proposals.map((item, index) => <div className="ai-proposal" key={index}>
        <label><input type="checkbox" checked={item.selected} onChange={() => setProposals((current) => current.map((entry, position) => position === index ? { ...entry, selected: !entry.selected } : entry))} aria-label={`Create card ${item.title}`} /><input value={item.title} onChange={(event) => setProposals((current) => current.map((entry, position) => position === index ? { ...entry, title: event.target.value } : entry))} aria-label="Card title" /></label>
        <select value={item.listId} onChange={(event) => setProposals((current) => current.map((entry, position) => position === index ? { ...entry, listId: event.target.value } : entry))} aria-label="List">{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
        {item.due && <small>Due date: {item.due}</small>}
        <blockquote>{item.source}</blockquote>
      </div>)}
        <button className="primary-button" disabled={!proposals.some((item) => item.selected)} onClick={() => { onCreateCards(proposals.filter((item) => item.selected)); setProposals([]); setInbound(""); }}>Create selected ({proposals.filter((item) => item.selected).length})</button>
      </div>}
    </>}
    {mode !== "triage" && context && <p className="hint">Will be sent to {provider}: {context.cards} cards from the board and the doc{context.truncated ? `; ${context.truncated} cards did not fit` : ""}.</p>}
    {mode === "doc" && <button className="primary-button" disabled={busy} onClick={() => void run(async () => setDraft(await writeWithCitations(settings, state, board.id, "Update the project doc: goals, current status by list, risks and blockers, upcoming due dates, decisions made. Keep sections written by people.", board.doc ?? "")))}>{busy ? "Writing…" : "Draft a new version of the doc"}</button>}
    {mode === "ask" && <div className="inline-form"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: what is blocking the release?" aria-label="Ask about this board" /><button disabled={busy || !question.trim()} onClick={() => void run(async () => setDraft(await writeWithCitations(settings, state, board.id, `Answer this question about the board: ${question}`, board.doc ?? "")))}>{busy ? "Thinking…" : "Ask"}</button></div>}
    {error && <p role="alert" className="ai-error">{error}</p>}
    {draft && <div className="ai-draft"><p className="hint">Card links: {draft.cited}{draft.invalid ? `; links to missing cards: ${draft.invalid} (marked)` : ""}.</p><MarkdownText text={draft.markdown} localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
      <div className="row-actions">{mode === "doc" && <button className="primary-button" onClick={() => { onDocChange(draft.markdown); setDraft(null); }}>Replace doc</button>}<button onClick={() => { onDocChange(`${(board.doc ?? "").trimEnd()}\n\n${mode === "ask" ? `## ${question}\n\n` : ""}${draft.markdown}\n`); setDraft(null); }}>Append to doc</button><button onClick={() => setDraft(null)}>Discard</button></div>
    </div>}
  </section>;
}

/** Provider, key and model; the key never leaves this device except in requests to the chosen provider. */
export function AiSettingsDialog({ settings, onSave, onClose }: { settings: AiSettings | null; onSave: (settings: AiSettings | null) => void; onClose: () => void }) {
  const [provider, setProvider] = useState<AiProvider>(settings?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(settings?.apiKey ?? "");
  const [model, setModel] = useState(settings?.model ?? aiProviders.anthropic.model);
  const [baseUrl, setBaseUrl] = useState(settings?.baseUrl ?? "");
  return <div className="dialog-backdrop" onMouseDown={onClose}><form className="creation-dialog ai-settings" role="dialog" aria-modal="true" aria-label="AI settings" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSave({ provider, apiKey: apiKey.trim(), model: model.trim(), baseUrl: provider === "compatible" ? baseUrl.trim() : undefined }); }}>
    <h2>AI assistant</h2>
    <label>Provider<select value={provider} onChange={(event) => { const next = event.target.value as AiProvider; setProvider(next); if (!model || Object.values(aiProviders).some((item) => item.model === model)) setModel(aiProviders[next].model); }}>{(Object.keys(aiProviders) as AiProvider[]).map((item) => <option key={item} value={item}>{aiProviders[item].name}</option>)}</select></label>
    {provider === "compatible" && <label>API URL<input type="url" required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:11434/v1" /></label>}
    <label>API key<input type="password" required={provider !== "compatible"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" /></label>
    <label>Model<input required value={model} onChange={(event) => setModel(event.target.value)} placeholder={provider === "anthropic" ? "claude-opus-5-5" : "Model name at the provider"} /></label>
    <p className="hint">The key is stored only in this browser (never synced, never in backups). Board data is sent to the provider only when you click an AI action button.{provider === "anthropic" ? " Claude models use a server-side fallback in case the model refuses." : ""}</p>
    <div>{settings && <button type="button" className="danger-button" onClick={() => onSave(null)}>Remove key</button>}<button type="button" onClick={onClose}>Cancel</button><button className="primary-button">Save</button></div>
  </form></div>;
}
