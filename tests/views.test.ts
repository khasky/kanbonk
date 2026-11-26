import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AppState,
  type Card,
  type ViewCount,
  cardViewStats,
  emptyState,
  mergeViews,
  recordView,
  sortListCards,
  isViewCount,
  viewStats,
} from "../src/model";
import { validState } from "../src/backup/backup";
import { mergeStates } from "../src/sync/sync";
import { LanSync, type Presence } from "../src/sync/lanSync";

const at = (time: string) => new Date(`2026-11-20T${time}:00`);
const card = (id: string, position: number): Card => ({
  id,
  boardId: "b1",
  listId: "l1",
  name: id,
  description: "",
  position,
  labelIds: [],
  checklists: [],
  comments: [],
  attachments: [],
});
const view = (entityId: string, deviceId: string, author: string) => ({
  kind: "card" as const,
  entityId,
  boardId: "b1",
  deviceId,
  author,
});

describe("views", () => {
  it("counts a card view per device and day, and a quick reopen once", () => {
    let state: AppState = emptyState();
    state = recordView(state, view("c1", "laptop", "Ann"), at("09:00"));
    state = recordView(state, view("c1", "laptop", "Ann"), at("09:03"));
    state = recordView(state, view("c1", "laptop", "Ann"), at("09:10"));
    state = recordView(state, view("c1", "phone", "Bob"), at("09:11"));
    expect(state.views?.map((item) => [item.deviceId, item.count])).toEqual([
      ["laptop", 2],
      ["phone", 1],
    ]);
    // A board visit has a longer window.
    state = recordView(state, { ...view("b1", "laptop", "Ann"), kind: "board" }, at("10:00"));
    state = recordView(state, { ...view("b1", "laptop", "Ann"), kind: "board" }, at("10:20"));
    expect(state.views?.filter((item) => item.kind === "board").map((item) => item.count)).toEqual([1]);

    const stats = cardViewStats(state).get("c1");
    expect(stats).toMatchObject({ total: 3, unique: 2, lastBy: "Bob" });
    expect(stats?.viewers.map((item) => [item.name, item.count])).toEqual([
      ["Ann", 2],
      ["Bob", 1],
    ]);
    expect([...(stats?.byDay ?? [])]).toEqual([["2026-11-20", 3]]);
  });

  it("merges two devices' counters by keeping the larger count, and drops malformed ones", () => {
    const mine = recordView(emptyState(), view("c1", "laptop", "Ann"), at("09:00")).views ?? [];
    const theirs = [
      { ...mine[0], count: 4, lastAt: "2026-11-20T12:00:00.000Z" },
      { ...mine[0], id: "card:c2:phone:2026-11-20", entityId: "c2", deviceId: "phone", count: 1 },
      { id: "bad", kind: "card", count: -1 },
    ];
    const merged = mergeViews(mine, theirs);
    expect(merged.map((item) => [item.entityId, item.count])).toEqual([
      ["c1", 4],
      ["c2", 1],
    ]);
    expect(mergeViews(theirs.slice(0, 1) as ViewCount[], mine)[0].count).toBe(4);
    expect(theirs.every(isViewCount)).toBe(false);
    expect(merged.every(isViewCount)).toBe(true);

    const local = { ...emptyState(), views: mine };
    const remote: AppState = { ...emptyState(), views: theirs.slice(0, 2) as ViewCount[] };
    expect(validState(remote as unknown as Record<string, unknown>)).toBe(true);
    expect(validState({ ...remote, views: theirs } as unknown as Record<string, unknown>)).toBe(false);
    expect(mergeStates(local, remote).state.views?.map((item) => item.count)).toEqual([4, 1]);
  });

  it("sorts a list by views, keeping the board order for ties", () => {
    const cards = [card("a", 1), card("b", 2), card("c", 3)];
    const views = new Map([
      ["b", { total: 5, lastAt: "2026-11-01T00:00:00.000Z" }],
      ["c", { total: 2, lastAt: "2026-11-10T00:00:00.000Z" }],
    ]);
    const order = (by: Parameters<typeof sortListCards>[2]) =>
      sortListCards(cards, "l1", by, views)
        .sort((x, y) => x.position - y.position)
        .map((item) => item.id)
        .join("");
    expect(order("most-viewed")).toBe("bca");
    expect(order("least-viewed")).toBe("acb");
    expect(order("recently-viewed")).toBe("cba");
    expect(order("least-recently-viewed")).toBe("abc");
    expect(viewStats([]).total).toBe(0);
  });
});

describe("presence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells a trusted peer where this device is, and reports where the peer is", async () => {
    vi.stubGlobal(
      "RTCPeerConnection",
      class {
        close() {}
      },
    );
    const packets: Array<Record<string, unknown>> = [];
    const seen: Array<Presence | null> = [];
    const sync = new LanSync({
      getState: emptyState,
      onState: async () => {},
      onFile: () => {},
      onStatus: () => {},
      getPresence: () => ({ boardId: "b1", cardId: "c1" }),
      onPresence: (where) => seen.push(where),
      trust: { self: { deviceId: "me", name: "Laptop" }, isTrusted: () => true, onPeer: async () => true },
    });
    (sync as unknown as { channel: RTCDataChannel }).channel = {
      readyState: "open",
      bufferedAmount: 0,
      send: (data: string) => packets.push(JSON.parse(data)),
      close() {},
    } as unknown as RTCDataChannel;
    const receive = (packet: Record<string, unknown>) =>
      (sync as unknown as { receive: (packet: Record<string, unknown>) => Promise<void> }).receive(packet);

    // Nothing is said before the peer is trusted.
    await sync.sendPresence();
    await receive({ type: "presence", boardId: "b9" });
    expect(packets).toEqual([]);
    expect(seen).toEqual([]);

    await receive({ type: "hello", deviceId: "phone", name: "Phone" });
    expect(packets[0]).toEqual({ type: "presence", boardId: "b1", cardId: "c1" });
    await receive({ type: "presence", boardId: "b2", cardId: 5 });
    expect(seen).toEqual([{ boardId: "b2", cardId: undefined }]);
  });
});
