import { sha256 } from "@noble/hashes/sha2.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { mediaReferences, type AppState } from "../model";
import { validState } from "../backup/backup";
import { newRoomCode, type PeerInfo } from "./lanSync";

export interface TrustedDevice extends PeerInfo {
  code: string;
  pairedAt: string;
  lastSyncAt?: string;
}
export type SyncTransport = "wifi" | "internet" | "file";

const devicesKey = "kanbonk-trusted-devices";

export function readTrustedDevices(): TrustedDevice[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(devicesKey) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter(
          (item): item is TrustedDevice =>
            item &&
            typeof item.deviceId === "string" &&
            typeof item.name === "string" &&
            typeof item.code === "string" &&
            /^[a-f0-9]{32}$/.test(item.code),
        )
      : [];
  } catch {
    return [];
  }
}

export function saveTrustedDevices(devices: TrustedDevice[]): void {
  localStorage.setItem(devicesKey, JSON.stringify(devices));
}

/** Adds or refreshes a trusted device; the room code becomes the pair's shared secret for later reconnects and file bundles. */
export function trustDevice(
  devices: TrustedDevice[],
  peer: PeerInfo,
  code: string,
  now = new Date().toISOString(),
): TrustedDevice[] {
  const existing = devices.find((item) => item.deviceId === peer.deviceId);
  const entry: TrustedDevice = {
    ...existing,
    ...peer,
    code: /^[a-f0-9]{32}$/.test(code) ? code : (existing?.code ?? newRoomCode()),
    pairedAt: existing?.pairedAt ?? now,
    lastSyncAt: now,
  };
  return [...devices.filter((item) => item.deviceId !== peer.deviceId), entry];
}

function key(code: string, prefix = "kanbonk"): Uint8Array {
  return sha256(new TextEncoder().encode(`${prefix}-key:${code.trim().toLowerCase()}`));
}

const bundleMagic = "KANBONK-SYNC-1";
// Bundles made before the rename carry this header and use the "listva" key prefix.
const legacyBundleMagic = "LISTVA-SYNC-1";

/** Encrypted sync package (state + local files) for Bluetooth/USB/messenger transfer between trusted devices. */
export async function createSyncBundle(
  state: AppState,
  code: string,
  sender: PeerInfo,
  read: (id: string) => Promise<Blob | undefined>,
): Promise<Blob> {
  if (!/^[a-f0-9]{32}$/.test(code)) throw new Error("A trusted device code is required (32 hexadecimal characters).");
  const entries: Record<string, Uint8Array> = {
    "state.json": strToU8(JSON.stringify(state)),
    "sender.json": strToU8(JSON.stringify(sender)),
  };
  for (const id of mediaReferences(state).fileIds) {
    const blob = await read(id);
    if (blob) entries[`files/${id}`] = new Uint8Array(await blob.arrayBuffer());
    if (blob) entries[`types/${id}`] = strToU8(blob.type);
  }
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const sealed = xchacha20poly1305(key(code), nonce).encrypt(zipSync(entries, { level: 6 }));
  return new Blob([strToU8(bundleMagic), nonce, sealed], { type: "application/octet-stream" });
}

export async function openSyncBundle(
  data: Uint8Array,
  codes: string[],
): Promise<{ state: AppState; sender?: PeerInfo; files: Array<{ id: string; blob: Blob }>; code: string }> {
  const header = [bundleMagic, legacyBundleMagic].find(
    (magic) => data.length >= magic.length + 24 && strFromU8(data.slice(0, magic.length)) === magic,
  );
  if (!header) throw new Error("The file is not a Kanbonk sync bundle.");
  const prefix = header === legacyBundleMagic ? "listva" : "kanbonk";
  const nonce = data.slice(header.length, header.length + 24);
  const sealed = data.slice(header.length + 24);
  for (const code of codes) {
    let plain: Uint8Array;
    try {
      plain = xchacha20poly1305(key(code, prefix), nonce).decrypt(sealed);
    } catch {
      continue;
    }
    const entries = unzipSync(plain);
    const state: unknown = JSON.parse(strFromU8(entries["state.json"]));
    if (!state || typeof state !== "object" || !validState(state as Record<string, unknown>))
      throw new Error("The bundle contains corrupted data.");
    const sender = entries["sender.json"] ? (JSON.parse(strFromU8(entries["sender.json"])) as PeerInfo) : undefined;
    const files = Object.entries(entries).flatMap(([path, bytes]) => {
      const id = path.match(/^files\/([A-Za-z0-9-]+)$/)?.[1];
      return id
        ? [
            {
              id,
              blob: new Blob([new Uint8Array(bytes)], {
                type: entries[`types/${id}`] ? strFromU8(entries[`types/${id}`]) : "",
              }),
            },
          ]
        : [];
    });
    return { state: state as AppState, sender, files, code };
  }
  throw new Error(
    "The bundle is encrypted with a key that is not among your Trusted devices. Enter the sending device's code.",
  );
}

/** Same-device sync between tabs/windows sharing this browser profile's IndexedDB. */
export function tabChannel(onChanged: () => void): { notify: () => void; close: () => void } {
  if (typeof BroadcastChannel !== "function") return { notify: () => {}, close: () => {} };
  const channel = new BroadcastChannel("kanbonk-state");
  const tab = Math.random().toString(36).slice(2);
  channel.onmessage = (event) => {
    if (event.data?.type === "saved" && event.data.tab !== tab) onChanged();
  };
  return { notify: () => channel.postMessage({ type: "saved", tab }), close: () => channel.close() };
}
