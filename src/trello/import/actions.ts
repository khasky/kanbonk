import { object, string, type TrelloRecord } from "./records";

export function trelloActionDescription(
  action: TrelloRecord,
  importedCardName?: string,
  importedListName?: string,
): string {
  const data = object(action.data);
  const old = object(data.old);
  const card = string(object(data.card).name) || importedCardName || "card";
  const list = string(object(data.list).name) || importedListName || "list";
  const attachment = string(object(data.attachment).name) || "attachment";
  switch (action.type) {
    case "commentCard":
      return `commented on card “${card}”: ${string(data.text)}`;
    case "createCard":
      return `created card “${card}”`;
    case "deleteCard":
      return `deleted card “${card}”`;
    case "moveCardToBoard":
      return `moved card “${card}” to this board`;
    case "moveCardFromBoard":
      return `moved card “${card}” from this board`;
    case "addAttachmentToCard":
      return `attached “${attachment}” to card “${card}”`;
    case "deleteAttachmentFromCard":
      return `removed attachment “${attachment}” from card “${card}”`;
    case "addChecklistToCard":
      return `added a checklist to card “${card}”`;
    case "removeChecklistFromCard":
      return `removed a checklist from card “${card}”`;
    case "updateChecklist":
      return `updated a checklist on card “${card}”`;
    case "addMemberToCard":
      return `added a member to card “${card}”`;
    case "removeMemberFromCard":
      return `removed a member from card “${card}”`;
    case "updateCard": {
      const change =
        "name" in old
          ? "renamed card"
          : "idList" in old
            ? "moved card"
            : "desc" in old
              ? "changed the description of card"
              : "due" in old
                ? "changed the due date of card"
                : "closed" in old
                  ? "changed the archive status of card"
                  : "pos" in old
                    ? "changed the position of card"
                    : "updated card";
      return `${change} “${card}”`;
    }
    case "createList":
      return `created list “${list}”`;
    case "updateList":
      return `${"name" in old ? "renamed" : "updated"} list “${list}”`;
    case "moveListFromBoard":
      return `moved list “${list}” from this board`;
    case "createBoard":
      return "created the board";
    case "copyBoard":
      return "copied the board";
    case "updateBoard":
      return "updated the board";
    case "addMemberToBoard":
      return "added a board member";
    case "makeAdminOfBoard":
      return "made a board admin";
    case "makeNormalMemberOfBoard":
      return "changed a board member's role";
    case "addToOrganizationBoard":
      return "added the board to a workspace";
    case "removeFromOrganizationBoard":
      return "removed the board from a workspace";
    default:
      return `performed action ${string(action.type) || "Trello"}`;
  }
}
