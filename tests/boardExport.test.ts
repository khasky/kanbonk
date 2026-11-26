import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildDocx } from "../src/export/docx";
import {
  boardScope,
  emptyExportFilter,
  exportDocModel,
  exportFields,
  exportTable,
  pickedGroups,
  pickedState,
} from "../src/export/exportData";
import { buildXlsx, columnName } from "../src/export/xlsx";
import { type AppState, type Card, emptyState } from "../src/model";
import { exportTrelloCsv } from "../src/trello/formats";

const card = (id: string, listId: string, position: number, extra: Partial<Card> = {}): Card => ({
  id,
  boardId: "b1",
  listId,
  name: `Card ${id}`,
  description: "",
  position,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
  ...extra,
});

function board(): AppState {
  return {
    ...emptyState(),
    boards: [
      {
        id: "b1",
        workspaceId: "w1",
        name: "Roadmap",
        description: "",
        background: "",
        starred: false,
        members: [{ id: "m1", name: "Sam" }],
      },
    ],
    lists: [
      { id: "l2", boardId: "b1", name: "Doing", position: 2 },
      { id: "l1", boardId: "b1", name: "Ideas", position: 1 },
      { id: "l3", boardId: "b1", name: "Old", position: 3, deletedAt: "2026-01-01T00:00:00.000Z" },
    ],
    labels: [{ id: "x", boardId: "b1", name: "Urgent", color: "#f87168" }],
    cards: [
      card("a", "l1", 1, {
        labelIds: ["x"],
        memberIds: ["m1"],
        dueAt: "2026-12-10T12:00:00.000Z",
        description: "Write <it> & ship",
        checklists: [
          {
            id: "k1",
            name: "Steps",
            items: [
              { id: "i1", name: "Draft", checked: true },
              { id: "i2", name: "Review", checked: false },
            ],
          },
          { id: "k2", name: "Later", items: [{ id: "i3", name: "Publish", checked: false }] },
        ],
      }),
      card("b", "l1", 2, { dueAt: "2027-02-01T12:00:00.000Z" }),
      card("c", "l2", 1),
      card("d", "l2", 2, { deletedAt: "2026-01-02T00:00:00.000Z" }),
      card("e", "l3", 1),
    ],
  };
}

const pickAll = (state: AppState, includeTrash = false) => {
  const scope = boardScope(state, "b1", includeTrash);
  if (!scope) throw new Error("no board");
  return { scope, pick: { listIds: new Set(scope.lists.map((list) => list.id)), excludedCardIds: new Set<string>() } };
};

describe("board export", () => {
  it("picks lists and cards in board order, leaves out the trash unless asked, and filters", () => {
    const state = board();
    const { scope, pick } = pickAll(state);
    const names = (groups: ReturnType<typeof pickedGroups>) =>
      groups.map((group) => `${group.list.name}: ${group.cards.map((item) => item.id).join(",")}`);
    expect(names(pickedGroups(scope, pick, emptyExportFilter))).toEqual(["Ideas: a,b", "Doing: c"]);

    const withTrash = pickAll(state, true);
    expect(names(pickedGroups(withTrash.scope, withTrash.pick, emptyExportFilter))).toEqual([
      "Ideas: a,b",
      "Doing: c,d",
      "Old: e",
    ]);

    expect(names(pickedGroups(scope, { ...pick, excludedCardIds: new Set(["b"]) }, emptyExportFilter))).toEqual([
      "Ideas: a",
      "Doing: c",
    ]);
    expect(names(pickedGroups(scope, { ...pick, listIds: new Set(["l2"]) }, emptyExportFilter))).toEqual(["Doing: c"]);
    expect(names(pickedGroups(scope, pick, { ...emptyExportFilter, labelId: "x", memberId: "m1" }))).toEqual([
      "Ideas: a",
    ]);
    expect(names(pickedGroups(scope, pick, { ...emptyExportFilter, dueFrom: "2027-01-01" }))).toEqual(["Ideas: b"]);
    expect(names(pickedGroups(scope, pick, { ...emptyExportFilter, dueTo: "2026-12-31" }))).toEqual(["Ideas: a"]);
  });

  it("lays checklists out in one cell, a column per checklist, a row per item or a column per item", () => {
    const { scope, pick } = pickAll(board());
    const groups = pickedGroups(scope, pick, { ...emptyExportFilter, labelId: "x" });
    const fields = ["name", "checklists", "labels"] as const;

    expect(exportTable(scope, groups, [...fields], "inline")).toEqual({
      header: ["Name", "Checklists", "Labels"],
      rows: [["Card a", "Steps\n[x] Draft\n[ ] Review\n\nLater\n[ ] Publish", "Urgent"]],
    });
    expect(exportTable(scope, groups, [...fields], "block")).toEqual({
      header: ["Name", "Checklist 1", "Checklist 2", "Labels"],
      rows: [["Card a", "Steps\n[x] Draft\n[ ] Review", "Later\n[ ] Publish", "Urgent"]],
    });
    expect(exportTable(scope, groups, [...fields], "row")).toEqual({
      header: ["Name", "Checklist", "Item", "Done", "Labels"],
      rows: [
        ["Card a", "Steps", "Draft", "✓", "Urgent"],
        ["Card a", "Steps", "Review", "", "Urgent"],
        ["Card a", "Later", "Publish", "", "Urgent"],
      ],
    });
    expect(exportTable(scope, groups, [...fields], "column")).toEqual({
      header: ["Name", "Item 1", "Item 2", "Item 3", "Labels"],
      rows: [["Card a", "[x] Draft", "[ ] Review", "[ ] Publish", "Urgent"]],
    });
  });

  it("writes an .xlsx workbook with escaped text and a frozen, filtered header", () => {
    const { scope, pick } = pickAll(board());
    const table = exportTable(scope, pickedGroups(scope, pick, emptyExportFilter), [...exportFields], "inline");
    const files = unzipSync(buildXlsx(table, "Road/map: Q1"));
    expect(Object.keys(files)).toContain("[Content_Types].xml");
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("Write &lt;it&gt; &amp; ship");
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain(`<autoFilter ref="A1:${columnName(table.header.length)}4"/>`);
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Road map  Q1"');
    expect(columnName(1)).toBe("A");
    expect(columnName(27)).toBe("AA");
    expect(columnName(703)).toBe("AAA");
  });

  it("writes a .docx document with a cover, list headings, page breaks and checklists", () => {
    const { scope, pick } = pickAll(board());
    const model = exportDocModel(
      scope,
      pickedGroups(scope, pick, emptyExportFilter),
      [...exportFields],
      { title: "Q1 report", accent: "#0c66e4", style: "styled", cover: true, pagePerList: true },
      new Date("2026-11-25T10:00:00.000Z"),
    );
    expect(model.cardCount).toBe(3);
    expect(model.dueRange).toEqual(["2026-12-10", "2027-02-01"]);
    const files = unzipSync(buildDocx(model));
    const document = strFromU8(files["word/document.xml"]);
    expect(document).toContain("Q1 report");
    expect(document).toContain("3 cards");
    expect(document.match(/<w:pageBreakBefore\/>/g)).toHaveLength(2);
    expect(document).toContain("☑ ");
    expect(document).toContain("<w:strike/>");
    expect(document).toContain("Write &lt;it&gt; &amp; ship");
    expect(strFromU8(files["word/styles.xml"])).toContain('w:color w:val="0C66E4"');
    expect(strFromU8(files["word/footer1.xml"])).toContain(" PAGE ");
  });

  it("keeps Trello's CSV columns for the picked cards only", () => {
    const state = board();
    const { scope, pick } = pickAll(state);
    const groups = pickedGroups(scope, { ...pick, listIds: new Set(["l2"]) }, emptyExportFilter);
    const csv = exportTrelloCsv(pickedState(state, "b1", groups), "b1");
    expect(csv).toContain("Card c");
    expect(csv).not.toContain("Card a");
  });
});
