import { common } from "./common";
import { settings } from "./settings";
import { app } from "./app";
import { layout } from "./layout";
import { pages } from "./pages";
import { panels } from "./panels";
import { board } from "./board";
import { card } from "./card";
import { dialogs } from "./dialogs";
import { ui } from "./ui";
import { hooks } from "./hooks";
import { lib } from "./lib";
import { backup } from "./backup";
import { sync } from "./sync";
import { trello } from "./trello";
import { model } from "./model";
import { ai } from "./ai";
import { exporting } from "./exporting";
import { views } from "./views";
import { labelSharing } from "./labelSharing";
import { required } from "./required";
import { cardAging } from "./cardAging";
import { mirrors } from "./mirrors";
import { priority } from "./priority";
import { cardDone } from "./cardDone";
import { calendar } from "./calendar";
import { labelCleanup } from "./labelCleanup";
import { attachments } from "./attachments";
import { table } from "./table";
import { approvals } from "./approvals";
import { duplicates } from "./duplicates";

/**
 * The English messages, the source of every translation. One namespace per area of the app, each in its own file;
 * `src/i18n/locales/<code>.ts` holds the same keys in another language.
 */
export const en = {
  common,
  settings,
  app,
  layout,
  pages,
  panels,
  board,
  card,
  dialogs,
  ui,
  hooks,
  lib,
  backup,
  sync,
  trello,
  model,
  ai,
  exporting,
  views,
  labelSharing,
  required,
  cardAging,
  mirrors,
  priority,
  cardDone,
  calendar,
  labelCleanup,
  attachments,
  table,
  approvals,
  duplicates,
};
