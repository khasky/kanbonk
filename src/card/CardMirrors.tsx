import { t } from "../i18n";
import type { AppState, Card } from "../model";
import { Button } from "../ui/Button";
import { detailSectionClass } from "./cardLook";
import { DetailTitle } from "./DetailTitle";

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
      <p className="mt-0 mb-2 text-[13px] text-ink-muted">{t("mirrors.hint")}</p>
      <ul className="m-0 mb-2 grid list-none gap-1 p-0">
        {mirrors.map((mirror) => (
          <li key={mirror.id}>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent px-0 py-0.5 text-left text-brand"
              onClick={() => onNavigateCard(mirror)}
            >
              {t("mirrors.where", {
                board: state.boards.find((board) => board.id === mirror.boardId)?.name ?? "",
                list: state.lists.find((list) => list.id === mirror.listId)?.name ?? "",
              })}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={onUnlink}>
        {t("mirrors.unlink")}
      </Button>
    </section>
  );
}
