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
      <h3 className="m-0">Via a local server</h3>
      <p className={localSyncClass.text}>
        Open Kanbonk on both devices using the computer's Wi-Fi address. Enter the address of the running Kanbonk server
        and share the room code with the second device. Changes sync automatically; the server only receives encrypted
        data.
      </p>
      <label className={fieldLabelClass}>
        Server address
        <Input
          type="url"
          value={serverUrl}
          onChange={(event) => onServerChange(event.target.value)}
          placeholder="http://192.168.1.178:4174"
        />
      </label>
      <label className={fieldLabelClass}>
        Room code
        <Input
          value={roomCode}
          onChange={(event) => onCodeChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div className={localSyncClass.actions}>
        <Button variant="secondary" size="lg" onClick={() => onCodeChange(newRoomCode())}>
          Create code
        </Button>
        <Button variant="primary" onClick={onConnect} disabled={!serverUrl || !roomCode}>
          Connect with code
        </Button>
      </div>
    </section>
  );
}
