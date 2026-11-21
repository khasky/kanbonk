import { useEffect, useState } from "react";

/** The current time, refreshed every 30 seconds and when the page becomes visible again. */
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { now, refresh: () => setNow(Date.now()) };
}
