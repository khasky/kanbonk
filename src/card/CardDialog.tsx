import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { mentionedCardIds } from "../model/boardDoc";
import { cardCreatedAt } from "../model/calendar";
import { inboxBoardId } from "../model/inbox";
import { importedCardForUrl, relatedCards } from "../model/links";
import { isCardAvailable, subCards, type AppState, type Card, type Member } from "../model";
import { dependentsOf, prerequisitesOf } from "../model/trash";
import { Icon, type IconName } from "../ui/Icon";
import { NameEditor } from "../ui/NameEditor";
import { AttachmentRow } from "./AttachmentRow";
import { ChecklistSection } from "./ChecklistSection";
import { useCardActionsContext } from "./CardActionsContext";
import { CardActivity } from "./CardActivity";
import { DatesChip, DatesForm } from "./CardDates";
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
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import { detailSectionClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

// `card-dialog`, `card-dialog-top` and `card-actions` are hooks of the print rules (styles/index.css) and of tests;
// `file-button` (on the attachment row of the "Add to card" popover) is a hook of tests.
const dialogLook =
  "card-dialog flex w-[min(1080px,100%)] flex-col rounded-xl bg-white text-ink max-phone:h-dvh max-phone:w-full max-phone:rounded-none";
// On phones every button is a 44px touch target and fields use 16px text so the browser does not zoom into them.
const phoneTouch =
  "max-phone:[&_:is(input,textarea,select)]:text-[16px] max-phone:[&_button:not([data-inline],.markdown-card-link)]:min-h-11";
const modalClass = `${dialogLook} ${phoneTouch} max-h-[calc(100dvh-96px)] overflow-hidden shadow-dialog max-tablet:max-h-none max-phone:max-h-dvh`;
const pageClass = `${dialogLook} ${phoneTouch} mx-auto my-5 max-h-none flex-none overflow-visible shadow-[0_1px_3px_#091e4240]`;
const topButtonClass =
  "grid size-8 place-items-center rounded-sm border-0 bg-transparent text-ink-subtle hover:bg-line aria-expanded:bg-line";
const blockTitleClass = "mb-1.5 text-[12px] font-semibold text-ink-subtle";
const addChipClass =
  "grid size-8 place-items-center border-0 bg-surface-sunken text-ink-subtle hover:bg-line aria-expanded:bg-line";
const addRowClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent p-1.5 text-left text-ink hover:bg-surface-sunken";

/** The popovers of the card's buttons. */
type Panel =
  | "add"
  | "labels"
  | "dates"
  | "checklist"
  | "members"
  | "link"
  | "stickers"
  | "cover"
  | "dependency"
  | "transfer"
  | "share";

const panelTitles: Record<Panel, string> = {
  add: "Add to card",
  labels: "Labels",
  dates: "Dates",
  checklist: "Add checklist",
  members: "Members",
  link: "Attach a link",
  stickers: "Stickers",
  cover: "Cover",
  dependency: "Add dependency",
  transfer: "Move or copy card",
  share: "Share card",
};

/** A row of the "Add to card" popover: an icon in a framed square, a title and what it is for. */
function AddRowContent({ icon, title, note }: { icon: IconName; title: string; note: string }) {
  return (
    <>
      <span className="grid size-10 flex-none place-items-center rounded-sm border border-line text-ink-subtle">
        <Icon name={icon} />
      </span>
      <span className="grid min-w-0">
        <span>{title}</span>
        <small className="text-[12px] text-ink-subtle">{note}</small>
      </span>
    </>
  );
}

/** A quick action under the card title: an outline button with an icon that opens a popover. */
function QuickButton({
  icon,
  panel,
  expanded,
  onClick,
  children,
}: {
  icon: IconName;
  panel: Panel;
  expanded: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <Button variant="outline" data-panel={panel} aria-expanded={expanded} onClick={onClick}>
      <Icon name={icon} className="size-4" />
      {children}
    </Button>
  );
}

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
  const [panel, setPanel] = useState<{ kind: Panel; anchor: HTMLElement } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closePanel = () => setPanel(null);
  /** Opens a popover under the pressed button, or closes it when that button opened it. */
  const toggle = (kind: Panel) => (event: MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    setPanel((current) => (current?.kind === kind && current.anchor === anchor ? null : { kind, anchor }));
  };
  /** Opens a popover from a row of the "Add to card" popover or of the actions menu, in the same place. */
  const openAt = (kind: Panel, anchor: HTMLElement | null) => {
    if (anchor) setPanel({ kind, anchor });
  };
  const expanded = (kind: Panel) => panel?.anchor.dataset.panel === kind;
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
  const canAssign = assignable.some((member) => member.id !== currentDeviceId) && card.boardId !== inboxBoardId;
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
  const inInbox = card.boardId === inboxBoardId;
  const showDates = !card.isTemplate && Boolean(card.startAt || card.dueAt);
  const members = card.memberIds ?? [];

  function panelBody(kind: Panel, anchor: HTMLElement): ReactNode {
    if (kind === "add")
      return (
        <div className="grid gap-0.5">
          {!inInbox && (
            <button className={addRowClass} onClick={() => openAt("labels", anchor)}>
              <AddRowContent icon="tag" title="Labels" note="Group and prioritize cards" />
            </button>
          )}
          {!card.isTemplate && (
            <button className={addRowClass} onClick={() => openAt("dates", anchor)}>
              <AddRowContent icon="clock" title="Dates" note="Start and due dates, a reminder" />
            </button>
          )}
          <button className={addRowClass} onClick={() => openAt("checklist", anchor)}>
            <AddRowContent icon="check-square" title="Checklist" note="Steps to tick off" />
          </button>
          {canAssign && (
            <button className={addRowClass} onClick={() => openAt("members", anchor)}>
              <AddRowContent icon="user-plus" title="Members" note="Who works on the card" />
            </button>
          )}
          <label className={`file-button ${addRowClass} has-focus-visible:outline-2 has-focus-visible:outline-brand`}>
            <AddRowContent icon="clip" title="Attachment" note="Files from this device" />
            <input
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                closePanel();
                onAttach(files);
              }}
            />
          </label>
          <button className={addRowClass} onClick={() => openAt("link", anchor)}>
            <AddRowContent icon="link" title="Link" note="A website as an attachment" />
          </button>
          {!inInbox && (
            <button className={addRowClass} onClick={() => openAt("dependency", anchor)}>
              <AddRowContent icon="dependency" title="Dependency" note="A card this one waits for" />
            </button>
          )}
          <button className={addRowClass} onClick={() => openAt("cover", anchor)}>
            <AddRowContent icon="image" title="Cover" note="A color or image on the tile" />
          </button>
          <button className={addRowClass} onClick={() => openAt("stickers", anchor)}>
            <AddRowContent icon="smile" title="Stickers" note="Emoji and images on the tile" />
          </button>
        </div>
      );
    if (kind === "labels")
      return (
        <LabelPicker
          card={card}
          boardLabels={boardLabels}
          onChange={onChange}
          onAddLabel={onAddLabel}
          onEditLabel={onEditLabel}
          onDeleteLabel={onDeleteLabel}
        />
      );
    if (kind === "dates") return <DatesForm card={card} onChange={onChange} onClose={closePanel} />;
    if (kind === "checklist")
      return <ChecklistComposer card={card} state={state} onChange={onChange} onClose={closePanel} />;
    if (kind === "members")
      return (
        <MemberPicker
          card={card}
          assignable={assignable}
          boardMembers={boardMembers}
          currentDeviceId={currentDeviceId}
          onChange={onChange}
          onAddMember={onAddMember}
        />
      );
    if (kind === "link") return <LinkEditor onChange={onChange} onClose={closePanel} />;
    if (kind === "stickers")
      return <StickerPicker card={card} onChange={onChange} onAddStickerImage={onAddStickerImage} />;
    if (kind === "cover") return <CoverPicker card={card} onChange={onChange} />;
    if (kind === "dependency")
      return <DependencyPicker card={card} state={state} onAddDependency={onAddDependency} onClose={closePanel} />;
    if (kind === "transfer")
      return (
        <TransferPicker
          card={card}
          state={state}
          onTransfer={(listId, copy) => {
            closePanel();
            onTransfer(listId, copy);
          }}
        />
      );
    return <SharePanel card={card} state={state} dialog={dialogRef} />;
  }

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
      <header className="card-dialog-top flex h-14 flex-none items-center justify-between gap-3 border-b border-line px-5">
        <Select
          pill
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
        <div className="flex items-center gap-1">
          <button
            className={topButtonClass}
            data-panel="cover"
            aria-expanded={expanded("cover")}
            onClick={toggle("cover")}
            aria-label="Cover"
            title="Cover"
          >
            <Icon name="image" />
          </button>
          <Menu
            ref={menuRef}
            label="Card actions"
            summaryClassName="grid size-8 place-items-center rounded-sm text-[20px] leading-none text-ink-subtle hover:bg-line group-open/menu:bg-line"
            touchRows
          >
            <MenuItem onClick={() => openAt("transfer", menuRef.current)}>Move / copy</MenuItem>
            <MenuItem onClick={onClone}>Clone</MenuItem>
            {!inInbox && (
              <MenuItem onClick={() => onChange((item) => ({ ...item, isTemplate: !item.isTemplate }))}>
                {card.isTemplate ? "Remove template" : "Make template"}
              </MenuItem>
            )}
            <MenuItem onClick={() => openAt("share", menuRef.current)}>Share</MenuItem>
            <MenuItem onClick={onHistory}>Card history</MenuItem>
            <MenuSeparator />
            <MenuItem danger onClick={onDelete}>
              Move to trash
            </MenuItem>
          </Menu>
          <button className={topButtonClass} onClick={onClose} aria-label="Close card" title="Close card">
            <Icon name="close" />
          </button>
        </div>
      </header>
      <div className="grid min-h-0 grid-cols-[minmax(0,1.4fr)_minmax(290px,1fr)] overflow-auto max-tablet:block">
        <div className="overflow-auto pt-6 pr-8 pb-8 pl-[68px] max-tablet:overflow-visible max-phone:pr-[18px] max-phone:pl-[54px]">
          <NameEditor
            // `!`: the dialog's phone rule would make the title 16px like the other fields.
            className="-ml-1.5 w-[calc(100%+6px)] min-w-0 rounded-sm border-0 bg-transparent px-1.5 py-1 text-[26px]! leading-tight font-semibold text-ink hover:bg-surface-sunken focus:bg-white"
            value={card.name}
            label="Card title"
            onCommit={(name) => onChange((item) => ({ ...item, name }))}
          />
          <p className="mt-1 mb-4 text-[12px] text-ink-muted">
            in list “{lists.find((item) => item.id === card.listId)?.name ?? "—"}” ·{" "}
            {state.boards.find((item) => item.id === card.boardId)?.name}
            {created ? ` · created ${new Date(created).toLocaleString("en-US")}` : ""} · ID {card.id}
          </p>
          <div className="card-actions mb-5 flex flex-wrap gap-2">
            <QuickButton icon="plus" panel="add" expanded={expanded("add")} onClick={toggle("add")}>
              Add
            </QuickButton>
            {!inInbox && (
              <QuickButton icon="tag" panel="labels" expanded={expanded("labels")} onClick={toggle("labels")}>
                Labels
              </QuickButton>
            )}
            {!card.isTemplate && (
              <QuickButton icon="clock" panel="dates" expanded={expanded("dates")} onClick={toggle("dates")}>
                Dates
              </QuickButton>
            )}
            <QuickButton
              icon="check-square"
              panel="checklist"
              expanded={expanded("checklist")}
              onClick={toggle("checklist")}
            >
              Checklist
            </QuickButton>
            {canAssign && (
              <QuickButton icon="user-plus" panel="members" expanded={expanded("members")} onClick={toggle("members")}>
                Members
              </QuickButton>
            )}
            {cardButtons.map((rule) => (
              <Button variant="outline" key={rule.id} onClick={() => onRunAutomation(rule.id)}>
                {rule.name}
              </Button>
            ))}
          </div>
          {card.isTemplate && (
            <p className="mt-0 mb-4 rounded-sm bg-brand-soft p-2.5 text-ink">
              This is a card template. Dates aren't copied when you create a card from it.
            </p>
          )}
          {(members.length > 0 || card.labelIds.length > 0 || showDates) && (
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-3">
              {members.length > 0 && (
                <div>
                  <div className={blockTitleClass}>Members</div>
                  <div className="flex flex-wrap gap-1" aria-label="Card members">
                    <CardMemberAvatars card={card} boardMembers={boardMembers} />
                    {canAssign && (
                      <button
                        className={`${addChipClass} rounded-full`}
                        data-panel="members"
                        aria-expanded={expanded("members")}
                        onClick={toggle("members")}
                        aria-label="Assign members"
                      >
                        <Icon name="plus" className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {card.labelIds.length > 0 && (
                <div>
                  <div className={blockTitleClass}>Labels</div>
                  <div className="flex flex-wrap gap-1">
                    <CardLabelChips card={card} boardLabels={boardLabels} />
                    {!inInbox && (
                      <button
                        className={`${addChipClass} rounded-sm`}
                        data-panel="labels"
                        aria-expanded={expanded("labels")}
                        onClick={toggle("labels")}
                        aria-label="Change labels"
                      >
                        <Icon name="plus" className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {showDates && (
                <div>
                  <div className={blockTitleClass}>
                    {card.startAt && card.dueAt ? "Dates" : card.dueAt ? "Due date" : "Start date"}
                  </div>
                  <DatesChip card={card} expanded={expanded("dates")} onClick={toggle("dates")} />
                </div>
              )}
            </div>
          )}
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
          {!card.isTemplate && !inInbox && (
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
              <DetailTitle icon="clip">Attachments</DetailTitle>
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
      {panel && (
        <Popover key={panel.kind} title={panelTitles[panel.kind]} anchor={panel.anchor} onClose={closePanel}>
          {panelBody(panel.kind, panel.anchor)}
        </Popover>
      )}
    </div>
  );
  return asPage ? body : <Backdrop onMouseDown={onClose}>{body}</Backdrop>;
}
