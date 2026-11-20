import { expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { emptyState, type Card } from "../src/model";

vi.mock("../src/storage", () => ({ saveAttachment: vi.fn() }));

import { restoreExistingAttachments } from "../src/importTrello";

it("matches attachments by Trello ID when filenames repeat", async () => {
  const card: Card = {
    id: "card",
    boardId: "board",
    listId: "list",
    name: "Card",
    description: "",
    position: 1,
    labelIds: [],
    completed: false,
    checklists: [],
    comments: [],
    attachments: [
      {
        id: "local-a",
        name: "image.png",
        mimeType: "image/png",
        size: 0,
        sourceUrl: "https://trello.com/1/cards/card/attachments/trello-a/download/image.png",
        status: "missing",
      },
      {
        id: "local-b",
        name: "image.png",
        mimeType: "image/png",
        size: 0,
        sourceUrl: "https://trello.com/1/cards/card/attachments/trello-b/download/image.png",
        status: "missing",
      },
    ],
  };
  const zip = zipSync({ "attachments/trello-a/image.png": strToU8("first") });
  const file = new File([new Uint8Array(zip)], "media.zip", { type: "application/zip" });
  const result = await restoreExistingAttachments({ ...emptyState(), cards: [card] }, file);
  expect(result.restored).toBe(1);
  expect(result.state.cards[0].attachments.map((attachment) => attachment.status)).toEqual(["local", "missing"]);
});
