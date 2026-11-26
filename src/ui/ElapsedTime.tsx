import { useEffect, useState } from "react";
import { Hint } from "./Hint";
import { t } from "../i18n";

/** A duration as "m:ss". */
export function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Running time of a long operation, ticking every second until `end` is set. */
export function ElapsedTime({ start, end, tone }: { start: number; end?: number; tone?: "muted" | "subtle" }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (end) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [end]);
  return (
    <Hint role="timer" tone={tone}>
      {t(end ? "ui.took" : "ui.elapsed", { time: formatElapsed((end ?? now) - start) })}
    </Hint>
  );
}
