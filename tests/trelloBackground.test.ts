import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  addImportedBoard,
  parseTrelloBoard,
  restoreExistingAttachments,
  restoreTrelloAttachments,
} from "../src/trello/import";
import { emptyState } from "../src/model";
import { saveAttachment } from "../src/storage";

vi.mock("../src/storage", () => ({ saveAttachment: vi.fn() }));

const board = {
  id: "trello-board",
  name: "Background",
  lists: [],
  cards: [],
  prefs: { backgroundImage: "https://example.com/background.png" },
};
const zip = () =>
  new File(
    [new Uint8Array(zipSync({ "background/trello-board/background.png": strToU8("image bytes") }))],
    "background.zip",
  );

describe("Trello board background import", () => {
  afterEach(() => vi.resetAllMocks());

  it("restores a board background from the initial ZIP", async () => {
    const saved = new Map<string, Blob>();
    vi.mocked(saveAttachment).mockImplementation(async (id, blob) => {
      saved.set(id, blob);
    });
    const result = parseTrelloBoard(board, "workspace");
    await restoreTrelloAttachments(result, zip());
    expect(result.board.backgroundImageId).toBeTruthy();
    expect(await saved.get(result.board.backgroundImageId!)?.text()).toBe("image bytes");
    expect(saved.get(result.board.backgroundImageId!)?.type).toBe("image/png");
    expect(result.warnings.some((warning) => warning.includes("Background image"))).toBe(false);
  });

  it("restores the background from a later ZIP batch", async () => {
    const saved = new Map<string, Blob>();
    vi.mocked(saveAttachment).mockImplementation(async (id, blob) => {
      saved.set(id, blob);
    });
    const result = parseTrelloBoard(board, "workspace");
    await restoreTrelloAttachments(result);
    expect(result.board.backgroundImageId).toBeUndefined();
    const restored = await restoreExistingAttachments(addImportedBoard(emptyState(), result), zip());
    expect(restored.restoredBackgrounds).toBe(1);
    expect(restored.changedBoards).toEqual([result.board.id]);
    expect(await saved.get(restored.state.boards[0].backgroundImageId!)?.text()).toBe("image bytes");
  });

  it("preserves the MIME type of an SVG background", async () => {
    const saved = new Map<string, Blob>();
    vi.mocked(saveAttachment).mockImplementation(async (id, blob) => {
      saved.set(id, blob);
    });
    const archive = new File(
      [new Uint8Array(zipSync({ "background/trello-board/background.svg": strToU8("<svg></svg>") }))],
      "background.zip",
    );
    const result = parseTrelloBoard(board, "workspace");
    await restoreTrelloAttachments(result, archive);
    expect(saved.get(result.board.backgroundImageId!)?.type).toBe("image/svg+xml");
  });

  it("does not replace an attachment that is already stored locally", async () => {
    const source = {
      id: "trello-board",
      name: "Files",
      lists: [{ id: "trello-list", name: "List" }],
      cards: [
        {
          id: "trello-card",
          idList: "trello-list",
          name: "Card",
          attachments: [
            {
              id: "trello-file",
              name: "file.txt",
              mimeType: "text/plain",
              bytes: 8,
              url: "https://trello.com/attachments/trello-file/file.txt",
            },
          ],
        },
      ],
    };
    const result = parseTrelloBoard(source, "workspace");
    result.cards[0].attachments[0].status = "local";
    const archive = new File(
      [new Uint8Array(zipSync({ "attachments/trello-file/file.txt": strToU8("replacement") }))],
      "later.zip",
    );

    const restored = await restoreExistingAttachments(addImportedBoard(emptyState(), result), archive);

    expect(restored.restored).toBe(0);
    expect(restored.changedCards).toEqual([]);
    expect(restored.state.cards[0].attachments[0]).toEqual(result.cards[0].attachments[0]);
    expect(saveAttachment).not.toHaveBeenCalled();
  });
});
