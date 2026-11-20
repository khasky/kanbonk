import type { Card, Member } from "../model";

/**
 * Assigns members to the card. `assignable` lists board members first, then trusted devices and imported members
 * that are not on the board yet; choosing one of those adds it to the board.
 */
export function MemberPicker({
  card,
  assignable,
  boardMembers,
  currentDeviceId,
  onChange,
  onAddMember,
}: {
  card: Card;
  assignable: Member[];
  boardMembers: Member[];
  currentDeviceId: string;
  onChange: (change: (card: Card) => Card) => void;
  onAddMember: (member: Member) => void;
}) {
  return (
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
  );
}

/** Initials of the card's members. */
export function CardMemberAvatars({ card, boardMembers }: { card: Card; boardMembers: Member[] }) {
  if (!(card.memberIds ?? []).length) return null;
  return (
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
  );
}
