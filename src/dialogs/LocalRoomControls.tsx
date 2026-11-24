import { t } from "../i18n";
import { newRoomCode } from "../sync/lanSync";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { fieldLabelClass, localSyncClass } from "./dialogLook";

export function LocalRoomControls({
  serverUrl,
  roomCode,
  onServerChange,
  onCodeChange,
  onConnect,
}: {
  serverUrl: string;
  roomCode: string;
  onServerChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onConnect: () => void;
}) {
  return (
    <section className={localSyncClass.section}>
      <h3 className="m-0">{t("dialogs.localServerTitle")}</h3>
      <p className={localSyncClass.text}>{t("dialogs.localServerIntro")}</p>
      <label className={fieldLabelClass}>
        {t("dialogs.serverAddress")}
        <Input
          type="url"
          value={serverUrl}
          onChange={(event) => onServerChange(event.target.value)}
          placeholder="http://192.168.1.178:4174"
        />
      </label>
      <label className={fieldLabelClass}>
        {t("dialogs.roomCode")}
        <Input
          value={roomCode}
          onChange={(event) => onCodeChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div className={localSyncClass.actions}>
        <Button variant="secondary" size="lg" onClick={() => onCodeChange(newRoomCode())}>
          {t("dialogs.createCode")}
        </Button>
        <Button variant="primary" onClick={onConnect} disabled={!serverUrl || !roomCode}>
          {t("dialogs.connectWithCode")}
        </Button>
      </div>
    </section>
  );
}
