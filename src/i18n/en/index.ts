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
};
