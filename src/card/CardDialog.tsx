import { useEffect, useRef, useState } from "react";
import { mentionedCardIds } from "../boardDoc";
import { cardCreatedAt } from "../calendar";
import { inboxBoardId } from "../inbox";
import { importedCardForUrl, relatedCards } from "../links";
import { isCardAvailable, subCards, type AppState, type Card, type Member } from "../model";
import { dependentsOf, prerequisitesOf } from "../trash";
import { Icon } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { AttachmentRow } from "./AttachmentRow";
import { ChecklistSection } from "./ChecklistSection";
import { useCardActionsContext } from "./CardActionsContext";
import { CardActivity } from "./CardActivity";
import { CardDates } from "./CardDates";
import { CardDescription } from "./CardDescription";
import { DependencySummary, RelatedCards, SubCards } from "./CardRelations";
import { ChecklistComposer } from "./ChecklistComposer";
import { CoverPicker } from "./CoverPicker";
import { DependencyPicker } from "./DependencyPicker";
import { CardLabelChips, LabelPicker } from "./LabelPicker";
import { LinkEditor } from "./LinkEditor";
import { CardMemberAvatars, MemberPicker } from "./MemberPicker";
import { SharePanel } from "./SharePanel";
import { StickerPicker } from "./StickerPicker";
import { TransferPicker } from "./TransferPicker";

export function CardDialog({
  card,
  state,
  lists,
  authorName,
  currentDeviceId,
  asPage,
  onDelete,
  onClose,
  onNavigateCard,
  onTransfer,
  onArchive,
  onHistory,
  team,
  onClone,
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
  onNavigateCard: (target: Card) => void;
  onTransfer: (targetListId: string, copy: boolean) => void;
  onArchive: () => void;
  onHistory: () => void;
  team: Member[];
  onClone: () => void;
  onOpenDoc: () => void;
}) {
  const actions = useCardActionsContext();
  const onChange = (change: (card: Card) => Card) => actions.updateCard(card.id, change);
  const onAttach = (files: FileList | null) => actions.attachFiles(card, files);
  const onAddStickerImage = (file: File | null) => {
    void actions.addStickerImage(card, file);
  };
  const onDownload = actions.downloadAttachment;
  const onRunAutomation = (ruleId: string) => actions.runCardButton(card.id, ruleId);
  const onAddMember = (member: Member) => actions.addMember(card, member);
  const onAddLabel = (name: string, color: string) => actions.addLabel(card, name, color);
  const onEditLabel = (id: string, name: string, color: string) => actions.editLabel(card.boardId, id, name, color);
  const onDeleteLabel = actions.removeLabel;
  const onAddDependency = (targetId: string) => actions.addDependency(card.id, targetId);
  const onRemoveDependency = actions.removeDependency;
  const onConvertChecklistItem = (checklistId: string, itemId: string) =>
    actions.convertItem(card.id, checklistId, itemId);
  const onCreateSubCard = (name: string) => actions.addSubCard(card.id, name);
  const [showShare, setShowShare] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [showChecklistComposer, setShowChecklistComposer] = useState(false);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
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
  const cardButtons = card.isTemplate
    ? []
    : (state.boards
        .find((item) => item.id === card.boardId)
        ?.automationRules?.filter((rule) => rule.trigger === "button") ?? []);
  const related = relatedCards(card, state);
  const localCardForUrl = (url: string) => {
    const target = importedCardForUrl(url, state);
    return target && isCardAvailable(state, target) ? target : undefined;
  };
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
          <SharePanel open={showShare} card={card} state={state} dialog={dialogRef} />
          <ChecklistComposer
            open={showChecklistComposer}
            card={card}
            state={state}
            onChange={onChange}
            onClose={() => setShowChecklistComposer(false)}
          />
          {card.isTemplate && (
            <p className="template-notice">
              This is a card template. Dates aren't copied when you create a card from it.
            </p>
          )}
          {showCover && <CoverPicker card={card} onChange={onChange} onClose={() => setShowCover(false)} />}
          {showStickers && <StickerPicker card={card} onChange={onChange} onAddStickerImage={onAddStickerImage} />}
          <TransferPicker open={showTransfer} card={card} state={state} onTransfer={onTransfer} />
          <LinkEditor open={showLinkEditor} onChange={onChange} onClose={() => setShowLinkEditor(false)} />
          {showDependencies && (
            <DependencyPicker
              card={card}
              state={state}
              onAddDependency={onAddDependency}
              onClose={() => setShowDependencies(false)}
            />
          )}
          {showMembers && canAssign && card.boardId !== inboxBoardId && (
            <MemberPicker
              card={card}
              assignable={assignable}
              boardMembers={boardMembers}
              currentDeviceId={currentDeviceId}
              onChange={onChange}
              onAddMember={onAddMember}
            />
          )}
          <LabelPicker
            open={showLabels && card.boardId !== inboxBoardId}
            card={card}
            boardLabels={boardLabels}
            onChange={onChange}
            onAddLabel={onAddLabel}
            onEditLabel={onEditLabel}
            onDeleteLabel={onDeleteLabel}
          />
          <CardLabelChips card={card} boardLabels={boardLabels} />
          <CardMemberAvatars card={card} boardMembers={boardMembers} />
          {!card.isTemplate && <CardDates card={card} onChange={onChange} />}
          <CardDescription
            card={card}
            onChange={onChange}
            localCardForUrl={localCardForUrl}
            onNavigateCard={onNavigateCard}
          />
          {(prerequisiteCards.length > 0 || dependentCards.length > 0) && (
            <DependencySummary
              card={card}
              prerequisiteCards={prerequisiteCards}
              dependentCards={dependentCards}
              onNavigateCard={onNavigateCard}
            />
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
            <SubCards
              card={card}
              state={state}
              parentCard={parentCard}
              childCards={children}
              onChange={onChange}
              onCreateSubCard={onCreateSubCard}
              onNavigateCard={onNavigateCard}
            />
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
          {related.length > 0 && <RelatedCards related={related} state={state} onNavigateCard={onNavigateCard} />}
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
        <CardActivity
          card={card}
          state={state}
          authorName={authorName}
          currentDeviceId={currentDeviceId}
          onChange={onChange}
          localCardForUrl={localCardForUrl}
          onNavigateCard={onNavigateCard}
        />
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
