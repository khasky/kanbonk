import { mediaReferences, newId, type AppState } from "../model";
import { loadAttachment, saveAttachment } from "../lib/storage";
import { validState } from "../backup/backup";
import { t } from "../i18n";
import { sha256 } from "@noble/hashes/sha2.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

interface SyncHandlers {
  getState: () => AppState;
  onState: (remote: AppState) => Promise<void>;
  onFile: (id: string) => void;
  onStatus: (message: string) => void;
  /** The connection dropped without `close()` being called (network loss, relay restart); the app may reconnect. */
  onClosed?: () => void;
  /** The whole local state reached the peer. */
  onSent?: () => void;
  /** Attachment storage; defaults to IndexedDB. A headless device (MCP server) passes its own. */
  files?: { load: (id: string) => Promise<Blob | undefined>; save: (id: string, blob: Blob) => Promise<void> };
  /** Where this device is (the board and card open), sent to the trusted peer; see `sendPresence`. */
  getPresence?: () => Presence;
  /** Where the peer is; null when it left or the connection closed. */
  onPresence?: (presence: Presence | null) => void;
  /** Device trust: when set, peers exchange a hello first and data flows only after the peer is trusted. */
  trust?: {
    self: PeerInfo;
    isTrusted: (peer: PeerInfo) => boolean;
    onPeer: (peer: PeerInfo) => Promise<boolean>;
  };
}

/** The board and card a device has open; ids are capped in length, as they come from the peer. */
export interface Presence {
  boardId?: string;
  cardId?: string;
}

export interface PeerInfo {
  deviceId: string;
  name: string;
}

/** Public STUN only reveals network addresses for NAT traversal; the data channel itself stays end-to-end encrypted (DTLS). */
export const internetIceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
];

interface Transfer {
  parts: string[];
  mimeType: string;
  total: number;
  chunks?: Uint8Array[];
  received?: number;
}

async function connectionStep<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(t("sync.connectTimeout"))), 20000);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function bytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function isLocalAddress(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "::1" || host.endsWith(".local") || /^(fc|fd|fe[89ab])[a-f0-9:]*$/.test(host))
    return true;
  const octets = host.split(".").map(Number);
  return (
    octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) &&
    (octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 169 && octets[1] === 254))
  );
}

export function newRoomCode(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export class LanSync {
  private connection?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private socket?: WebSocket;
  private roomKey?: Uint8Array;
  private transfers = new Map<string, Transfer>();
  private outgoing = Promise.resolve();
  private peerTrusted: boolean;
  private closed = false;
  peer?: PeerInfo;

  constructor(
    private handlers: SyncHandlers,
    local?: { url: string; code: string },
    options: { internet?: boolean } = {},
  ) {
    this.peerTrusted = !handlers.trust;
    if (local) {
      const code = local.code.trim().toLowerCase();
      if (!/^[a-f0-9]{32}$/.test(code)) throw new Error(t("sync.roomCodeInvalid"));
      const encoder = new TextEncoder();
      const room = hex(sha256(encoder.encode(`kanbonk-room:${code}`)));
      this.roomKey = sha256(encoder.encode(`kanbonk-key:${code}`));
      const url = new URL(local.url);
      if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error(t("sync.serverAddress"));
      if (!isLocalAddress(url.hostname)) throw new Error(t("sync.serverNotLocal"));
      url.pathname = "/sync";
      url.search = `?room=${room}`;
      this.bindSocket(new WebSocket(url));
      return;
    }
    if (typeof RTCPeerConnection !== "function") throw new Error(t("sync.noWebRtc"));
    const connection = new RTCPeerConnection({ iceServers: options.internet ? internetIceServers : [] });
    this.connection = connection;
    connection.ondatachannel = (event) => this.bindChannel(event.channel);
    connection.onconnectionstatechange = () =>
      handlers.onStatus(t("sync.connectionState", { state: connection.connectionState }));
  }

  private bindChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => {
      this.handlers.onStatus(t("sync.transferring"));
      void this.greet();
    };
    channel.onmessage = (event) => {
      void this.receiveMessage(String(event.data));
    };
    channel.onclose = () => {
      this.handlers.onPresence?.(null);
      this.handlers.onStatus(t("sync.connectionClosed"));
      if (!this.closed) this.handlers.onClosed?.();
    };
  }

  private bindSocket(socket: WebSocket) {
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      opened = true;
      this.handlers.onStatus(t("sync.serverWaiting"));
    };
    socket.onmessage = (event) => {
      void this.receiveMessage(String(event.data));
    };
    socket.onerror = () => this.handlers.onStatus(t("sync.serverConnectFailed"));
    socket.onclose = () => {
      this.handlers.onPresence?.(null);
      this.handlers.onStatus(opened ? t("sync.serverClosed") : t("sync.serverUnavailable"));
      if (!this.closed) this.handlers.onClosed?.();
    };
  }

  private async receiveMessage(message: string) {
    try {
      const envelope = JSON.parse(message);
      if (this.socket && envelope.type === "peer-ready") {
        this.handlers.onStatus(t("sync.transferring"));
        await this.greet();
        return;
      }
      if (this.socket && envelope.type === "peer-left") {
        this.handlers.onPresence?.(null);
        this.handlers.onStatus(t("sync.peerDisconnected"));
        return;
      }
      const packet = this.roomKey
        ? JSON.parse(
            new TextDecoder().decode(
              xchacha20poly1305(this.roomKey, bytes(envelope.nonce)).decrypt(bytes(envelope.data)),
            ),
          )
        : envelope;
      await this.receive(packet);
    } catch (cause) {
      this.handlers.onStatus(t("sync.receiveError", { error: String(cause) }));
    }
  }

  private async waitForIce() {
    if (this.connection!.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t("sync.gatherTimeout"))), 20000);
      const check = () => {
        if (this.connection!.iceGatheringState === "complete") {
          clearTimeout(timeout);
          this.connection!.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      this.connection!.addEventListener("icegatheringstatechange", check);
    });
  }

  async createOffer(): Promise<string> {
    if (!this.connection) throw new Error(t("sync.offerNotNeeded"));
    this.bindChannel(this.connection.createDataChannel("kanbonk"));
    await connectionStep(this.connection.setLocalDescription(await connectionStep(this.connection.createOffer())));
    await this.waitForIce();
    return JSON.stringify(this.connection.localDescription);
  }

  async acceptOffer(offer: string): Promise<string> {
    if (!this.connection) throw new Error(t("sync.offerNotNeeded"));
    await connectionStep(this.connection.setRemoteDescription(JSON.parse(offer) as RTCSessionDescriptionInit));
    await connectionStep(this.connection.setLocalDescription(await connectionStep(this.connection.createAnswer())));
    await this.waitForIce();
    return JSON.stringify(this.connection.localDescription);
  }

  async acceptAnswer(answer: string): Promise<void> {
    if (!this.connection) throw new Error(t("sync.answerNotNeeded"));
    await connectionStep(this.connection.setRemoteDescription(JSON.parse(answer) as RTCSessionDescriptionInit));
  }

  private send(packet: unknown): Promise<boolean> {
    const pending = this.outgoing.then(async () => {
      if (this.socket && this.roomKey) {
        const socket = this.socket;
        if (socket.readyState !== WebSocket.OPEN) throw new Error(t("sync.noConnection"));
        while (socket.bufferedAmount > 256 * 1024) {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (socket.readyState !== WebSocket.OPEN) throw new Error(t("sync.closedDuringTransfer"));
        }
        const nonce = crypto.getRandomValues(new Uint8Array(24));
        const data = xchacha20poly1305(this.roomKey, nonce).encrypt(new TextEncoder().encode(JSON.stringify(packet)));
        socket.send(JSON.stringify({ nonce: base64(nonce), data: base64(data) }));
        return;
      }
      const channel = this.channel;
      if (channel?.readyState !== "open") throw new Error(t("sync.noConnection"));
      while (channel.bufferedAmount > 256 * 1024) {
        await new Promise<void>((resolve, reject) => {
          channel.bufferedAmountLowThreshold = 64 * 1024;
          const clear = () => {
            channel.removeEventListener("bufferedamountlow", onLow);
            channel.removeEventListener("close", onClose);
          };
          const onLow = () => {
            clear();
            resolve();
          };
          const onClose = () => {
            clear();
            reject(new Error(t("sync.closedDuringTransfer")));
          };
          channel.addEventListener("bufferedamountlow", onLow);
          channel.addEventListener("close", onClose);
        });
      }
      channel.send(JSON.stringify(packet));
    });
    this.outgoing = pending.catch((cause) => this.handlers.onStatus(t("sync.transferError", { error: String(cause) })));
    return pending.then(
      () => true,
      () => false,
    );
  }

  private async greet() {
    if (this.handlers.trust) await this.send({ type: "hello", ...this.handlers.trust.self });
    else await this.sendState();
  }

  private async receiveHello(packet: Record<string, unknown>) {
    const trust = this.handlers.trust;
    if (!trust || typeof packet.deviceId !== "string" || typeof packet.name !== "string") return;
    const peer = { deviceId: packet.deviceId.slice(0, 64), name: packet.name.slice(0, 60) };
    this.peer = peer;
    if (!trust.isTrusted(peer) && !(await trust.onPeer(peer))) {
      this.handlers.onStatus(t("sync.peerNotTrusted", { name: peer.name }));
      this.close();
      return;
    }
    this.peerTrusted = true;
    this.handlers.onStatus(t("sync.peerConnected", { name: peer.name }));
    await this.sendPresence();
    await this.sendState();
    await this.send({ type: "request-state" });
  }

  /** Tells a trusted, connected peer where this device is; nothing happens before that. */
  async sendPresence(where?: Presence): Promise<void> {
    const presence = where ?? this.handlers.getPresence?.();
    if (!presence || !this.peerTrusted) return;
    if (this.socket ? this.socket.readyState !== WebSocket.OPEN : this.channel?.readyState !== "open") return;
    await this.send({ type: "presence", ...presence });
  }

  private async sendState() {
    const payload = JSON.stringify(this.handlers.getState());
    const id = newId();
    const size = 8000;
    const total = Math.ceil(payload.length / size);
    for (let index = 0; index < total; index++) {
      if (
        !(await this.send({ type: "state", id, index, total, data: payload.slice(index * size, (index + 1) * size) }))
      )
        return;
    }
    this.handlers.onSent?.();
  }

  syncNow() {
    if (!this.peerTrusted) throw new Error(t("sync.peerUnconfirmed"));
    if (this.socket ? this.socket.readyState !== WebSocket.OPEN : this.channel?.readyState !== "open")
      throw new Error(t("sync.connectFirst"));
    void this.sendState();
    this.handlers.onStatus(t("sync.sending"));
  }

  async syncIfConnected(): Promise<void> {
    if (!this.peerTrusted) return;
    if (this.socket ? this.socket.readyState === WebSocket.OPEN : this.channel?.readyState === "open")
      await this.sendState();
  }

  async requestFiles(state: AppState) {
    const missing: string[] = [];
    const { fileIds, missingIds } = mediaReferences(state);
    for (const id of new Set([...fileIds, ...missingIds])) if (!(await this.loadFile(id))) missing.push(id);
    if (missing.length) this.send({ type: "request-files", ids: missing });
  }

  private async sendFiles(ids: string[]) {
    for (const id of ids) {
      const blob = await this.loadFile(id);
      if (!blob) continue;
      const size = 7000;
      const total = Math.max(1, Math.ceil(blob.size / size));
      if (!(await this.send({ type: "file-start", id, total, mimeType: blob.type }))) return;
      for (let index = 0; index < total; index++) {
        const chunk = new Uint8Array(await blob.slice(index * size, (index + 1) * size).arrayBuffer());
        if (!(await this.send({ type: "file-part", id, index, data: btoa(String.fromCharCode(...chunk)) }))) return;
      }
    }
  }

  private async receive(packet: Record<string, unknown>) {
    if (packet.type === "hello") {
      await this.receiveHello(packet);
      return;
    }
    // Data sent before this device confirmed trust is dropped; it is re-requested after confirmation.
    if (!this.peerTrusted) return;
    if (packet.type === "request-state") {
      await this.sendState();
      return;
    }
    if (packet.type === "presence") {
      const id = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 64) : undefined);
      this.handlers.onPresence?.({ boardId: id(packet.boardId), cardId: id(packet.cardId) });
      return;
    }
    if (packet.type === "state") {
      const id = String(packet.id);
      const total = Number(packet.total);
      const index = Number(packet.index);
      if (
        !Number.isSafeInteger(total) ||
        total < 1 ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= total ||
        typeof packet.data !== "string"
      )
        throw new Error(t("sync.invalidPacket"));
      const transfer = this.transfers.get(id) ?? { parts: [], total, mimeType: "", received: 0 };
      if (transfer.total !== total || transfer.chunks) throw new Error(t("sync.invalidSequence"));
      if (transfer.parts[index] === undefined) transfer.received = (transfer.received ?? 0) + 1;
      transfer.parts[index] = packet.data;
      this.transfers.set(id, transfer);
      if (transfer.received === transfer.total) {
        this.transfers.delete(id);
        const remote: unknown = JSON.parse(transfer.parts.join(""));
        if (
          !remote ||
          typeof remote !== "object" ||
          Array.isArray(remote) ||
          !validState(remote as Record<string, unknown>)
        )
          throw new Error(t("sync.unsupportedState"));
        await this.handlers.onState(remote as AppState);
      }
    } else if (packet.type === "request-files") {
      await this.sendFiles(packet.ids as string[]);
    } else if (packet.type === "file-start") {
      const total = Number(packet.total);
      this.transfers.set(String(packet.id), {
        parts: [],
        total,
        mimeType: String(packet.mimeType),
        chunks: new Array(total),
        received: 0,
      });
    } else if (packet.type === "file-part") {
      const id = String(packet.id);
      const transfer = this.transfers.get(id);
      if (!transfer?.chunks) return;
      const index = Number(packet.index);
      if (!Number.isInteger(index) || index < 0 || index >= transfer.total) return;
      if (!transfer.chunks[index]) transfer.received = (transfer.received ?? 0) + 1;
      transfer.chunks[index] = Uint8Array.from(atob(String(packet.data)), (character) => character.charCodeAt(0));
      if (transfer.received === transfer.total) {
        this.transfers.delete(id);
        await (this.handlers.files?.save ?? saveAttachment)(
          id,
          new Blob(
            transfer.chunks.map((chunk) => new Uint8Array(chunk)),
            { type: transfer.mimeType },
          ),
        );
        this.handlers.onFile(id);
        this.handlers.onStatus(t("sync.fileReceived"));
      }
    }
  }

  private loadFile(id: string): Promise<Blob | undefined> {
    return (this.handlers.files?.load ?? loadAttachment)(id);
  }

  close() {
    this.closed = true;
    this.channel?.close();
    this.socket?.close();
    this.connection?.close();
  }
}
