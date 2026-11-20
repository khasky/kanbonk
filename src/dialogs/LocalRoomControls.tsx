import { newRoomCode } from "../lanSync";

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
    <section className="local-sync">
      <h3>Via a local server</h3>
      <p>
        Open Kanbonk on both devices using the computer's Wi-Fi address. Enter the address of the running Kanbonk server
        and share the room code with the second device. Changes sync automatically; the server only receives encrypted
        data.
      </p>
      <label>
        Server address
        <input
          type="url"
          value={serverUrl}
          onChange={(event) => onServerChange(event.target.value)}
          placeholder="http://192.168.1.178:4174"
        />
      </label>
      <label>
        Room code
        <input
          value={roomCode}
          onChange={(event) => onCodeChange(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div>
        <button onClick={() => onCodeChange(newRoomCode())}>Create code</button>
        <button className="primary-button" onClick={onConnect} disabled={!serverUrl || !roomCode}>
          Connect with code
        </button>
      </div>
    </section>
  );
}
