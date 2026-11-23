import { useEffect, useRef, useState } from "react";
import { mentionedCardIds } from "../model/boardDoc";
import { cardCreatedAt } from "../model/calendar";
import { inboxBoardId } from "../model/inbox";
import { importedCardForUrl, relatedCards } from "../model/links";
import { isCardAvailable, subCards, type AppState, type Card, type Member } from "../model";
import { dependentsOf, prerequisitesOf } from "../model/trash";
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
import { Button } from "../ui/Button";
import { Backdrop } from "../ui/Modal";
import { Select } from "../ui/Field";
import { FileButton } from "../ui/FileButton";
import { detailSectionClass, detailTitleClass } from "./cardLook";

// `card-dialog`, `card-dialog-top` and `card-actions` are hooks of the print rules (styles/index.css) and of tests;
// `file-button` (on the file labels of `FileButton`) is a hook of tests.
const dialogLook =
  "card-dialog flex w-[min(1080px,100%)] flex-col rounded-xl bg-white text-ink max-phone:h-dvh max-phone:w-full max-phone:rounded-none";
// On phones every button is a 44px touch target and fields use 16px text so the browser does not zoom into them.
const phoneTouch =
  "max-phone:[&_:is(input,textarea,select)]:text-[16px] max-phone:[&_button:not([data-inline],.markdown-card-link)]:min-h-11";
const modalClass = `${dialogLook} ${phoneTouch} max-h-[calc(100dvh-96px)] overflow-hidden shadow-dialog max-tablet:max-h-none max-phone:max-h-dvh`;
const pageClass = `${dialogLook} ${phoneTouch} mx-auto my-5 max-h-none flex-none overflow-visible shadow-[0_1px_3px_#091e4240]`;
const topButtonClass = "rounded-sm border-0 bg-transparent p-1.5 text-ink-subtle hover:bg-line";

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
  onHistory: () => void;
  team: Member[];
  onClone: () => void;
  onOpenDoc: () => void;
}) {
  const actions = useCardActionsContext();
  const onChange = (change: (card: Card) => Card) => actions.updateCard(card.id, change);
  const onAttach = (files: File[]) => actions.attachFiles(card, files);
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
      className={asPage ? pageClass : modalClass}
      role={asPage ? "region" : "dialog"}
      aria-modal={asPage ? undefined : true}
      aria-label={card.name}
      tabIndex={-1}
      ref={dialogRef}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="card-dialog-top flex h-14 flex-none items-center justify-between border-b border-line px-5">
        <Select
          size="sm"
          value={card.listId}
          onChange={(event) => onTransfer(event.target.value, false)}
          aria-label="Card list"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </Select>
        <div className="flex gap-1">
          <button className={topButtonClass} onClick={onHistory} aria-label="Card history">
            <Icon name="history" />
          </button>
          <button className={topButtonClass} onClick={onClose} aria-label="Close card">
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="grid min-h-0 grid-cols-[minmax(0,1.4fr)_minmax(290px,1fr)] overflow-auto max-tablet:block">
        <div className="overflow-auto px-8 pt-6 pb-8 max-tablet:overflow-visible max-phone:p-[18px]">
          <div className="flex items-center gap-3">
            <NameEditor
              // `!`: the dialog's phone rule would make the title 16px like the other fields.
              className="w-full min-w-0 border-0 bg-transparent p-1 text-[25px]! font-bold text-ink"
              value={card.name}
              label="Card title"
              onCommit={(name) => onChange((item) => ({ ...item, name }))}
            />
          </div>
          <p className="mt-1 mb-3 text-[13px] text-ink-muted">
            in list “{lists.find((item) => item.id === card.listId)?.name ?? "—"}” ·{" "}
            {state.boards.find((item) => item.id === card.boardId)?.name}
            {created ? ` · created ${new Date(created).toLocaleString("en-US")}` : ""} · ID {card.id}
          </p>
          <div className="card-actions mt-5 mb-[26px] ml-[34px] flex flex-wrap gap-2 max-phone:ml-0">
            {cardButtons.map((rule) => (
              <Button variant="secondary" size="md" key={rule.id} onClick={() => onRunAutomation(rule.id)}>
                {rule.name}
              </Button>
            ))}
            {card.boardId !== inboxBoardId && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onChange((item) => ({ ...item, isTemplate: !item.isTemplate }))}
                >
                  {card.isTemplate ? "Remove template" : "Make template"}
                </Button>
                {canAssign && (
                  <Button variant="secondary" size="md" onClick={() => setShowMembers(!showMembers)}>
                    Members
                  </Button>
                )}
                <Button variant="secondary" size="md" onClick={() => setShowLabels(!showLabels)}>
                  Labels
                </Button>
              </>
            )}
            <Button variant="secondary" size="md" onClick={() => setShowCover(!showCover)}>
              Cover
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowStickers(!showStickers)}>
              Stickers
            </Button>
            {!card.isTemplate && (
              <Button variant="secondary" size="md" onClick={() => document.getElementById(`due-${card.id}`)?.focus()}>
                Due date
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={() => setShowChecklistComposer(!showChecklistComposer)}>
              Checklist
            </Button>
            <FileButton size="md" multiple onFiles={onAttach}>
              Attachment
            </FileButton>
            <Button variant="secondary" size="md" onClick={() => setShowLinkEditor(!showLinkEditor)}>
              Link
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowTransfer(!showTransfer)}>
              Move / copy
            </Button>
            <Button variant="secondary" size="md" onClick={onClone}>
              Clone
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowShare(!showShare)} aria-expanded={showShare}>
              Share
            </Button>
            {card.boardId !== inboxBoardId && (
              <Button variant="secondary" size="md" onClick={() => setShowDependencies(!showDependencies)}>
                Dependency
              </Button>
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
            <p className="mt-0 mb-3.5 ml-[34px] rounded-sm bg-brand-soft p-2.5 text-ink">
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
              prerequisiteCards={prerequisiteCards}
              dependentCards={dependentCards}
              onNavigateCard={onNavigateCard}
            />
          )}
          {mentionedInDoc && (
            <p className="my-1">
              📄 Mentioned in the{" "}
              <Button variant="link" onClick={onOpenDoc}>
                board doc
              </Button>
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
            <section className={detailSectionClass}>
              <h3 className={detailTitleClass}>
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
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="lg" className="flex items-center gap-2" onClick={onDelete}>
              <Icon name="trash" /> Move to trash
            </Button>
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
  return asPage ? body : <Backdrop onMouseDown={onClose}>{body}</Backdrop>;
}
