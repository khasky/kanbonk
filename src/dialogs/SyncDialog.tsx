import { askConfirm } from "../ui/AskDialog";
import { Dialog } from "../ui/Modal";
import type { SyncTransport } from "../sync/devices";
import type { DeviceSync } from "../hooks/useDeviceSync";
import { newRoomCode } from "../sync/lanSync";
import { LocalRoomControls } from "./LocalRoomControls";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/Field";
import { FileButton } from "../ui/FileButton";
import { Hint } from "../ui/Hint";
import { PanelRow, PanelRowNote, PanelRowText, RowActions } from "../ui/PanelRow";
import { ConflictChoice } from "./ConflictChoice";
import {
  dialogFooterClass,
  dialogIntroClass,
  dialogListClass,
  dialogTitleClass,
  fieldLabelClass,
  localSyncClass,
  reportClass,
} from "./dialogLook";

const sideButtonClass = "my-[5px]";

const pairingCode = /^[a-f0-9]{32}$/;

export function SyncDialog({ sync, onClose }: { sync: DeviceSync; onClose: () => void }) {
  const { transport, trustedDevices } = sync;
  const bundleCode = sync.bundleCode.trim().toLowerCase();
  return (
    <Dialog label="Device sync" size="lg" className="max-h-[calc(100dvh-96px)] overflow-auto" onDismiss={onClose}>
      <h2 className={dialogTitleClass}>Device sync</h2>
      <label className={fieldLabelClass}>
        Sync method
        <Select value={transport} onChange={(event) => sync.setTransport(event.target.value as SyncTransport)}>
          <option value="wifi">Wi-Fi / local network</option>
          <option value="internet">Internet: direct P2P connection (WebRTC)</option>
          <option value="file">File: Bluetooth / USB / messenger</option>
        </Select>
      </label>
      <Hint tone="subtle">
        Tabs and windows in this browser sync automatically. For the desktop app and a browser on the same computer, run{" "}
        <code>pnpm serve:lan</code> and connect to{" "}
        <Button variant="link" onClick={() => sync.setServerUrl("http://127.0.0.1:4173")}>
          http://127.0.0.1:4173
        </Button>
        .
      </Hint>
      {trustedDevices.length > 0 && (
        <section className={dialogListClass}>
          <h3>Trusted devices</h3>
          {trustedDevices.map((device) => (
            <PanelRow wrap key={device.deviceId}>
              <PanelRowText className="flex flex-col">
                <strong>{device.name}</strong>
                <PanelRowNote>
                  {device.deviceId.slice(0, 8)} · added {new Date(device.pairedAt).toLocaleDateString("en-US")}
                  {device.lastSyncAt ? ` · synced ${new Date(device.lastSyncAt).toLocaleString("en-US")}` : ""}
                </PanelRowNote>
              </PanelRowText>
              <RowActions as="span" className="min-w-0 wrap-anywhere">
                {transport === "wifi" && (
                  <Button variant="secondary" className="flex-none" onClick={() => sync.setRoomCode(device.code)}>
                    Pairing code
                  </Button>
                )}
                {transport === "file" && (
                  <Button variant="secondary" className="flex-none" onClick={() => void sync.shareBundle(device.code)}>
                    Send package
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="flex-none"
                  onClick={async () => {
                    if (
                      await askConfirm({
                        title: `Remove “${device.name}” from trusted devices?`,
                        confirm: "Remove",
                        danger: true,
                      })
                    )
                      sync.removeDevice(device);
                  }}
                >
                  Delete
                </Button>
              </RowActions>
            </PanelRow>
          ))}
        </section>
      )}
      {transport === "file" && (
        <section className={localSyncClass.section}>
          <h3 className="m-0">Sync package</h3>
          <p className={localSyncClass.text}>
            An encrypted file with your data and attachments. Send it via Bluetooth (the Share menu on your phone), USB
            or a messenger; only a device that knows the pairing code can open it.
          </p>
          <label className={fieldLabelClass}>
            Pairing code (for a new device)
            <Input
              value={sync.bundleCode}
              onChange={(event) => sync.setBundleCode(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className={localSyncClass.actions}>
            <Button variant="secondary" size="lg" onClick={() => sync.setBundleCode(newRoomCode())}>
              Create code
            </Button>
            <Button
              variant="primary"
              disabled={!pairingCode.test(bundleCode)}
              onClick={() => void sync.shareBundle(bundleCode)}
            >
              Send package with code
            </Button>
          </div>
          <div className={fieldLabelClass}>
            Open received package
            <FileButton
              size="lg"
              className="self-start"
              accept=".kanbonk-sync,application/octet-stream"
              onFiles={(files) => void sync.openBundle(files[0] ?? null)}
            >
              Choose package
            </FileButton>
          </div>
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
          <p className={dialogIntroClass}>
            {transport === "internet"
              ? "Direct connection over the internet: devices exchange an invitation and a response through any channel (messenger, email). Data flows directly and is encrypted (DTLS); the public STUN server only sees network addresses, not data. Only someone you sent the invitation to can connect, and only after you confirm trust."
              : "If both browsers support WebRTC, you can connect directly over the local network. Exchange an invitation and a response."}
          </p>
          <Button variant="primary" className={sideButtonClass} onClick={sync.createOffer}>
            Create invitation
          </Button>
          <label className={fieldLabelClass}>
            Invitation: send it to the second device or paste the one you received
            <Textarea
              className="min-h-[70px] w-full"
              value={sync.signal}
              onChange={(event) => sync.setSignal(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            size="lg"
            className={sideButtonClass}
            onClick={sync.acceptOffer}
            disabled={!sync.signal}
          >
            Accept invitation
          </Button>
          <label className={fieldLabelClass}>
            Response: send it to the first device or paste the one you received
            <Textarea
              className="min-h-[70px] w-full"
              value={sync.response}
              onChange={(event) => sync.setResponse(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            size="lg"
            className={sideButtonClass}
            onClick={sync.acceptAnswer}
            disabled={!sync.response}
          >
            Connect with response
          </Button>
        </>
      )}
      <Button variant="secondary" size="lg" className={sideButtonClass} onClick={sync.syncNow}>
        Sync now
      </Button>
      {sync.status && (
        <p className={reportClass} role="status">
          {sync.status}
        </p>
      )}
      {sync.conflicts.map((conflict) => (
        <ConflictChoice
          key={`${conflict.kind}-${conflict.id}`}
          name={conflict.local.name}
          localLabel="My version"
          remoteLabel="Other device's version"
          onChoose={(version) => sync.resolveConflict(conflict, version)}
        />
      ))}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
