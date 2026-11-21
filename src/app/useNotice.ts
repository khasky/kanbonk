import { useEffect, useState } from "react";

/** A short message at the bottom of the screen that hides itself after 8 seconds; it may offer to open a card. */
export function useNotice() {
  const [notice, setNotice] = useState("");
  const [noticeCardId, setNoticeCardId] = useState<string>();
  useEffect(() => {
    if (!notice) {
      setNoticeCardId(undefined);
      return;
    }
    const timer = window.setTimeout(() => setNotice(""), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return { notice, noticeCardId, setNotice, setNoticeCardId };
}
