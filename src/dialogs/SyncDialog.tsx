import { askConfirm } from "../ui/AskDialog";
import { Dialog } from "../ui/Modal";
import { formatDate, formatDateTime, t } from "../i18n";
import { tNodes } from "../i18n/nodes";
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
    <Dialog
      label={t("dialogs.syncTitle")}
      size="lg"
      className="max-h-[calc(100dvh-96px)] overflow-auto"
      onDismiss={onClose}
    >
      <h2 className={dialogTitleClass}>{t("dialogs.syncTitle")}</h2>
      <label className={fieldLabelClass}>
        {t("dialogs.syncMethod")}
        <Select value={transport} onChange={(event) => sync.setTransport(event.target.value as SyncTransport)}>
          <option value="wifi">{t("dialogs.syncWifi")}</option>
          <option value="internet">{t("dialogs.syncInternet")}</option>
          <option value="file">{t("dialogs.syncFile")}</option>
        </Select>
      </label>
      <Hint tone="subtle">
        {tNodes("dialogs.syncTabsHint", {
          command: <code>pnpm serve:lan</code>,
          url: (
            <Button variant="link" onClick={() => sync.setServerUrl("http://127.0.0.1:4173")}>
              http://127.0.0.1:4173
            </Button>
          ),
        })}
      </Hint>
      {trustedDevices.length > 0 && (
        <section className={dialogListClass}>
          <h3>{t("dialogs.trustedDevices")}</h3>
          {trustedDevices.map((device) => (
            <PanelRow wrap key={device.deviceId}>
              <PanelRowText className="flex flex-col">
                <strong>{device.name}</strong>
                <PanelRowNote>
                  {device.lastSyncAt
                    ? t("dialogs.deviceAddedSynced", {
                        id: device.deviceId.slice(0, 8),
                        date: formatDate(device.pairedAt),
                        time: formatDateTime(device.lastSyncAt),
                      })
                    : t("dialogs.deviceAdded", { id: device.deviceId.slice(0, 8), date: formatDate(device.pairedAt) })}
                </PanelRowNote>
              </PanelRowText>
              <RowActions as="span" className="min-w-0 wrap-anywhere">
                {transport === "wifi" && (
                  <Button variant="secondary" className="flex-none" onClick={() => sync.setRoomCode(device.code)}>
                    {t("dialogs.pairingCode")}
                  </Button>
                )}
                {transport === "file" && (
                  <Button variant="secondary" className="flex-none" onClick={() => void sync.shareBundle(device.code)}>
                    {t("dialogs.sendPackage")}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="flex-none"
                  onClick={async () => {
                    if (
                      await askConfirm({
                        title: t("dialogs.removeDeviceTitle", { name: device.name }),
                        confirm: t("common.remove"),
                        danger: true,
                      })
                    )
                      sync.removeDevice(device);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </RowActions>
            </PanelRow>
          ))}
        </section>
      )}
      {transport === "file" && (
        <section className={localSyncClass.section}>
          <h3 className="m-0">{t("dialogs.syncPackageTitle")}</h3>
          <p className={localSyncClass.text}>{t("dialogs.syncPackageIntro")}</p>
          <label className={fieldLabelClass}>
            {t("dialogs.pairingCodeNewDevice")}
            <Input
              value={sync.bundleCode}
              onChange={(event) => sync.setBundleCode(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <div className={localSyncClass.actions}>
            <Button variant="secondary" size="lg" onClick={() => sync.setBundleCode(newRoomCode())}>
              {t("dialogs.createCode")}
            </Button>
            <Button
              variant="primary"
              disabled={!pairingCode.test(bundleCode)}
              onClick={() => void sync.shareBundle(bundleCode)}
            >
              {t("dialogs.sendPackageWithCode")}
            </Button>
          </div>
          <div className={fieldLabelClass}>
            {t("dialogs.openPackage")}
            <FileButton
              size="lg"
              className="self-start"
              accept=".kanbonk-sync,application/octet-stream"
              onFiles={(files) => void sync.openBundle(files[0] ?? null)}
            >
              {t("dialogs.choosePackage")}
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
            {transport === "internet" ? t("dialogs.internetIntro") : t("dialogs.localIntro")}
          </p>
          <Button variant="primary" className={sideButtonClass} onClick={sync.createOffer}>
            {t("dialogs.createInvitation")}
          </Button>
          <label className={fieldLabelClass}>
            {t("dialogs.invitationField")}
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
            {t("dialogs.acceptInvitation")}
          </Button>
          <label className={fieldLabelClass}>
            {t("dialogs.responseField")}
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
            {t("dialogs.connectWithResponse")}
          </Button>
        </>
      )}
      <Button variant="secondary" size="lg" className={sideButtonClass} onClick={sync.syncNow}>
        {t("dialogs.syncNow")}
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
          localLabel={t("dialogs.myVersion")}
          remoteLabel={t("dialogs.otherVersion")}
          onChoose={(version) => sync.resolveConflict(conflict, version)}
        />
      ))}
      <div className={dialogFooterClass}>
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}
