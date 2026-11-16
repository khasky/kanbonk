// Generates a large Trello-format board export for load tests.
// Usage: node scripts/generate-big-board.mjs [cards=5000] [lists=50] [out=big-board.json]
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const words = "api auth backend bug calendar card cache client deploy design docs export filter fix frontend import index layout login merge migration mobile offline perf query release report review search server sync test ui ux upload".split(" ");

/** Deterministic pseudo-random numbers so every run produces the same board. */
function random(seed) {
  let value = seed;
  return () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const hex = (value) => value.toString(16).padStart(24, "0");

export function bigBoard(cardCount = 5000, listCount = 50) {
  const next = random(42);
  const pick = (items) => items[Math.floor(next() * items.length)];
  const created = Math.floor(Date.UTC(2026, 0, 1) / 1000);
  const labels = Array.from({ length: 12 }, (_, index) => ({ id: hex(0x1000 + index), name: `Label ${index + 1}`, color: ["green", "yellow", "orange", "red", "purple", "blue"][index % 6] }));
  const lists = Array.from({ length: listCount }, (_, index) => ({ id: hex(0x2000 + index), name: `List ${index + 1}`, closed: false, pos: (index + 1) * 1024 }));
  const cards = [];
  const checklists = [];
  for (let index = 0; index < cardCount; index++) {
    const id = (created + index * 60).toString(16).padStart(8, "0") + hex(index).slice(8);
    const title = Array.from({ length: 3 + Math.floor(next() * 4) }, () => pick(words)).join(" ");
    const start = new Date(Date.UTC(2026, 0, 1 + Math.floor(next() * 330)));
    const hasDates = next() < 0.4;
    const due = new Date(start.getTime() + Math.floor(next() * 10) * 86_400_000);
    const checklistIds = [];
    if (next() < 0.3) {
      const checklistId = hex(0x900000 + index);
      checklistIds.push(checklistId);
      checklists.push({ id: checklistId, idCard: id, name: "Checklist", checkItems: Array.from({ length: 5 }, (_, item) => ({ id: hex(0xa000000 + index * 10 + item), name: `${pick(words)} ${pick(words)}`, state: next() < 0.5 ? "complete" : "incomplete", pos: item })) });
    }
    cards.push({
      id, name: `${title} #${index + 1}`, desc: Array.from({ length: Math.floor(next() * 40) }, () => pick(words)).join(" "),
      idList: lists[Math.floor(next() * listCount)].id, idLabels: next() < 0.5 ? [pick(labels).id] : [], idMembers: [], idChecklists: checklistIds,
      closed: false, pos: index * 16, start: hasDates ? start.toISOString() : null, due: hasDates ? due.toISOString() : null, dueComplete: false,
      shortLink: id.slice(-8), url: `https://trello.com/c/${id.slice(-8)}`, attachments: [], badges: {},
    });
  }
  return { id: hex(0xb0a2d), name: `Load test ${cardCount} cards`, desc: "", closed: false, prefs: { backgroundColor: "#0079bf" }, labels, lists, cards, checklists, members: [], actions: [] };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cards = "5000", lists = "50", out = "big-board.json"] = process.argv.slice(2);
  writeFileSync(out, JSON.stringify(bigBoard(Number(cards), Number(lists))));
  console.log(`Wrote ${out}: ${cards} cards in ${lists} lists`);
}
