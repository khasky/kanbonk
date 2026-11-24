import type { Card, Member } from "../model";
import { t } from "../i18n";
import { Checkbox } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { labelPickerClass } from "./LabelPicker";

/** A member's initials in a circle. */
export function MemberAvatar({ member }: { member: Member }) {
  return (
    <span
      className="grid size-8 flex-none place-items-center rounded-full bg-[#1d7a8c] text-[12px] font-bold text-white"
      title={member.name}
      aria-label={member.name}
    >
      {member.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

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
      <div className="mb-0.5 text-[12px] font-semibold text-ink-subtle">{t("card.boardMembers")}</div>
      {assignable.map((member) => (
        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1.5 py-1 hover:bg-surface-sunken"
          key={member.id}
        >
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
          <MemberAvatar member={member} />
          <span className="min-w-0 wrap-anywhere">
            {member.id === currentDeviceId ? t("card.memberYou", { name: member.name }) : member.name}
          </span>
        </label>
      ))}
      <Hint as="small">{t("card.membersHint")}</Hint>
    </div>
  );
}

/** The card's members as avatars, for a row of the card's details. */
export function CardMemberAvatars({ card, boardMembers }: { card: Card; boardMembers: Member[] }) {
  return (card.memberIds ?? []).map((id) => {
    const member = boardMembers.find((item) => item.id === id);
    return member && <MemberAvatar key={id} member={member} />;
  });
}
