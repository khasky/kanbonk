import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "./Button";
import { Input } from "./Field";
import { Dialog, submitWith } from "./Modal";

interface ConfirmOptions {
  title: string;
  message?: string;
  /** The text of the confirming button; "OK" by default. */
  confirm?: string;
  /** A destructive action: the confirming button is red. */
  danger?: boolean;
}

interface TextOptions {
  title: string;
  label: string;
  placeholder?: string;
  confirm?: string;
}

type Ask = { id: number } & (
  | ({ kind: "confirm"; resolve: (answer: boolean) => void } & ConfirmOptions)
  | ({ kind: "text"; resolve: (answer: string | undefined) => void } & TextOptions)
);

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// Questions wait in line: each one shows after the one before it is answered.
let queue: Ask[] = [];
let lastId = 0;
const listeners = new Set<() => void>();

function push(ask: DistributiveOmit<Ask, "id">) {
  queue = [...queue, { ...ask, id: ++lastId } as Ask];
  for (const listener of listeners) listener();
}

function answer() {
  queue = queue.slice(1);
  for (const listener of listeners) listener();
}

/** The app's replacement for `confirm()`: resolves true when the user confirms, false when they cancel. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => push({ kind: "confirm", ...options, resolve }));
}

/** The app's replacement for `prompt()`: resolves the entered text, or undefined when the user cancels. */
export function askText(options: TextOptions): Promise<string | undefined> {
  return new Promise((resolve) => push({ kind: "text", ...options, resolve }));
}

function TextAsk({ ask, onCancel }: { ask: Extract<Ask, { kind: "text" }>; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <Dialog
      label={ask.title}
      onDismiss={onCancel}
      onSubmit={submitWith(() => {
        answer();
        ask.resolve(text);
      })}
    >
      <h2 className="mx-0 mt-0 mb-4 text-[20px]">{ask.title}</h2>
      <label className="flex flex-col gap-[7px] font-semibold">
        {ask.label}
        <Input value={text} onChange={(event) => setText(event.target.value)} placeholder={ask.placeholder} autoFocus />
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={!text.trim()}>
          {ask.confirm ?? "OK"}
        </Button>
      </div>
    </Dialog>
  );
}

/** Shows the questions of `askConfirm` and `askText`; rendered once, above everything else in the app. */
export function AskDialogHost() {
  const ask = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => queue[0],
  );

  useEffect(() => {
    if (!ask) return;
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || !ask) return;
      // Captured first, so a card or dialog under the question stays open.
      event.stopPropagation();
      cancel(ask);
    }
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [ask]);

  if (!ask) return null;
  if (ask.kind === "text") return <TextAsk key={ask.id} ask={ask} onCancel={() => cancel(ask)} />;
  return (
    <Dialog label={ask.title} role="alertdialog" onDismiss={() => cancel(ask)}>
      <h2 className="mx-0 mt-0 mb-3 text-[20px] wrap-anywhere">{ask.title}</h2>
      {ask.message && <p className="m-0 leading-normal text-ink-subtle">{ask.message}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" size="lg" type="button" onClick={() => cancel(ask)}>
          Cancel
        </Button>
        <Button
          variant={ask.danger ? "primary-danger" : "primary"}
          type="button"
          autoFocus
          onClick={() => {
            answer();
            ask.resolve(true);
          }}
        >
          {ask.confirm ?? "OK"}
        </Button>
      </div>
    </Dialog>
  );
}

function cancel(ask: Ask) {
  answer();
  if (ask.kind === "confirm") ask.resolve(false);
  else ask.resolve(undefined);
}
