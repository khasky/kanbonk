import { useMemo, useState } from "react";
import type { AppState, Board, Card } from "../model";
import { MarkdownText } from "../ui/MarkdownText";
import { aiProviders, boardContext, triageInbox, writeWithCitations, type AiSettings, type TriageItem } from "../ai/ai";
import { kanbonkCardForUrl } from "../model/links";
import { Button } from "../ui/Button";
import { Checkbox, Input, Select, Textarea } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { RowActions } from "../ui/PanelRow";
import { Segmented, SegmentedTab } from "../ui/Segmented";
import { t } from "../i18n";

const panelClass = "mt-5 flex flex-col gap-2 border-t border-line pt-3";

export interface ProposedCard extends TriageItem {
  listId: string;
}

/** AI over the board: inbound triage into cards, a cited project document, and questions with cited answers. */
export function AiPanel({
  state,
  board,
  settings,
  onOpenSettings,
  onCreateCards,
  onDocChange,
  onOpenCard,
}: {
  state: AppState;
  board: Board;
  settings: AiSettings | null;
  onOpenSettings: () => void;
  onCreateCards: (cards: ProposedCard[]) => void;
  onDocChange: (doc: string) => void;
  onOpenCard: (card: Card) => void;
}) {
  const [mode, setMode] = useState<"triage" | "doc" | "ask">("triage");
  const [inbound, setInbound] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposals, setProposals] = useState<Array<ProposedCard & { selected: boolean }>>([]);
  const [draft, setDraft] = useState<{ markdown: string; cited: number; invalid: number } | null>(null);
  const lists = state.lists
    .filter((item) => item.boardId === board.id && !item.deletedAt)
    .sort((a, b) => a.position - b.position);
  const context = useMemo(() => (mode === "triage" ? null : boardContext(state, board.id)), [mode, state, board.id]);
  const cardForUrl = (url: string) => kanbonkCardForUrl(url, state);

  if (!settings)
    return (
      <section className={panelClass}>
        <h3>{t("board.aiAssistant")}</h3>
        <Hint>{t("board.aiConnectHint")}</Hint>
        <Button variant="secondary" size="lg" className="self-start" onClick={onOpenSettings}>
          {t("board.connectAi")}
        </Button>
      </section>
    );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  const provider = aiProviders[settings.provider].name;
  return (
    <section className={panelClass} aria-label={t("board.aiAssistant")}>
      <header className="flex items-baseline gap-2">
        <h3 className="m-0">{t("board.aiAssistant")}</h3>
        <small className="mr-auto text-ink-muted">
          {provider} · {settings.model}
        </small>
        <Button variant="secondary" onClick={onOpenSettings}>
          {t("board.aiSettings")}
        </Button>
      </header>
      <Segmented label={t("board.aiAction")}>
        {(
          [
            ["triage", "board.triageInbox"],
            ["doc", "board.updateDoc"],
            ["ask", "board.askBoard"],
          ] as const
        ).map(([id, name]) => (
          <SegmentedTab
            key={id}
            selected={mode === id}
            onClick={() => {
              setMode(id);
              setError("");
              setDraft(null);
            }}
          >
            {t(name)}
          </SegmentedTab>
        ))}
      </Segmented>
      {mode === "triage" && (
        <>
          <Textarea
            className="w-full"
            value={inbound}
            onChange={(event) => setInbound(event.target.value)}
            placeholder={t("board.inboundPlaceholder")}
            aria-label={t("board.incomingMessages")}
            rows={6}
          />
          <Button
            variant="primary"
            disabled={busy || !inbound.trim() || !lists.length}
            onClick={() =>
              void run(async () =>
                setProposals(
                  (await triageInbox(settings, state, board.id, inbound)).map((item) => ({
                    ...item,
                    listId: lists.find((list) => list.name === item.list)?.id ?? lists[0].id,
                    selected: true,
                  })),
                ),
              )
            }
          >
            {busy ? t("board.triaging") : t("board.triageSend", { provider })}
          </Button>
          {proposals.length > 0 && (
            <div className="flex flex-col gap-2">
              {proposals.map((item, index) => (
                <div className="flex flex-col gap-1 rounded-lg border border-line p-2" key={index}>
                  <label className="flex items-center gap-1.5">
                    <Checkbox
                      checked={item.selected}
                      onChange={() =>
                        setProposals((current) =>
                          current.map((entry, position) =>
                            position === index ? { ...entry, selected: !entry.selected } : entry,
                          ),
                        )
                      }
                      aria-label={t("board.createCardOf", { title: item.title })}
                    />
                    <Input
                      size="sm"
                      className="min-w-0 flex-1"
                      value={item.title}
                      onChange={(event) =>
                        setProposals((current) =>
                          current.map((entry, position) =>
                            position === index ? { ...entry, title: event.target.value } : entry,
                          ),
                        )
                      }
                      aria-label={t("board.cardTitle")}
                    />
                  </label>
                  <Select
                    size="sm"
                    value={item.listId}
                    onChange={(event) =>
                      setProposals((current) =>
                        current.map((entry, position) =>
                          position === index ? { ...entry, listId: event.target.value } : entry,
                        ),
                      )
                    }
                    aria-label={t("board.list")}
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </Select>
                  {item.due && <small>{t("board.dueDateValue", { date: item.due })}</small>}
                  <blockquote className="m-0 border-l-[3px] border-line pl-2 text-[12px] text-ink-subtle">
                    {item.source}
                  </blockquote>
                </div>
              ))}
              <Button
                variant="primary"
                disabled={!proposals.some((item) => item.selected)}
                onClick={() => {
                  onCreateCards(proposals.filter((item) => item.selected));
                  setProposals([]);
                  setInbound("");
                }}
              >
                {t("board.createSelected", { count: proposals.filter((item) => item.selected).length })}
              </Button>
            </div>
          )}
        </>
      )}
      {mode !== "triage" && context && (
        <Hint>
          {context.truncated
            ? t("board.willBeSentTruncated", { provider, count: context.cards, truncated: context.truncated })
            : t("board.willBeSent", { provider, count: context.cards })}
        </Hint>
      )}
      {mode === "doc" && (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setDraft(
                await writeWithCitations(
                  settings,
                  state,
                  board.id,
                  "Update the project doc: goals, current status by list, risks and blockers, upcoming due dates, decisions made. Keep sections written by people.",
                  board.doc ?? "",
                ),
              ),
            )
          }
        >
          {busy ? t("board.writing") : t("board.draftDoc")}
        </Button>
      )}
      {mode === "ask" && (
        <div className="mt-2 flex gap-1.5">
          <Input
            size="sm"
            className="min-w-0 flex-1"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("board.askPlaceholder")}
            aria-label={t("board.askBoard")}
          />
          <Button
            variant="secondary"
            disabled={busy || !question.trim()}
            onClick={() =>
              void run(async () =>
                setDraft(
                  await writeWithCitations(
                    settings,
                    state,
                    board.id,
                    `Answer this question about the board: ${question}`,
                    board.doc ?? "",
                  ),
                ),
              )
            }
          >
            {busy ? t("board.thinking") : t("board.ask")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {draft && (
        <div className="rounded-lg border border-dashed border-brand px-3 py-2">
          <Hint>
            {draft.invalid
              ? t("board.draftLinksInvalid", { cited: draft.cited, invalid: draft.invalid })
              : t("board.draftLinks", { cited: draft.cited })}
          </Hint>
          <MarkdownText text={draft.markdown} localCardForUrl={cardForUrl} onNavigateCard={onOpenCard} />
          <RowActions>
            {mode === "doc" && (
              <Button
                variant="primary"
                onClick={() => {
                  onDocChange(draft.markdown);
                  setDraft(null);
                }}
              >
                {t("board.replaceDoc")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                onDocChange(
                  `${(board.doc ?? "").trimEnd()}\n\n${mode === "ask" ? `## ${question}\n\n` : ""}${draft.markdown}\n`,
                );
                setDraft(null);
              }}
            >
              {t("board.appendToDoc")}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setDraft(null)}>
              {t("board.discard")}
            </Button>
          </RowActions>
        </div>
      )}
    </section>
  );
}
