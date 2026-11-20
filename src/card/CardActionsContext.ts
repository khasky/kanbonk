import { createContext, useContext } from "react";
import type { CardActions } from "../hooks/useCardActions";

/** Card changes for the card dialog and its sections, provided by `App`. */
export const CardActionsContext = createContext<CardActions | null>(null);

export function useCardActionsContext(): CardActions {
  const actions = useContext(CardActionsContext);
  if (!actions) throw new Error("CardActionsContext is missing");
  return actions;
}
