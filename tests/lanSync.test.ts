import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanSync } from "../src/lanSync";
import { loadAttachment, saveAttachment } from "../src/storage";
import { emptyState, markMediaLocal } from "../src/model";

vi.mock("../src/storage", () => ({ loadAttachment: vi.fn(), saveAttachment: vi.fn() }));

interface Packet { type: string; id: string; total?: number; index?: number; data?: string }

function session(onFile: (id: string) => void = () => {}) {
  return new LanSync({ getState: emptyState, onState: async () => {}, onFile, onStatus: () => {} });
}

async function transfer(blob: Blob, onFile?: (id: string) => void): Promise<{ packets: Packet[]; restored: Blob }> {
  const files = new Map<string, Blob>([["file-1", blob]]);
  vi.mocked(loadAttachment).mockImplementation(async (id) => files.get(id));
  vi.mocked(saveAttachment).mockImplementation(async (id, value) => { files.set(id, value); });
  const packets: Packet[] = [];
  const sender = session();
  (sender as unknown as { channel: RTCDataChannel }).channel = { readyState: "open", bufferedAmount: 0, send: (data: string) => packets.push(JSON.parse(data)) } as unknown as RTCDataChannel;
  await (sender as unknown as { sendFiles: (ids: string[]) => Promise<void> }).sendFiles(["file-1"]);
  files.delete("file-1");
  const receiver = session(onFile);
  for (const packet of packets) await (receiver as unknown as { receive: (packet: Packet) => Promise<void> }).receive(packet);
  const restored = files.get("file-1");
  if (!restored) throw new Error("File not received");
  return { packets, restored };
}

describe("LAN media transfer", () => {
  beforeEach(() => vi.stubGlobal("RTCPeerConnection", class { close() {} }));
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

  it("explains when the browser has no WebRTC implementation", () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    expect(() => session()).toThrow("WebRTC is not available in this browser");
  });

  it("keeps the room connection on a local address", () => {
    expect(() => new LanSync({ getState: emptyState, onState: async () => {}, onFile: () => {}, onStatus: () => {} }, { url: "ws://example.com", code: "a".repeat(32) })).toThrow("local network");
  });

  it("sends the current state automatically only while connected", async () => {
    const packets: Packet[] = [];
    const sender = session();
    const channel = { readyState: "connecting", bufferedAmount: 0, send: (data: string) => packets.push(JSON.parse(data)) };
    (sender as unknown as { channel: RTCDataChannel }).channel = channel as unknown as RTCDataChannel;
    await sender.syncIfConnected();
    expect(packets).toEqual([]);
    channel.readyState = "open";
    await sender.syncIfConnected();
    expect(packets.map((packet) => packet.type)).toEqual(["state"]);
  });

  it("rejects an invalid remote state before changing local boards", async () => {
    const onState = vi.fn(async () => {});
    const onStatus = vi.fn();
    const receiver = new LanSync({ getState: emptyState, onState, onFile: () => {}, onStatus });
    await (receiver as unknown as { receiveMessage: (message: string) => Promise<void> }).receiveMessage(JSON.stringify({ type: "state", id: "invalid", index: 0, total: 1, data: '{"cards":"bad"}' }));
    expect(onState).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining("unsupported board state"));
  });

  it("transfers an empty attachment", async () => {
    const { packets, restored } = await transfer(new Blob([], { type: "text/plain" }));
    expect(packets.map((packet) => packet.type)).toEqual(["file-start", "file-part"]);
    expect(packets[0].total).toBe(1);
    expect(packets[1].data).toBe("");
    expect(restored.size).toBe(0);
    expect(restored.type).toBe("text/plain");
  });

  it("receives a sticker image and marks it available on the card", async () => {
    let state = emptyState();
    state.cards.push({ id: "card-1", boardId: "board-1", listId: "list-1", name: "Card", description: "", position: 1, labelIds: [], completed: false, checklists: [], comments: [], attachments: [], stickers: [{ imageId: "file-1", name: "check", status: "missing" }] });
    const { restored } = await transfer(new Blob(["image bytes"], { type: "image/png" }), (id) => { state = markMediaLocal(state, id); });
    expect(await restored.text()).toBe("image bytes");
    expect(state.cards[0].stickers?.[0]).toMatchObject({ status: "local" });
  });

  it("reads a larger file by slices and restores the original bytes", async () => {
    const source = new Blob([new Uint8Array(15_000).map((_, index) => index % 251)], { type: "application/octet-stream" });
    const readWhole = vi.spyOn(source, "arrayBuffer").mockImplementation(() => { throw new Error("whole file read"); });
    const { packets, restored } = await transfer(source);
    expect(readWhole).not.toHaveBeenCalled();
    expect(packets.map((packet) => packet.type)).toEqual(["file-start", "file-part", "file-part", "file-part"]);
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array(await source.slice().arrayBuffer()));
  });

  it("requests media needed to restore an earlier card version", async () => {
    vi.mocked(loadAttachment).mockResolvedValue(undefined);
    const packets: Packet[] = [];
    const receiver = session();
    (receiver as unknown as { channel: RTCDataChannel }).channel = { readyState: "open", bufferedAmount: 0, send: (data: string) => packets.push(JSON.parse(data)) } as unknown as RTCDataChannel;
    const state = emptyState();
    state.revisions.push({ id: "revision-card", entityKind: "card", entityId: "card-1", createdAt: "2026-01-01", deviceId: "device-1", snapshot: { id: "card-1", boardId: "board-1", listId: "list-1", name: "Old", description: "", position: 1, labelIds: [], completed: false, checklists: [], comments: [], stickers: [{ imageId: "sticker-1", name: "icon.png" }], attachments: [{ id: "attachment-1", name: "note.txt", mimeType: "text/plain", size: 5, status: "local" }] } });
    await receiver.requestFiles(state);
    expect(packets).toEqual([{ type: "request-files", ids: ["attachment-1", "sticker-1"] }]);
  });

  it("reports a stalled connection attempt instead of waiting forever", async () => {
    vi.stubGlobal("RTCPeerConnection", class {
      createDataChannel() { return { readyState: "connecting" }; }
      createOffer() { return new Promise(() => {}); }
      close() {}
    });
    vi.useFakeTimers();
    try {
      const pending = session().createOffer();
      const outcome = expect(pending).rejects.toThrow("20 seconds");
      await vi.advanceTimersByTimeAsync(20_000);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("trusted devices", () => {
  beforeEach(() => vi.stubGlobal("RTCPeerConnection", class { close() {} }));
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

  function trusted(onPeer: () => Promise<boolean>, known: string[] = []) {
    const packets: Array<Record<string, unknown>> = [];
    const onState = vi.fn(async () => {});
    const sync = new LanSync({ getState: emptyState, onState, onFile: () => {}, onStatus: () => {}, trust: { self: { deviceId: "me", name: "Laptop" }, isTrusted: (peer) => known.includes(peer.deviceId), onPeer } });
    (sync as unknown as { channel: RTCDataChannel }).channel = { readyState: "open", bufferedAmount: 0, send: (data: string) => packets.push(JSON.parse(data)), close() {} } as unknown as RTCDataChannel;
    const receive = (packet: Record<string, unknown>) => (sync as unknown as { receive: (packet: Record<string, unknown>) => Promise<void> }).receive(packet);
    return { sync, packets, onState, receive };
  }
  const statePacket = { type: "state", id: "s", index: 0, total: 1, data: JSON.stringify(emptyState()) };

  it("drops data and sends nothing until the peer is trusted", async () => {
    const { sync, packets, onState, receive } = trusted(async () => false);
    await receive(statePacket);
    await sync.syncIfConnected();
    expect(onState).not.toHaveBeenCalled();
    expect(packets).toEqual([]);
    await receive({ type: "hello", deviceId: "phone", name: "Phone" });
    expect(packets).toEqual([]);
  });

  it("exchanges state after the user confirms a new device, and skips the prompt for known ones", async () => {
    const onPeer = vi.fn(async () => true);
    const first = trusted(onPeer);
    await first.receive({ type: "hello", deviceId: "phone", name: "Phone" });
    expect(onPeer).toHaveBeenCalledWith({ deviceId: "phone", name: "Phone" });
    expect(first.packets.map((packet) => packet.type)).toEqual(["state", "request-state"]);
    await first.receive(statePacket);
    expect(first.onState).toHaveBeenCalledOnce();
    const known = trusted(onPeer, ["phone"]);
    await known.receive({ type: "hello", deviceId: "phone", name: "Phone" });
    expect(onPeer).toHaveBeenCalledOnce();
  });
});
