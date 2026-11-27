import { t } from "../i18n";
import type { AppState, Card } from "../model";
import { Button } from "../ui/Button";
import { detailSectionClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";
import { Hint } from "../ui/Hint";

/** The card's mirrors on other boards and lists, each opening that card, and a button to stop mirroring. */
export function CardMirrors({
  mirrors,
  state,
  onNavigateCard,
  onUnlink,
}: {
  mirrors: Card[];
  state: AppState;
  onNavigateCard: (target: Card) => void;
  onUnlink: () => void;
}) {
  return (
    <section className={detailSectionClass} aria-label={t("mirrors.title")}>
      <DetailTitle icon="mirror">{t("mirrors.title")}</DetailTitle>
      <Hint className="mt-0 mb-2">{t("mirrors.hint")}</Hint>
      <ul className="m-0 mb-2 grid list-none gap-1 p-0">
        {mirrors.map((mirror) => (
          <li key={mirror.id}>
            <Button variant="link-quiet" type="button" className="py-0.5" onClick={() => onNavigateCard(mirror)}>
              {t("mirrors.where", {
                board: state.boards.find((board) => board.id === mirror.boardId)?.name ?? "",
                list: state.lists.find((list) => list.id === mirror.listId)?.name ?? "",
              })}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={onUnlink}>
        {t("mirrors.unlink")}
      </Button>
    </section>
  );
}
