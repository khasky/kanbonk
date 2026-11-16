# Sync

Kanbonk has no central server. Every device keeps a complete copy of the data, and two devices sync by exchanging their whole state and the files the other side is missing. Merging is based on revision history, so syncing in any order, any number of times, converges to the same result.

## Transports

Pick one in **⋯ → Sync → Sync method**.

| Transport | When to use | How it connects | What sees the traffic |
|---|---|---|---|
| Tabs | Several tabs or windows of the same browser profile | `BroadcastChannel("listva-state")`, automatic | Nothing leaves the browser |
| **Wi-Fi / LAN** | Devices on the same network, including the desktop app and a browser on one computer | Both devices join a room on the LAN relay (`server.mjs`) | The relay forwards ciphertext only |
| **Internet (P2P)** | Two devices on different networks | WebRTC data channel; an invitation and a reply are exchanged manually (messenger, email) | Public STUN servers learn IP addresses; data is DTLS-encrypted and goes directly between peers |
| **File (Bluetooth, USB, messenger)** | No network between the devices | An encrypted `.kanbonk-sync` file sent by any means | Whoever holds the file sees only ciphertext |

### Wi-Fi / LAN relay

1. On a computer run `npm run build` and `npm run serve:lan -- <local-ip> 4174` (or `node server.mjs 0.0.0.0 4174` to listen on all interfaces).
2. Open `http://<local-ip>:4174` on every device, or point the desktop or mobile app at that server address in the sync dialog.
3. On the first device press **Create code**, then **Connect with code**. Enter the same server address and code on the second device.

The relay ([`server.mjs`](../server.mjs)) serves the app and upgrades `/sync?room=<64 hex>` to a WebSocket. A room holds at most two members; messages from one are forwarded to the other, and the relay announces `peer-ready` and `peer-left`. It keeps nothing on disk. The client refuses relay addresses outside private network ranges (`localhost`, `10/8`, `172.16/12`, `192.168/16`, link-local, `.local`, IPv6 ULA).

For the desktop app and a browser on the same computer, run the relay on `127.0.0.1` and use `http://127.0.0.1:4173` (the default of `npm run serve:lan`).

### Internet P2P

One device presses **Create invitation** and sends the text to the other device. The other device pastes it, presses **Accept invitation** and sends back the reply, which the first device pastes into **Connect with response**. The invitation and reply are WebRTC session descriptions with ICE candidates gathered through public STUN (`stun.l.google.com:19302`, `stun.cloudflare.com:3478`).

There is no TURN relay, by design: Kanbonk runs no servers. Peers behind symmetric NATs on both sides may fail to connect; use the file transport in that case.

### File bundles

**Send package** (for a trusted device) or **Send package with code** creates `kanbonk-sync-YYYY-MM-DD.kanbonk-sync`:

```
"LISTVA-SYNC-1" | 24-byte nonce | XChaCha20-Poly1305( key, ZIP{ state.json, sender.json, files/<id>, types/<id> } )
key = SHA-256("listva-key:" + pairing code)
```

On phones the browser opens the share sheet (Bluetooth, Nearby Share, messengers). In the Android app, which has no Web Share API, the file is saved through the system save dialog and then shared from the Files app. The receiver opens the file with **Open received package**; Kanbonk tries the codes of all trusted devices plus the code typed in the dialog. A bundle created on the same device is rejected.

## Offline queue

Changes are written to IndexedDB and shown immediately (optimistic UI); a sync session only carries them to the other device. The app counts revisions created on this device since the last state it sent and shows the count in the top-bar badge. A session reports `onSent` after each state it sends and `onClosed` when the socket or channel drops. On `onClosed`, and on the browser's `online` event, the app reconnects to the same relay and room with backoff (5 s, doubling up to 60 s); the trust handshake is skipped for already trusted devices, and the queued revisions merge on the other side like any other change.

## Trusted devices

The first time two devices connect, each sends `hello` with its device ID and name. The receiving side asks the user whether to trust the peer; until the user agrees, all incoming data packets are dropped. Trusted devices are stored in `localStorage` (`listva-trusted-devices`) with the pairing code, which becomes the pair's shared secret for later connections and file bundles. Trusted devices can be removed in the sync dialog.

Trusted devices are also the team: a card's **Members** list offers trusted devices and members imported from Trello. The MCP agent ([mcp.md](mcp.md)) is a trusted device too.

## Wire protocol

Over the relay, every packet is sealed:

```json
{ "nonce": "<base64, 24 bytes>", "data": "<base64 XChaCha20-Poly1305 ciphertext of the JSON packet>" }
```

```
room = hex(SHA-256("listva-room:" + code))   // what the relay sees
key  = SHA-256("listva-key:"  + code)        // never leaves the devices
code = 128 random bits as 32 hex characters
```

Over WebRTC the JSON packets go through the DTLS data channel as is.

| Packet | Purpose |
|---|---|
| `hello` | Device ID and name for the trust check |
| `request-state` | Ask the peer to send its state |
| `state` | The state as JSON, split into numbered chunks |
| `request-files` | IDs of files the receiver is missing after a merge |
| `file-start`, `file-part` | A file transfer: total size and MIME type, then numbered base64 chunks |

Senders wait while more than 256 KiB is buffered, and the relay limits a message to 128 KiB. Received states are checked with `validState` before merging, and transfers with inconsistent chunk counts are rejected.

## Merge and conflicts

[`mergeStates(local, remote)`](../src/sync.ts) works per entity (workspace, board, list, card, label):

1. Revisions, activity and tombstones from both sides are unioned. Purged items (tombstones) are removed on both sides.
2. An entity that exists only on one side is added.
3. For an entity on both sides, the heads are compared using the revision ancestry graph:
   - same content: the heads are joined with a deterministic merge revision so both devices end with the same head ID;
   - the remote head descends from the local head: take the remote version (fast-forward);
   - the local head descends from the remote head: keep the local version;
   - otherwise the versions **diverged**: the local version is kept for now and a `SyncConflict` is reported.
4. Revision history is trimmed to the 30 newest revisions per entity, never dropping heads or revisions involved in a conflict.

For each conflict the sync dialog shows **My version** and **Other device's version**. `chooseConflict` records a new revision with the chosen snapshot whose parents are both heads, so the next sync fast-forwards the other device to the same result.

Conflicts are detected per entity, not per field: renaming a card on one device and changing its due date on another is a conflict that the user resolves by picking one version.

## Security model

Protected against:

- the relay or anyone on the network reading or altering sync data: packets are authenticated-encrypted, and the room ID is a hash that does not reveal the key;
- an unknown device injecting data: data from untrusted peers is dropped until the user approves the device;
- a file bundle being read in transit: it is encrypted with the pair's code.

Not protected against:

- **a malicious page served over plain HTTP.** The LAN relay serves the app over HTTP, so an attacker on the same network could modify the app before encryption starts. Use the relay only on trusted networks, or use the desktop/mobile app or the extension, which ship their own copy of the app.
- someone who learns the pairing code (for example by reading it over your shoulder) and joins the room before you;
- an attacker with access to the device: data at rest in IndexedDB is not encrypted.
- traffic analysis: STUN servers and the relay see IP addresses, timing and message sizes.

Bluetooth is supported only through file bundles: browsers cannot act as a Bluetooth peripheral, so a direct Bluetooth link would need a native plugin.
