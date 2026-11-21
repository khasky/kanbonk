import type { Card, Member } from "../model";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { labelPickerClass } from "./LabelPicker";

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
    <div className={labelPickerClass}>
      <strong>Board members</strong>
      {assignable.map((member) => (
        <label className="flex items-center gap-2" key={member.id}>
          <Checkbox
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
      <Hint as="small">Members are trusted devices and members imported from Trello.</Hint>
    </div>
  );
}

/** Initials of the card's members. */
export function CardMemberAvatars({ card, boardMembers }: { card: Card; boardMembers: Member[] }) {
  if (!(card.memberIds ?? []).length) return null;
  return (
    <div className="mt-3 ml-[34px] flex flex-wrap gap-1" aria-label="Card members">
      {(card.memberIds ?? []).map((id) => {
        const member = boardMembers.find((item) => item.id === id);
        return (
          member && (
            <span
              className="grid h-[30px] w-[30px] place-items-center rounded-full bg-line text-[11px] font-bold text-ink"
              key={id}
              title={member.name}
              aria-label={member.name}
            >
              {member.name.slice(0, 2).toUpperCase()}
            </span>
          )
        );
      })}
    </div>
  );
}
