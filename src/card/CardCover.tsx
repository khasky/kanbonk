import { type Card, coverFill } from "../model";
import { useFillStyle } from "../ui/useFileUrl";

/**
 * The look of a card's tile under its cover, which fills the whole tile: the background, and a text color that reads
 * on it (white on a darkened image). Empty without a cover, or while a cover image is not available.
 */
export function useCoverStyle(card: Card): { background?: string; color?: string } {
  return useFillStyle(coverFill(card), true);
}
