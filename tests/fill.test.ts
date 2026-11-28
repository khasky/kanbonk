import { describe, expect, it } from "vitest";
import {
  type AppState,
  backdropFill,
  type Card,
  coverFill,
  emptyState,
  fillBackground,
  fillTextColor,
  withBackdrop,
  withCover,
} from "../src/model";
import { exportTrelloJson } from "../src/trello/formats";
import { parseTrelloBoard } from "../src/trello/import";

const card: Card = {
  id: "card",
  boardId: "board",
  listId: "list",
  name: "Card",
  description: "",
  position: 1,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
};

describe("fills", () => {
  it("picks text that reads on a color, a gradient and an image", () => {
    expect(fillTextColor({ color: "#f5cd47" })).toBe("#172b4d");
    expect(fillTextColor({ color: "#0c66e4" })).toBe("#ffffff");
    expect(fillTextColor({ gradient: "gradient-snow" })).toBe("#172b4d");
    expect(fillTextColor({ gradient: "gradient-ocean" })).toBe("#ffffff");
    // Light at one end, dark at the other: the text that reads on the darker end.
    expect(fillTextColor({ gradient: "gradient-flower" })).toBe("#ffffff");
    expect(fillTextColor({ imageId: "file" })).toBe("#ffffff");
    expect(fillTextColor(undefined)).toBeUndefined();
    expect(fillBackground({ gradient: "gradient-ocean" })).toBe("linear-gradient(135deg, #0c66e4, #09326c)");
    expect(fillBackground({ imageId: "file" }, "blob:x", true)).toBe(
      'linear-gradient(#0000004d, #0000008c), url("blob:x") center / cover no-repeat',
    );
  });

  it("keeps a color under a board's gradient or image and gives one choice at a time", () => {
    const board = { background: "#147d86" };
    const gradient = withBackdrop(board, { gradient: "gradient-volcano" });
    expect(gradient).toMatchObject({ background: "#c9372c", backgroundGradient: "gradient-volcano" });
    const image = withBackdrop(gradient, { imageId: "file" });
    expect(backdropFill(image)).toEqual({ color: "#c9372c", gradient: undefined, imageId: "file" });
    expect(backdropFill(withBackdrop(image, { color: "#0c66e4" }))).toEqual({ color: "#0c66e4" });
    expect(coverFill(withCover(card, { gradient: "gradient-peach" }))).toEqual({ gradient: "gradient-peach" });
    expect(withCover(card, undefined).cover).toBeUndefined();
  });

  it("carries gradients through the Trello JSON export and Kanbonk's import", () => {
    const state: AppState = {
      ...emptyState(),
      workspaces: [{ id: "ws", name: "W" }],
      boards: [
        {
          id: "board",
          workspaceId: "ws",
          name: "B",
          description: "",
          background: "#e9f2ff",
          backgroundGradient: "gradient-snow",
          starred: false,
        },
      ],
      lists: [{ id: "list", boardId: "board", name: "L", position: 1 }],
      cards: [withCover(card, { gradient: "gradient-flower" })],
    };
    const imported = parseTrelloBoard(exportTrelloJson(state, "board"), "ws");
    expect(backdropFill(imported.board)).toMatchObject({ gradient: "gradient-snow" });
    expect(coverFill(imported.cards[0])).toMatchObject({ gradient: "gradient-flower" });
  });
});
