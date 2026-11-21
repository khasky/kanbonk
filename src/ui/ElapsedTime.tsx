import { useEffect, useState } from "react";
import { Hint } from "./Hint";

/** Running time of a long operation, ticking every second until `end` is set. */
export function ElapsedTime({ start, end, tone }: { start: number; end?: number; tone?: "muted" | "subtle" }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (end) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [end]);
  const seconds = Math.max(0, Math.round(((end ?? now) - start) / 1000));
  return (
    <Hint role="timer" tone={tone}>
      {end ? "Took" : "Elapsed"}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </Hint>
  );
}
