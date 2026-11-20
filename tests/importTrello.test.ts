import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  addImportedBoardWithRevisions,
  parseTrelloBoard,
  prepareTrelloWorkspace,
  readTrelloExport,
  restoreExistingAttachments,
  restoreTrelloAttachments,
} from "../src/trello/import";
import { loadAttachment, saveAttachment } from "../src/storage";
import { addImportedBoard } from "../src/trello/import";
import { emptyState } from "../src/model";

vi.mock("../src/storage", () => ({
  saveAttachment: vi.fn(async () => {}),
  loadAttachment: vi.fn(async () => undefined),
}));

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("./trello-board.json", import.meta.url)), "utf8"));

describe("Trello import", () => {
  beforeEach(() => {
    vi.mocked(saveAttachment)
      .mockReset()
      .mockImplementation(async () => {});
    vi.mocked(loadAttachment)
      .mockReset()
      .mockImplementation(async () => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("restores board structure, card details and comment author", () => {
    const imported = parseTrelloBoard(fixture, "workspace-1");
    expect(imported.board.name).toBe("Trello import");
    expect(imported.board.description).toBe("Import check");
    expect(imported.lists.map((list) => list.name)).toEqual(["Plans"]);
    expect(imported.cards[0].listId).toBe(imported.lists[0].id);
    expect(imported.cards[0].labelIds).toEqual([imported.labels[0].id]);
    expect(imported.cards[0].checklists[0].items.map((item) => item.checked)).toEqual([true, false]);
    expect(imported.cards[0].comments[0]).toMatchObject({
      text: "Comment from Trello",
      author: "Author",
      authorDeviceId: "trello:unknown",
    });
    expect(imported.activity[0].summary).toContain("Card from Trello");
    expect(imported.cards[0].attachments[0]).toMatchObject({ name: "note.txt", status: "missing" });
    expect(imported.cards[0].sourceTrelloId).toBe("trello-card-1");
  });

  it("groups imported boards by their Trello workspace ID", () => {
    const first = parseTrelloBoard({ ...fixture, idOrganization: "trello-workspace" }, "personal");
    const created = prepareTrelloWorkspace(emptyState(), first.organization, "personal");
    expect(created.state.workspaces[0]).toMatchObject({ name: "Trello trello-w", sourceTrelloId: "trello-workspace" });
    expect(created.changedWorkspaceId).toBe(created.workspaceId);

    const second = parseTrelloBoard(
      { ...fixture, id: "second-board", idOrganization: "trello-workspace", kanbonkOrganizationName: "Team" },
      "personal",
    );
    const reused = prepareTrelloWorkspace(created.state, second.organization, "personal");
    expect(reused.workspaceId).toBe(created.workspaceId);
    expect(reused.state.workspaces).toHaveLength(1);
    expect(reused.state.workspaces[0].name).toBe("Team");
    expect(reused.changedWorkspaceId).toBe(created.workspaceId);
    expect(prepareTrelloWorkspace(reused.state, second.organization, "personal").changedWorkspaceId).toBeUndefined();
  });

  it("restores a Trello sticker from the initial or a later ZIP", async () => {
    const source = {
      ...fixture,
      cards: [
        {
          ...fixture.cards[0],
          attachments: [],
          stickers: [{ id: "trello-sticker", image: "check", imageUrl: "https://example.com/check.png" }],
        },
      ],
    };
    const archive = new File(
      [new Uint8Array(zipSync({ "stickers/trello-sticker/image.png": strToU8("sticker bytes") }))],
      "stickers.zip",
    );
    const initial = parseTrelloBoard(source, "workspace-1");
    expect(initial.cards[0].stickers?.[0]).toMatchObject({
      name: "check",
      sourceTrelloId: "trello-sticker",
      status: "missing",
    });
    expect(await restoreTrelloAttachments(initial, archive)).toEqual([]);
    expect(initial.cards[0].stickers?.[0]).toMatchObject({ status: "local" });
    expect(await vi.mocked(saveAttachment).mock.calls[0][1].text()).toBe("sticker bytes");

    const later = parseTrelloBoard(source, "workspace-1");
    const files = new Map<string, Blob>();
    vi.mocked(saveAttachment).mockImplementation(async (id, blob) => {
      files.set(id, blob);
    });
    vi.mocked(loadAttachment).mockImplementation(async (id) => files.get(id));
    const restored = await restoreExistingAttachments(addImportedBoard(emptyState(), later), archive);
    expect(restored.restoredStickers).toBe(1);
    expect(restored.changedCards).toEqual([later.cards[0].id]);
    expect(restored.state.cards[0].stickers?.[0]).toMatchObject({ status: "local" });
    const sticker = later.cards[0].stickers?.[0];
    if (!sticker || typeof sticker === "string") throw new Error("Sticker was not created");
    expect(await files.get(sticker.imageId)?.text()).toBe("sticker bytes");
    expect((await restoreExistingAttachments(restored.state, archive)).restoredStickers).toBe(0);
  });

  it("downloads a Trello sticker image directly when its URL is available", async () => {
    const url = "https://d2k1ftgv7pobq7.cloudfront.net/images/stickers/check.png";
    const source = {
      ...fixture,
      cards: [
        { ...fixture.cards[0], attachments: [], stickers: [{ id: "trello-sticker", image: "check", imageUrl: url }] },
      ],
    };
    const request = vi.fn(async () => new Response(new Blob(["sticker bytes"], { type: "image/png" })));
    vi.stubGlobal("fetch", request);
    const result = parseTrelloBoard(source, "workspace-1");
    expect(await restoreTrelloAttachments(result)).toEqual([]);
    expect(request).toHaveBeenCalledExactlyOnceWith(url, { credentials: "omit" });
    expect(result.cards[0].stickers?.[0]).toMatchObject({ status: "local" });
    expect(await vi.mocked(saveAttachment).mock.calls[0][1].text()).toBe("sticker bytes");
  });

  it("does not fetch a sticker from an unrelated host", async () => {
    const source = {
      ...fixture,
      cards: [
        {
          ...fixture.cards[0],
          attachments: [],
          stickers: [{ id: "trello-sticker", image: "check", imageUrl: "https://example.com/check.png" }],
        },
      ],
    };
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const result = parseTrelloBoard(source, "workspace-1");
    expect(await restoreTrelloAttachments(result)).toEqual(["Could not download sticker “check”."]);
    expect(request).not.toHaveBeenCalled();
    expect(result.cards[0].stickers?.[0]).toMatchObject({ status: "missing" });
  });

  it("restores subtle, bold and colorless Trello labels", () => {
    const labels = [
      { id: "subtle", name: "Light", color: "green_light" },
      { id: "bold", name: "Dark", color: "purple_dark" },
      { id: "neutral", name: "No colour", color: null },
      { id: "gray", name: "Gray", color: "black" },
    ];
    const source = { ...fixture, labels, cards: [{ ...fixture.cards[0], idLabels: labels.map((label) => label.id) }] };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.labels.map((label) => label.color)).toEqual(["#baf3db", "#964ac0", "", "#8c8f97"]);
    expect(imported.cards[0].labelIds).toEqual(imported.labels.map((label) => label.id));
  });

  it("restores checklist order from Trello positions", () => {
    const source = {
      ...fixture,
      checklists: [
        { ...fixture.checklists[0], id: "second", name: "Second", pos: 32768 },
        { ...fixture.checklists[0], id: "first", name: "First", pos: 16384 },
      ],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.cards[0].checklists.map((checklist) => checklist.name)).toEqual(["First", "Second"]);
  });

  it("downloads an attachment directly when only a Trello JSON was selected", async () => {
    const source = {
      ...fixture,
      cards: [{ ...fixture.cards[0], attachments: [{ ...fixture.cards[0].attachments[0], bytes: 12 }] }],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    const download = vi.fn(async () => new Blob(["direct media"], { type: "text/plain" }));
    expect(await restoreTrelloAttachments(imported, undefined, download)).toEqual([]);
    expect(download).toHaveBeenCalledWith(fixture.cards[0].attachments[0].url);
    expect(imported.cards[0].attachments[0]).toMatchObject({ status: "local", size: 12 });
    expect(await vi.mocked(saveAttachment).mock.calls[0][1].text()).toBe("direct media");
  });

  it("downloads only attachments missing from a selected ZIP", async () => {
    const second = {
      ...fixture.cards[0].attachments[0],
      id: "trello-attachment-2",
      name: "second.txt",
      bytes: 11,
      url: "https://trello.com/1/cards/trello-card-1/attachments/trello-attachment-2/download/second.txt",
    };
    const source = {
      ...fixture,
      cards: [{ ...fixture.cards[0], attachments: [{ ...fixture.cards[0].attachments[0], bytes: 8 }, second] }],
    };
    const zip = new File(
      [new Uint8Array(zipSync({ "attachments/trello-attachment-1/note.txt": strToU8("from ZIP") }))],
      "partial.zip",
    );
    const download = vi.fn(async () => new Blob(["from Trello"], { type: "text/plain" }));
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(await restoreTrelloAttachments(imported, zip, download)).toEqual([]);
    expect(download).toHaveBeenCalledExactlyOnceWith(second.url);
    expect(imported.cards[0].attachments.map((attachment) => attachment.status)).toEqual(["local", "local"]);
    expect(await vi.mocked(saveAttachment).mock.calls[0][1].text()).toBe("from ZIP");
    expect(await vi.mocked(saveAttachment).mock.calls[1][1].text()).toBe("from Trello");
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseTrelloBoard({ name: "Not an export" }, "workspace-1")).toThrow("does not look like");
  });

  it("reads a board JSON from a ZIP", async () => {
    const zip = new File(
      [
        new Uint8Array(
          zipSync({ "board.json": strToU8(JSON.stringify(fixture)), "attachments/note.txt": strToU8("example") }),
        ),
      ],
      "board.zip",
    );
    expect(((await readTrelloExport([zip])).json as typeof fixture).name).toBe("Trello import");
  });

  it("imports a JSON attachment that is itself a Trello board export", async () => {
    const attachedBoard = JSON.stringify({ id: "attached-board", name: "Attached", lists: [], cards: [] });
    const source = {
      ...fixture,
      cards: [
        {
          ...fixture.cards[0],
          attachments: [
            { ...fixture.cards[0].attachments[0], name: "snapshot.json", bytes: strToU8(attachedBoard).length },
          ],
        },
      ],
    };
    const archive = new File(
      [
        new Uint8Array(
          zipSync({
            "board.json": strToU8(JSON.stringify(source)),
            "attachments/trello-attachment-1/snapshot.json": strToU8(attachedBoard),
          }),
        ),
      ],
      "board.zip",
    );
    const parsed = await readTrelloExport([archive]);
    expect((parsed.json as typeof fixture).id).toBe(fixture.id);
    expect(parsed.boardId).toBe(fixture.id);
    const imported = parseTrelloBoard(parsed.json, "workspace-1");
    expect(await restoreTrelloAttachments(imported, archive)).toEqual([]);
    expect(imported.cards[0].attachments[0].status).toBe("local");
    expect(await vi.mocked(saveAttachment).mock.calls[0][1].text()).toBe(attachedBoard);
  });

  it("does not substitute a same-name ZIP file with a different size", async () => {
    const archive = new File([new Uint8Array(zipSync({ "note.txt": strToU8("wrong") }))], "wrong.zip");
    const imported = parseTrelloBoard(fixture, "workspace-1");
    expect(await restoreTrelloAttachments(imported, archive)).toHaveLength(1);
    expect(imported.cards[0].attachments[0].status).toBe("missing");
    expect(saveAttachment).not.toHaveBeenCalled();
  });

  it("does not substitute an attachment from a different Trello ID", async () => {
    const archive = new File(
      [new Uint8Array(zipSync({ "attachments/other-id/note.txt": strToU8("wrong board____") }))],
      "wrong.zip",
    );
    const imported = parseTrelloBoard(fixture, "workspace-1");
    expect(await restoreTrelloAttachments(imported, archive)).toHaveLength(1);
    expect(imported.cards[0].attachments[0].status).toBe("missing");
    expect(saveAttachment).not.toHaveBeenCalled();
  });

  it("does not use board JSON or background as an attachment with the same name", async () => {
    const source = {
      ...fixture,
      cards: [
        {
          ...fixture.cards[0],
          attachments: [
            { ...fixture.cards[0].attachments[0], name: "board.json", bytes: strToU8("actual attachment").length },
          ],
        },
      ],
    };
    const archive = new File(
      [
        new Uint8Array(
          zipSync({
            "board.json": strToU8(JSON.stringify(source)),
            "background/trello-board-1/board.json": strToU8("background"),
            "attachments/board.json": strToU8("actual attachment"),
          }),
        ),
      ],
      "import.zip",
    );
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(await restoreTrelloAttachments(imported, archive)).toEqual([]);
    expect(imported.cards[0].attachments[0].status).toBe("local");
    expect(
      await vi
        .mocked(saveAttachment)
        .mock.calls.find(([id]) => id === imported.cards[0].attachments[0].id)?.[1]
        .text(),
    ).toBe("actual attachment");

    vi.mocked(saveAttachment).mockClear();
    imported.cards[0].attachments[0].status = "missing";
    const restored = await restoreExistingAttachments(
      {
        workspaces: [],
        boards: [imported.board],
        lists: imported.lists,
        cards: imported.cards,
        labels: imported.labels,
        revisions: [],
        heads: {},
        ancestry: {},
      },
      archive,
    );
    expect(restored.restored).toBe(1);
    expect(restored.state.cards[0].attachments[0].status).toBe("local");
    expect(
      await vi
        .mocked(saveAttachment)
        .mock.calls.find(([id]) => id === imported.cards[0].attachments[0].id)?.[1]
        .text(),
    ).toBe("actual attachment");
  });

  it("identifies the board inside a ZIP before combining it with another JSON", async () => {
    const withBoard = new File(
      [new Uint8Array(zipSync({ "board.json": strToU8(JSON.stringify(fixture)) }))],
      "board.zip",
    );
    const mediaOnly = new File([new Uint8Array(zipSync({ "attachments/file.txt": strToU8("file") }))], "media.zip");
    expect((await readTrelloExport([withBoard])).boardId).toBe(fixture.id);
    expect((await readTrelloExport([mediaOnly])).boardId).toBe("");
  });

  it("does not attach a ZIP file to a different imported board with the same filename", async () => {
    const first = parseTrelloBoard({ ...fixture, cards: [] }, "workspace-1");
    const second = parseTrelloBoard({ ...fixture, id: "trello-board-2" }, "workspace-1");
    const state = {
      ...first,
      workspaces: [],
      boards: [first.board, second.board],
      cards: second.cards,
      lists: [...first.lists, ...second.lists],
      labels: [...first.labels, ...second.labels],
      revisions: [],
      heads: {},
      ancestry: {},
    };
    const zip = new File(
      [
        new Uint8Array(
          zipSync({
            "board.json": strToU8(JSON.stringify({ ...fixture, cards: [] })),
            "attachments/note.txt": strToU8("wrong board____"),
          }),
        ),
      ],
      "board.zip",
    );
    const restored = await restoreExistingAttachments(state, zip);
    expect(restored.restored).toBe(0);
    expect(restored.state.cards[0].attachments[0].status).toBe("missing");
    expect(saveAttachment).not.toHaveBeenCalled();
    await expect(restoreExistingAttachments({ ...state, boards: [second.board] }, zip)).rejects.toThrow(
      "The board from the ZIP was not found",
    );
  });

  it("uses the complete comment history supplied by the browser helper", () => {
    const source = {
      ...fixture,
      actions: Array.from({ length: 1000 }, () => ({ type: "updateCard" })),
      kanbonkCommentsComplete: true,
      kanbonkComments: [
        {
          type: "commentCard",
          date: "2020-01-01T00:00:00.000Z",
          data: { card: { id: fixture.cards[0].id }, text: "Old comment" },
          memberCreator: { fullName: "Author" },
        },
      ],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.cards[0].comments.map((comment) => comment.text)).toEqual(["Old comment"]);
    expect(imported.activity.filter((item) => item.category === "comment")).toHaveLength(1);
    expect(imported.warnings.some((warning) => warning.includes("last 1000 actions"))).toBe(true);
    expect(imported.warnings.some((warning) => warning.includes("older comments"))).toBe(false);
  });

  it("imports Trello actions into board activity with author, time and full comments without duplicates", () => {
    const recent = {
      id: "comment-1",
      type: "commentCard",
      date: "2025-01-02T00:00:00.000Z",
      data: { card: { id: fixture.cards[0].id, name: "Task" }, text: "Recent comment" },
      memberCreator: { fullName: "Author" },
    };
    const old = {
      ...recent,
      id: "comment-2",
      date: "2024-01-02T00:00:00.000Z",
      data: { ...recent.data, text: "Old comment" },
    };
    const source = {
      ...fixture,
      actions: [
        {
          id: "create-1",
          type: "createCard",
          date: "2025-01-01T00:00:00.000Z",
          data: { card: { id: fixture.cards[0].id, name: "Task" } },
          memberCreator: { fullName: "Author" },
        },
        recent,
      ],
      kanbonkCommentsComplete: true,
      kanbonkComments: [recent, old],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    const state = addImportedBoard(emptyState(), imported);
    expect(state.activity).toHaveLength(3);
    expect(state.activity?.filter((item) => item.category === "comment")).toHaveLength(2);
    expect(
      state.activity?.every((item) => item.boardId === imported.board.id && item.entityId === imported.cards[0].id),
    ).toBe(true);
    expect(state.activity?.find((item) => item.summary.includes("created card"))).toMatchObject({
      createdAt: "2025-01-01T00:00:00.000Z",
      summary: "Author: created card “Task”",
    });
    expect(imported.cards[0].comments.map((item) => item.text)).toEqual(["Old comment", "Recent comment"]);
  });

  it("records initial versions without duplicating imported activity", () => {
    const imported = parseTrelloBoard(fixture, "workspace-1");
    const state = addImportedBoardWithRevisions(emptyState(), imported, "device-1");
    expect(state.activity).toHaveLength(imported.activity.length);
    expect(state.activity?.map((item) => item.summary)).toEqual(imported.activity.map((item) => item.summary));
    expect(state.revisions).toHaveLength(1 + imported.lists.length + imported.labels.length + imported.cards.length);
  });

  it("shows a checklist edit from Trello in board activity", () => {
    const source = {
      ...fixture,
      actions: [
        {
          id: "checklist-1",
          type: "updateChecklist",
          date: "2025-01-03T00:00:00.000Z",
          data: { card: { id: fixture.cards[0].id } },
          memberCreator: { fullName: "Author" },
        },
      ],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.activity[0]).toMatchObject({
      entityKind: "card",
      entityId: imported.cards[0].id,
      summary: "Author: updated a checklist on card “Card from Trello”",
    });
  });

  it("preserves a Trello due reminder when present", () => {
    const source = { ...fixture, cards: [{ ...fixture.cards[0], dueReminder: 1440 }] };
    expect(parseTrelloBoard(source, "workspace-1").cards[0].dueReminderMinutes).toBe(1440);
  });

  it("keeps a closed Trello board and its cards available for later restoration", () => {
    const imported = parseTrelloBoard({ ...fixture, closed: true }, "workspace-1");
    expect(imported.board.archived).toBe(true);
    expect(imported.lists).toHaveLength(1);
    expect(imported.cards).toHaveLength(1);
  });

  it("preserves a template card, including a hidden template", () => {
    const source = { ...fixture, cards: [{ ...fixture.cards[0], isTemplate: true, closed: true }] };
    expect(parseTrelloBoard(source, "workspace-1").cards[0]).toMatchObject({ isTemplate: true, archived: true });
  });

  it("preserves the card start date from Trello", () => {
    const source = { ...fixture, cards: [{ ...fixture.cards[0], start: "2026-11-30T09:00:00.000Z" }] };
    expect(parseTrelloBoard(source, "workspace-1").cards[0].startAt).toBe("2026-11-30T09:00:00.000Z");
  });

  it("restores card members from board member records and card IDs", () => {
    const source = {
      ...fixture,
      members: [{ id: "trello-member-1", fullName: "Alex" }],
      cards: [{ ...fixture.cards[0], idMembers: ["trello-member-1", "trello-member-2"] }],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.board.members?.map((member) => member.name)).toEqual(["Alex", "Trello member trello-m"]);
    expect(imported.cards[0].memberIds).toEqual(imported.board.members?.map((member) => member.id));
  });

  it("maps a Trello cover to its locally imported attachment", () => {
    const source = {
      ...fixture,
      cards: [{ ...fixture.cards[0], cover: { idAttachment: "trello-attachment-1", size: "full" } }],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.cards[0].cover).toEqual({
      attachmentId: imported.cards[0].attachments[0].id,
      color: undefined,
      size: "full",
    });
  });

  it("restores attachment order and the legacy cover field", () => {
    const source = {
      ...fixture,
      cards: [
        {
          ...fixture.cards[0],
          idAttachmentCover: "trello-attachment-1",
          attachments: [
            { ...fixture.cards[0].attachments[0], id: "trello-attachment-2", name: "later.txt", pos: 32768 },
            { ...fixture.cards[0].attachments[0], pos: 16384 },
          ],
        },
      ],
    };
    const imported = parseTrelloBoard(source, "workspace-1");
    expect(imported.cards[0].attachments.map((attachment) => attachment.name)).toEqual(["note.txt", "later.txt"]);
    expect(imported.cards[0].cover?.attachmentId).toBe(imported.cards[0].attachments[0].id);
  });

  it("reports a background image that cannot be obtained from the board JSON", () => {
    const source = {
      ...fixture,
      prefs: { ...fixture.prefs, backgroundImage: "https://example.invalid/background.jpg" },
    };
    expect(
      parseTrelloBoard(source, "workspace-1").warnings.some((warning) => warning.includes("Background image")),
    ).toBe(true);
  });
});
