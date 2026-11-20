import { Modal } from "../ui/Modal";
import type { SyncTransport } from "../devices";
import type { DeviceSync } from "../hooks/useDeviceSync";
import { newRoomCode } from "../lanSync";
import { LocalRoomControls } from "./LocalRoomControls";

const pairingCode = /^[a-f0-9]{32}$/;

export function SyncDialog({ sync, onClose }: { sync: DeviceSync; onClose: () => void }) {
  const { transport, trustedDevices } = sync;
  const bundleCode = sync.bundleCode.trim().toLowerCase();
  return (
    <Modal label="Device sync" className="creation-dialog sync-dialog" onDismiss={onClose}>
      <h2>Device sync</h2>
      <label>
        Sync method
        <select value={transport} onChange={(event) => sync.setTransport(event.target.value as SyncTransport)}>
          <option value="wifi">Wi-Fi / local network</option>
          <option value="internet">Internet: direct P2P connection (WebRTC)</option>
          <option value="file">File: Bluetooth / USB / messenger</option>
        </select>
      </label>
      <p className="hint">
        Tabs and windows in this browser sync automatically. For the desktop app and a browser on the same computer, run{" "}
        <code>pnpm serve:lan</code> and connect to{" "}
        <button className="link-button" onClick={() => sync.setServerUrl("http://127.0.0.1:4173")}>
          http://127.0.0.1:4173
        </button>
        .
      </p>
      {trustedDevices.length > 0 && (
        <section className="trusted-devices">
          <h3>Trusted devices</h3>
          {trustedDevices.map((device) => (
            <div className="panel-row" key={device.deviceId}>
              <span>
                <strong>{device.name}</strong>
                <small>
                  {device.deviceId.slice(0, 8)} · added {new Date(device.pairedAt).toLocaleDateString("en-US")}
                  {device.lastSyncAt ? ` · synced ${new Date(device.lastSyncAt).toLocaleString("en-US")}` : ""}
                </small>
              </span>
              <span className="row-actions">
                {transport === "wifi" && <button onClick={() => sync.setRoomCode(device.code)}>Pairing code</button>}
                {transport === "file" && (
                  <button onClick={() => void sync.shareBundle(device.code)}>Send package</button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Remove “${device.name}” from trusted devices?`)) sync.removeDevice(device);
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
      {transport === "file" && (
        <section className="local-sync">
          <h3>Sync package</h3>
          <p>
            An encrypted file with your data and attachments. Send it via Bluetooth (the Share menu on your phone), USB
            or a messenger; only a device that knows the pairing code can open it.
          </p>
          <label>
            Pairing code (for a new device)
            <input
              value={sync.bundleCode}
              onChange={(event) => sync.setBundleCode(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div>
            <button onClick={() => sync.setBundleCode(newRoomCode())}>Create code</button>
            <button
              className="primary-button"
              disabled={!pairingCode.test(bundleCode)}
              onClick={() => void sync.shareBundle(bundleCode)}
            >
              Send package with code
            </button>
          </div>
          <label>
            Open received package
            <input
              type="file"
              accept=".kanbonk-sync,application/octet-stream"
              onChange={(event) => {
                void sync.openBundle(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
        </section>
      )}
      {transport === "wifi" && (
        <LocalRoomControls
          serverUrl={sync.serverUrl}
          roomCode={sync.roomCode}
          onServerChange={sync.setServerUrl}
          onCodeChange={sync.setRoomCode}
          onConnect={sync.connectLocalRoom}
        />
      )}
      {transport !== "file" && (
        <>
          <p>
            {transport === "internet"
              ? "Direct connection over the internet: devices exchange an invitation and a response through any channel (messenger, email). Data flows directly and is encrypted (DTLS); the public STUN server only sees network addresses, not data. Only someone you sent the invitation to can connect, and only after you confirm trust."
              : "If both browsers support WebRTC, you can connect directly over the local network. Exchange an invitation and a response."}
          </p>
          <button className="primary-button" onClick={sync.createOffer}>
            Create invitation
          </button>
          <label>
            Invitation: send it to the second device or paste the one you received
            <textarea value={sync.signal} onChange={(event) => sync.setSignal(event.target.value)} />
          </label>
          <button onClick={sync.acceptOffer} disabled={!sync.signal}>
            Accept invitation
          </button>
          <label>
            Response: send it to the first device or paste the one you received
            <textarea value={sync.response} onChange={(event) => sync.setResponse(event.target.value)} />
          </label>
          <button onClick={sync.acceptAnswer} disabled={!sync.response}>
            Connect with response
          </button>
        </>
      )}
      <button onClick={sync.syncNow}>Sync now</button>
      {sync.status && (
        <p className="import-report" role="status">
          {sync.status}
        </p>
      )}
      {sync.conflicts.map((conflict) => (
        <div className="sync-conflict" key={`${conflict.kind}-${conflict.id}`}>
          <strong>Conflict: {conflict.local.name}</strong>
          <small>Choose a version of this item.</small>
          <div>
            <button onClick={() => sync.resolveConflict(conflict, "local")}>My version</button>
            <button onClick={() => sync.resolveConflict(conflict, "remote")}>Other device's version</button>
          </div>
        </div>
      ))}
      <div>
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
