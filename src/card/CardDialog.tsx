import { useEffect, useMemo, useRef, useState } from "react";
import { CardPicker } from "../CardPicker";
import { MarkdownEditor } from "../MarkdownEditor";
import { MarkdownText } from "../MarkdownText";
import { cardActivityFeed } from "../activity";
import { mentionedCardIds } from "../boardDoc";
import { cardCreatedAt } from "../calendar";
import { localDateTime } from "../format";
import { inboxBoardId } from "../inbox";
import { labelColorOptions, readableTextColor } from "../labels";
import { importedCardForUrl, relatedCards } from "../links";
import {
  canEditComment,
  isCardAvailable,
  newId,
  parentCandidates,
  subCards,
  type AppState,
  type Card,
  type Member,
} from "../model";
import { cardLink, downloadCardJson, downloadCardPng, printCard, qrSvg } from "../share";
import { dependentsOf, prerequisitesOf } from "../trash";
import { Icon } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { AttachmentRow } from "./AttachmentRow";
import { ChecklistSection } from "./ChecklistSection";
import { CoverPicker } from "./CoverPicker";

export const stickerChoices = [
  { symbol: "⭐", name: "Star" },
  { symbol: "✅", name: "Done" },
  { symbol: "🎉", name: "Party" },
  { symbol: "🚀", name: "Rocket" },
  { symbol: "🔥", name: "Fire" },
  { symbol: "💡", name: "Idea" },
];

export const reminderOptions = [
  { minutes: 0, label: "At due time" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 2880, label: "2 days before" },
  { minutes: 10080, label: "1 week before" },
];

export function CardDialog({
  card,
  state,
  lists,
  authorName,
  currentDeviceId,
  asPage,
  onDelete,
  onClose,
  onChange,
  onAttach,
  onAddStickerImage,
  onDownload,
  onNavigateCard,
  onTransfer,
  onArchive,
  onHistory,
  onRunAutomation,
  onAddMember,
  onAddLabel,
  onEditLabel,
  onDeleteLabel,
  onAddDependency,
  onRemoveDependency,
  onConvertChecklistItem,
  team,
  onClone,
  onCreateSubCard,
  onOpenDoc,
}: {
  card: Card;
  state: AppState;
  lists: AppState["lists"];
  authorName: string;
  currentDeviceId: string;
  asPage?: boolean;
  onDelete: () => void;
  onClose: () => void;
  onChange: (change: (card: Card) => Card) => void;
  onAttach: (files: FileList | null) => void;
  onAddStickerImage: (file: File | null) => void;
  onDownload: (id: string, name: string) => void;
  onNavigateCard: (target: Card) => void;
  onTransfer: (targetListId: string, copy: boolean) => void;
  onArchive: () => void;
  onHistory: () => void;
  onRunAutomation: (ruleId: string) => void;
  onAddMember: (member: Member) => void;
  onAddLabel: (name: string, color: string) => void;
  onEditLabel: (id: string, name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
  onAddDependency: (targetId: string) => void;
  onRemoveDependency: (dependentId: string, prerequisiteId: string) => void;
  onConvertChecklistItem: (checklistId: string, itemId: string) => void;
  team: Member[];
  onClone: () => void;
  onCreateSubCard: (name: string) => void;
  onOpenDoc: () => void;
}) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [writingComment, setWritingComment] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [subCardName, setSubCardName] = useState("");
  const [choosingParent, setChoosingParent] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#4bce97");
  const [showLabels, setShowLabels] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [editingLabelColor, setEditingLabelColor] = useState("#4bce97");
  const [showMembers, setShowMembers] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showChecklistComposer, setShowChecklistComposer] = useState(false);
  const [checklistName, setChecklistName] = useState("Checklist");
  const [copyChecklistId, setCopyChecklistId] = useState("");
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkError, setLinkError] = useState("");
  const [destinationBoardId, setDestinationBoardId] = useState(card.boardId);
  const [destinationListId, setDestinationListId] = useState(card.listId);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const boardLabels = state.labels.filter((item) => item.boardId === card.boardId && !item.deleted);
  const boardMembers = state.boards.find((item) => item.id === card.boardId)?.members ?? [];
  const assignable = [...boardMembers, ...team.filter((member) => !boardMembers.some((item) => item.id === member.id))];
  const canAssign = assignable.some((member) => member.id !== currentDeviceId);
  const children = subCards(state, card.id).filter((item) => isCardAvailable(state, item));
  const parentCard = state.cards.find((item) => item.id === card.parentCardId && isCardAvailable(state, item));
  const mentionedInDoc = mentionedCardIds(state.boards.find((item) => item.id === card.boardId)?.doc ?? "").has(
    card.id,
  );
  async function share(action: "print" | "png" | "json" | "link") {
    setShareStatus("");
    try {
      if (action === "print") printCard();
      else if (action === "png") {
        if (dialogRef.current && (await downloadCardPng(dialogRef.current, card))) setShareStatus("Image saved.");
      } else if (action === "json") {
        if (await downloadCardJson(state, card)) setShareStatus("JSON saved.");
      } else {
        await navigator.clipboard.writeText(cardLink(card.id));
        setShareStatus("Link copied.");
      }
    } catch (cause) {
      setShareStatus(`Something went wrong: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  const cardButtons = card.isTemplate
    ? []
    : (state.boards
        .find((item) => item.id === card.boardId)
        ?.automationRules?.filter((rule) => rule.trigger === "button") ?? []);
  const availableBoards = state.boards.filter(
    (item) => !item.archived && state.lists.some((list) => list.boardId === item.id && !list.archived),
  );
  const destinationLists = state.lists
    .filter((item) => item.boardId === destinationBoardId && !item.archived)
    .sort((a, b) => a.position - b.position);
  const availableDependencies = useMemo(
    () => (showDependencies ? state.cards.filter((item) => item.id !== card.id && isCardAvailable(state, item)) : []),
    [showDependencies, state, card.id],
  );
  const availableChecklists = !showChecklistComposer
    ? []
    : state.cards
        .filter((item) => item.boardId === card.boardId && isCardAvailable(state, item))
        .flatMap((item) => item.checklists.map((checklist) => ({ checklist, cardName: item.name })));
  const related = relatedCards(card, state);
  const activityFeed = cardActivityFeed(state, card, showActivityDetails);
  const localCardForUrl = (url: string) => {
    const target = importedCardForUrl(url, state);
    return target && isCardAvailable(state, target) ? target : undefined;
  };
  function addChecklist() {
    const source = availableChecklists.find(({ checklist }) => checklist.id === copyChecklistId)?.checklist;
    const name = checklistName.trim() || source?.name || "Checklist";
    onChange((item) => ({
      ...item,
      checklists: [
        ...item.checklists,
        { id: newId(), name, items: source?.items.map((entry) => ({ ...entry, id: newId() })) ?? [] },
      ],
    }));
    setShowChecklistComposer(false);
    setChecklistName("Checklist");
    setCopyChecklistId("");
  }
  function addComment(markdown: string) {
    const text = markdown.trim();
    if (text)
      onChange((item) => ({
        ...item,
        comments: [
          ...item.comments,
          {
            id: newId(),
            text,
            author: authorName,
            authorDeviceId: currentDeviceId,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    setWritingComment(false);
  }
  function saveComment(markdown: string) {
    const text = markdown.trim();
    if (
      !editingCommentId ||
      !text ||
      !card.comments.some((entry) => entry.id === editingCommentId && canEditComment(entry, currentDeviceId))
    )
      return;
    onChange((item) => ({
      ...item,
      comments: item.comments.map((entry) => (entry.id === editingCommentId ? { ...entry, text } : entry)),
    }));
    setEditingCommentId(null);
  }
  function deleteComment(id: string) {
    if (!card.comments.some((entry) => entry.id === id && canEditComment(entry, currentDeviceId))) return;
    onChange((item) => ({ ...item, comments: item.comments.filter((entry) => entry.id !== id) }));
    if (editingCommentId === id) setEditingCommentId(null);
  }
  function addUrlAttachment() {
    try {
      const url = new URL(linkUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL");
      onChange((item) => ({
        ...item,
        attachments: [
          ...item.attachments,
          {
            id: newId(),
            name: linkName.trim() || url.hostname,
            mimeType: "text/uri-list",
            size: 0,
            sourceUrl: url.href,
            status: "link",
          },
        ],
      }));
      setLinkUrl("");
      setLinkName("");
      setLinkError("");
      setShowLinkEditor(false);
    } catch {
      setLinkError("Enter a link starting with http:// or https://.");
    }
  }
  function removeAttachment(attachment: Card["attachments"][number]) {
    if (attachment.linkedCardId) onRemoveDependency(attachment.linkedCardId, card.id);
    else
      onChange((item) => ({
        ...item,
        attachments: item.attachments.filter((entry) => entry.id !== attachment.id),
        cover: item.cover?.attachmentId === attachment.id ? undefined : item.cover,
      }));
  }
  const prerequisiteCards = prerequisitesOf(state, card.id).flatMap((id) =>
    state.cards.filter((item) => item.id === id),
  );
  const dependentCards = dependentsOf(state, card.id);
  const created = cardCreatedAt(state, card);
  const body = (
    <div
      className={asPage ? "card-dialog card-page" : "card-dialog"}
      role={asPage ? "region" : "dialog"}
      aria-modal={asPage ? undefined : true}
      aria-label={card.name}
      tabIndex={-1}
      ref={dialogRef}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="card-dialog-top">
        <select value={card.listId} onChange={(event) => onTransfer(event.target.value, false)} aria-label="Card list">
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
        <div>
          <button onClick={onHistory} aria-label="Card history">
            <Icon name="history" />
          </button>
          <button onClick={onClose} aria-label="Close card">
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="card-dialog-body">
        <div className="card-detail-main">
          <div className="card-title-row">
            {!card.isTemplate && (
              <button
                className={`complete-toggle ${card.completed ? "done" : ""}`}
                onClick={() => onChange((item) => ({ ...item, completed: !item.completed }))}
                aria-label={card.completed ? "Mark incomplete" : "Mark complete"}
              >
                {card.completed && "✓"}
              </button>
            )}
            <NameEditor
              value={card.name}
              label="Card title"
              onCommit={(name) => onChange((item) => ({ ...item, name }))}
            />
          </div>
          <p className="card-meta-line">
            in list “{lists.find((item) => item.id === card.listId)?.name ?? "—"}” ·{" "}
            {state.boards.find((item) => item.id === card.boardId)?.name}
            {created ? ` · created ${new Date(created).toLocaleString("en-US")}` : ""} · ID {card.id}
          </p>
          <div className="card-actions">
            {cardButtons.map((rule) => (
              <button key={rule.id} onClick={() => onRunAutomation(rule.id)}>
                {rule.name}
              </button>
            ))}
            {card.boardId !== inboxBoardId && (
              <>
                <button onClick={() => onChange((item) => ({ ...item, isTemplate: !item.isTemplate }))}>
                  {card.isTemplate ? "Remove template" : "Make template"}
                </button>
                {canAssign && <button onClick={() => setShowMembers(!showMembers)}>Members</button>}
                <button onClick={() => setShowLabels(!showLabels)}>Labels</button>
              </>
            )}
            <button onClick={() => setShowCover(!showCover)}>Cover</button>
            <button onClick={() => setShowStickers(!showStickers)}>Stickers</button>
            {!card.isTemplate && (
              <button onClick={() => document.getElementById(`due-${card.id}`)?.focus()}>Due date</button>
            )}
            <button onClick={() => setShowChecklistComposer(!showChecklistComposer)}>Checklist</button>
            <label className="file-button">
              Attachment
              <input
                type="file"
                multiple
                onChange={(event) => {
                  onAttach(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <button onClick={() => setShowLinkEditor(!showLinkEditor)}>Link</button>
            <button onClick={() => setShowTransfer(!showTransfer)}>Move / copy</button>
            <button onClick={onClone}>Clone</button>
            <button onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>
              Share
            </button>
            {card.boardId !== inboxBoardId && (
              <button onClick={() => setShowDependencies(!showDependencies)}>Dependency</button>
            )}
          </div>
          {showShare && (
            <section className="transfer-picker share-panel" aria-label="Share card" data-share-skip>
              <strong>Share</strong>
              <div className="share-actions">
                <button onClick={() => void share("print")}>Print</button>
                <button onClick={() => void share("png")}>PNG</button>
                <button onClick={() => void share("json")}>JSON</button>
                <button onClick={() => void share("link")}>Copy link</button>
                <button onClick={() => setShowQr(!showQr)} aria-pressed={showQr}>
                  QR code
                </button>
              </div>
              {showQr && (
                <figure className="share-qr">
                  <span
                    role="img"
                    aria-label="QR code for the card link"
                    dangerouslySetInnerHTML={{ __html: qrSvg(cardLink(card.id)) }}
                  />
                  <figcaption>{cardLink(card.id)}</figcaption>
                </figure>
              )}
              {shareStatus && <p role="status">{shareStatus}</p>}
            </section>
          )}
          {showChecklistComposer && (
            <section className="transfer-picker checklist-composer" aria-label="New checklist">
              <strong>New checklist</strong>
              <label>
                Title
                <input
                  value={checklistName}
                  onChange={(event) => setChecklistName(event.target.value)}
                  aria-label="New checklist title"
                />
              </label>
              <label>
                Copy items from
                <select
                  value={copyChecklistId}
                  onChange={(event) => {
                    setCopyChecklistId(event.target.value);
                    const source = availableChecklists.find(
                      ({ checklist }) => checklist.id === event.target.value,
                    )?.checklist;
                    if (source && checklistName === "Checklist") setChecklistName(source.name);
                  }}
                  aria-label="Copy items from"
                >
                  <option value="">Don't copy</option>
                  {availableChecklists.map(({ checklist, cardName }) => (
                    <option key={checklist.id} value={checklist.id}>
                      {cardName} / {checklist.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <button className="primary-button" onClick={addChecklist}>
                  Add checklist
                </button>
                <button onClick={() => setShowChecklistComposer(false)}>Cancel</button>
              </div>
            </section>
          )}
          {card.isTemplate && (
            <p className="template-notice">
              This is a card template. Dates aren't copied when you create a card from it.
            </p>
          )}
          {showCover && <CoverPicker card={card} onChange={onChange} onClose={() => setShowCover(false)} />}
          {showStickers && (
            <section className="sticker-picker" aria-label="Card stickers">
              <strong>Stickers</strong>
              <div className="sticker-options">
                {stickerChoices.map(({ symbol, name }) => (
                  <button
                    key={symbol}
                    onClick={() => onChange((item) => ({ ...item, stickers: [...(item.stickers ?? []), symbol] }))}
                    aria-label={`Add sticker ${name}`}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
              <label className="file-button">
                Custom image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  onChange={(event) => {
                    onAddStickerImage(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </label>
              {(card.stickers ?? []).length > 0 && (
                <div className="sticker-current">
                  {card.stickers!.map((symbol, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        onChange((item) => ({
                          ...item,
                          stickers: (item.stickers ?? []).filter((_, position) => position !== index),
                        }))
                      }
                      aria-label={`Remove sticker ${index + 1}`}
                    >
                      {typeof symbol === "string" ? symbol : symbol.name} ×
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          {showTransfer && (
            <section className="transfer-picker" aria-label="Move or copy card">
              <strong>Choose a destination</strong>
              <label>
                Board
                <select
                  value={destinationBoardId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setDestinationBoardId(id);
                    setDestinationListId(
                      state.lists
                        .filter((item) => item.boardId === id && !item.archived)
                        .sort((a, b) => a.position - b.position)[0]?.id ?? "",
                    );
                  }}
                >
                  {availableBoards.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                List
                <select value={destinationListId} onChange={(event) => setDestinationListId(event.target.value)}>
                  {destinationLists.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <button onClick={() => onTransfer(destinationListId, false)} disabled={!destinationListId}>
                  Move
                </button>
                <button onClick={() => onTransfer(destinationListId, true)} disabled={!destinationListId}>
                  Copy
                </button>
              </div>
            </section>
          )}
          {showLinkEditor && (
            <section className="transfer-picker link-editor" aria-label="Add link">
              <strong>Website link</strong>
              <label>
                URL
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(event) => {
                    setLinkUrl(event.target.value);
                    setLinkError("");
                  }}
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Title
                <input value={linkName} onChange={(event) => setLinkName(event.target.value)} placeholder="Optional" />
              </label>
              {linkError && <p role="alert">{linkError}</p>}
              <button disabled={!linkUrl.trim()} onClick={addUrlAttachment}>
                Add link
              </button>
            </section>
          )}
          {showDependencies && (
            <section className="transfer-picker dependency-picker" aria-label="Add dependency">
              <strong>Depends on card</strong>
              <CardPicker
                label="Dependency card"
                candidates={availableDependencies}
                describe={(item) =>
                  `${state.boards.find((board) => board.id === item.boardId)?.name ?? ""} / ${item.name}`
                }
                onPick={(item) => {
                  onAddDependency(item.id);
                  setShowDependencies(false);
                }}
              />
            </section>
          )}
          {showMembers && canAssign && card.boardId !== inboxBoardId && (
            <div className="label-picker">
              <strong>Board members</strong>
              {assignable.map((member) => (
                <label key={member.id}>
                  <input
                    type="checkbox"
                    checked={(card.memberIds ?? []).includes(member.id)}
                    onChange={() =>
                      boardMembers.some((item) => item.id === member.id)
                        ? onChange((item) => ({
                            ...item,
                            memberIds: (item.memberIds ?? []).includes(member.id)
                              ? (item.memberIds ?? []).filter((id) => id !== member.id)
                              : [...(item.memberIds ?? []), member.id],
                          }))
                        : onAddMember(member)
                    }
                  />
                  {member.name}
                  {member.id === currentDeviceId ? " (you)" : ""}
                </label>
              ))}
              <small className="hint">Members are trusted devices and members imported from Trello.</small>
            </div>
          )}
          {showLabels && card.boardId !== inboxBoardId && (
            <div className="label-picker">
              <strong>Labels</strong>
              {boardLabels.map((label) => (
                <div className="label-row" key={label.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={card.labelIds.includes(label.id)}
                      onChange={() =>
                        onChange((item) => ({
                          ...item,
                          labelIds: item.labelIds.includes(label.id)
                            ? item.labelIds.filter((id) => id !== label.id)
                            : [...item.labelIds, label.id],
                        }))
                      }
                    />
                    <span
                      style={{
                        background: label.color || "#dfe1e6",
                        color: readableTextColor(label.color || "#dfe1e6"),
                      }}
                    >
                      {label.name}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLabelId(label.id);
                      setEditingLabelName(label.name);
                      setEditingLabelColor(label.color);
                    }}
                    aria-label={`Edit label ${label.name}`}
                  >
                    Edit
                  </button>
                </div>
              ))}
              {editingLabelId && (
                <div className="inline-form">
                  <input
                    value={editingLabelName}
                    onChange={(event) => setEditingLabelName(event.target.value)}
                    aria-label="Label name"
                  />
                  <input
                    type="color"
                    list="label-color-presets"
                    value={editingLabelColor || "#dfe1e6"}
                    onChange={(event) => setEditingLabelColor(event.target.value)}
                    aria-label="Edited label color"
                  />
                  <button
                    disabled={!editingLabelName.trim()}
                    onClick={() => {
                      onEditLabel(editingLabelId, editingLabelName.trim(), editingLabelColor);
                      setEditingLabelId(null);
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      if (editingLabelId && confirm("Remove this label from all cards?")) {
                        onDeleteLabel(editingLabelId);
                        setEditingLabelId(null);
                      }
                    }}
                    aria-label="Delete label"
                  >
                    Delete
                  </button>
                  <button onClick={() => setEditingLabelId(null)}>Cancel</button>
                </div>
              )}
              <div className="inline-form">
                <input
                  value={labelName}
                  onChange={(event) => setLabelName(event.target.value)}
                  placeholder="New label"
                  aria-label="New label"
                />
                <input
                  type="color"
                  list="label-color-presets"
                  value={labelColor}
                  onChange={(event) => setLabelColor(event.target.value)}
                  aria-label="Label color"
                />
                <datalist id="label-color-presets">
                  {labelColorOptions
                    .filter(({ color }) => color)
                    .map(({ color }) => (
                      <option key={color} value={color} />
                    ))}
                </datalist>
                <button
                  onClick={() => {
                    if (labelName.trim()) {
                      onAddLabel(labelName.trim(), labelColor);
                      setLabelName("");
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
          {card.labelIds.length > 0 && (
            <div className="detail-labels">
              {card.labelIds.map((id) => {
                const label = boardLabels.find((item) => item.id === id);
                return (
                  label && (
                    <span
                      key={id}
                      style={{
                        background: label.color || "#dfe1e6",
                        color: readableTextColor(label.color || "#dfe1e6"),
                      }}
                    >
                      {label.name}
                    </span>
                  )
                );
              })}
            </div>
          )}
          {(card.memberIds ?? []).length > 0 && (
            <div className="member-avatars" aria-label="Card members">
              {(card.memberIds ?? []).map((id) => {
                const member = boardMembers.find((item) => item.id === id);
                return (
                  member && (
                    <span key={id} title={member.name} aria-label={member.name}>
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                  )
                );
              })}
            </div>
          )}
          {!card.isTemplate && (
            <section className="detail-section">
              <h3>
                <Icon name="clock" /> Dates
              </h3>
              <div className="date-fields">
                <label>
                  Start date
                  <input
                    type="datetime-local"
                    value={card.startAt ? localDateTime(card.startAt) : ""}
                    onChange={(event) =>
                      onChange((item) => ({
                        ...item,
                        startAt: event.target.value ? new Date(event.target.value).toISOString() : undefined,
                      }))
                    }
                    aria-label="Card start date"
                  />
                </label>
                <label>
                  Due date
                  <input
                    id={`due-${card.id}`}
                    type="datetime-local"
                    value={card.dueAt ? localDateTime(card.dueAt) : ""}
                    onChange={(event) =>
                      onChange((item) => ({
                        ...item,
                        dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined,
                        dueReminderMinutes: event.target.value ? item.dueReminderMinutes : undefined,
                        dueRepeat: event.target.value ? item.dueRepeat : undefined,
                      }))
                    }
                    aria-label="Card due date"
                  />
                </label>
                <label>
                  Reminder
                  <select
                    value={card.dueReminderMinutes ?? ""}
                    onChange={(event) =>
                      onChange((item) => ({
                        ...item,
                        dueReminderMinutes: event.target.value === "" ? undefined : Number(event.target.value),
                      }))
                    }
                    disabled={!card.dueAt}
                    aria-label="Card due date reminder"
                  >
                    <option value="">No reminder</option>
                    {reminderOptions.map((option) => (
                      <option key={option.minutes} value={option.minutes}>
                        {option.label}
                      </option>
                    ))}
                    {card.dueReminderMinutes !== undefined &&
                      !reminderOptions.some((option) => option.minutes === card.dueReminderMinutes) && (
                        <option value={card.dueReminderMinutes}>{card.dueReminderMinutes} minutes before</option>
                      )}
                  </select>
                </label>
                <label>
                  Repeat
                  <select
                    value={card.dueRepeat?.cadence ?? ""}
                    onChange={(event) => {
                      const cadence = event.target.value as NonNullable<Card["dueRepeat"]>["cadence"] | "";
                      onChange((item) => ({
                        ...item,
                        dueRepeat:
                          cadence && item.dueAt
                            ? { cadence, anchor: localDateTime(item.dueAt).slice(0, 10) }
                            : undefined,
                      }));
                    }}
                    disabled={!card.dueAt}
                    aria-label="Repeat card due date"
                  >
                    <option value="">Don't repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
              </div>
            </section>
          )}
          <section className="detail-section">
            <h3>
              Description
              {card.description && !editingDescription && (
                <button className="description-edit-button" onClick={() => setEditingDescription(true)}>
                  Edit
                </button>
              )}
            </h3>
            {editingDescription ? (
              <MarkdownEditor
                value={card.description}
                label="Card description"
                onSave={(value) => {
                  if (value !== card.description) onChange((item) => ({ ...item, description: value }));
                  setEditingDescription(false);
                }}
                onCancel={() => setEditingDescription(false)}
              />
            ) : card.description ? (
              <div className="description-preview" onDoubleClick={() => setEditingDescription(true)}>
                <MarkdownText
                  text={card.description}
                  localCardForUrl={localCardForUrl}
                  onNavigateCard={onNavigateCard}
                />
              </div>
            ) : (
              <button className="description-placeholder" onClick={() => setEditingDescription(true)}>
                Add a more detailed description…
              </button>
            )}
          </section>
          {(prerequisiteCards.length > 0 || dependentCards.length > 0) && (
            <section className="detail-section dependency-summary">
              <h3>Dependencies</h3>
              {prerequisiteCards.length > 0 && (
                <p>
                  Depends on:{" "}
                  {prerequisiteCards.map((item) => (
                    <button key={item.id} onClick={() => onNavigateCard(item)}>
                      {item.completed ? "✓" : "⏳"} {item.name}
                    </button>
                  ))}
                </p>
              )}
              {prerequisiteCards.some((item) => !item.completed) && !card.completed && (
                <p className="blocked-note">Card is blocked: not all dependencies are complete.</p>
              )}
              {dependentCards.length > 0 && (
                <p>
                  Blocks:{" "}
                  {dependentCards.map((item) => (
                    <button key={item.id} onClick={() => onNavigateCard(item)}>
                      {item.name}
                    </button>
                  ))}
                </p>
              )}
            </section>
          )}
          {mentionedInDoc && (
            <p className="doc-backlink">
              📄 Mentioned in the{" "}
              <button className="link-button" onClick={onOpenDoc}>
                board doc
              </button>
            </p>
          )}
          {!card.isTemplate && card.boardId !== inboxBoardId && (
            <section className="detail-section sub-cards">
              <h3>Sub-cards</h3>
              {parentCard && (
                <p>
                  Parent: <button onClick={() => onNavigateCard(parentCard)}>{parentCard.name}</button>
                </p>
              )}
              {children.length > 0 && (
                <ul>
                  {children.map((item) => (
                    <li key={item.id}>
                      <button onClick={() => onNavigateCard(item)}>
                        {item.completed ? "✓ " : ""}
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="inline-form">
                <input
                  value={subCardName}
                  onChange={(event) => setSubCardName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && subCardName.trim()) {
                      onCreateSubCard(subCardName.trim());
                      setSubCardName("");
                    }
                  }}
                  placeholder="New sub-card"
                  aria-label="New sub-card title"
                />
                <button
                  disabled={!subCardName.trim()}
                  onClick={() => {
                    onCreateSubCard(subCardName.trim());
                    setSubCardName("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="parent-picker">
                {choosingParent ? (
                  <>
                    <CardPicker
                      label="Parent card"
                      candidates={parentCandidates(state, card.id).filter(
                        (item) => item.boardId === card.boardId && isCardAvailable(state, item),
                      )}
                      onPick={(parent) => {
                        onChange((item) => ({ ...item, parentCardId: parent.id }));
                        setChoosingParent(false);
                      }}
                    />
                    <button onClick={() => setChoosingParent(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setChoosingParent(true)}>
                      {parentCard ? "Change parent" : "Choose parent card"}
                    </button>
                    {card.parentCardId && (
                      <button onClick={() => onChange((item) => ({ ...item, parentCardId: undefined }))}>
                        Remove parent
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>
          )}
          {card.checklists.map((checklist) => (
            <ChecklistSection
              key={checklist.id}
              checklist={checklist}
              card={card}
              onChange={onChange}
              onRemoveDependency={onRemoveDependency}
              onConvertItem={(itemId) => onConvertChecklistItem(checklist.id, itemId)}
            />
          ))}
          {related.length > 0 && (
            <section className="detail-section related-cards">
              <h3>Linked cards</h3>
              {related.map((link, index) => (
                <div className="related-row" key={`${link.url}-${index}`}>
                  <span>{link.source}</span>
                  {link.target && isCardAvailable(state, link.target) ? (
                    <button onClick={() => onNavigateCard(link.target!)}>{link.target.name}</button>
                  ) : link.target ? (
                    <small>Card unavailable: {link.target.name}</small>
                  ) : (
                    <small>Card not imported: {link.url}</small>
                  )}
                </div>
              ))}
            </section>
          )}
          {card.attachments.length > 0 && (
            <section className="detail-section">
              <h3>
                <Icon name="clip" /> Attachments
              </h3>
              {card.attachments.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  linkedCard={state.cards.find(
                    (item) => item.id === attachment.linkedCardId && isCardAvailable(state, item),
                  )}
                  onNavigateCard={onNavigateCard}
                  onDownload={onDownload}
                  onRemove={() => removeAttachment(attachment)}
                />
              ))}
            </section>
          )}
          <div className="card-footer-actions">
            <button className="archive-action" onClick={onArchive}>
              <Icon name="archive" /> Archive card
            </button>
            <button className="archive-action danger" onClick={onDelete}>
              🗑 Move to trash
            </button>
          </div>
        </div>
        <aside className="activity-panel">
          <h3>
            Comments and activity
            <button
              className="activity-toggle"
              type="button"
              aria-expanded={showActivityDetails}
              onClick={() => setShowActivityDetails((value) => !value)}
            >
              {showActivityDetails ? "Hide details" : "Show details"}
            </button>
          </h3>
          {writingComment ? (
            <MarkdownEditor
              value=""
              label="New comment"
              saveLabel="Send"
              onSave={addComment}
              onCancel={() => setWritingComment(false)}
            />
          ) : (
            <button className="description-placeholder" onClick={() => setWritingComment(true)}>
              Write a comment…
            </button>
          )}
          <div className="comments">
            {activityFeed.map((item) => {
              if (item.kind === "change")
                return (
                  <article className="card-activity-entry" key={item.id}>
                    <strong>{item.event.summary}</strong>
                    <small>{new Date(item.createdAt).toLocaleString("en-US")}</small>
                  </article>
                );
              const entry = item.comment;
              return (
                <article key={item.id}>
                  <span className="comment-avatar">{entry.author.slice(0, 1)}</span>
                  <div>
                    <strong>{entry.author}</strong>
                    <small>{new Date(entry.createdAt).toLocaleString("en-US")}</small>
                    {editingCommentId === entry.id ? (
                      <div className="comment-edit">
                        <MarkdownEditor
                          value={commentDraft}
                          label="Edit comment"
                          onSave={saveComment}
                          onCancel={() => setEditingCommentId(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <MarkdownText
                          text={entry.text}
                          localCardForUrl={localCardForUrl}
                          onNavigateCard={onNavigateCard}
                        />
                        {canEditComment(entry, currentDeviceId) && (
                          <div className="comment-actions">
                            <button
                              onClick={() => {
                                setEditingCommentId(entry.id);
                                setCommentDraft(entry.text);
                              }}
                            >
                              Edit
                            </button>
                            <button onClick={() => deleteComment(entry.id)}>Delete</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
  return asPage ? (
    body
  ) : (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      {body}
    </div>
  );
}
