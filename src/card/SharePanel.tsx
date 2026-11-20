import { type RefObject, useState } from "react";
import type { AppState, Card } from "../model";
import { cardLink, downloadCardJson, downloadCardPng, printCard, qrSvg } from "../share";

/** Print, save or copy a link to the card. `dialog` is the element saved as an image. */
export function SharePanel({
  open,
  card,
  state,
  dialog,
}: {
  open: boolean;
  card: Card;
  state: AppState;
  dialog: RefObject<HTMLDivElement | null>;
}) {
  const [shareStatus, setShareStatus] = useState("");
  const [showQr, setShowQr] = useState(false);
  async function share(action: "print" | "png" | "json" | "link") {
    setShareStatus("");
    try {
      if (action === "print") printCard();
      else if (action === "png") {
        if (dialog.current && (await downloadCardPng(dialog.current, card))) setShareStatus("Image saved.");
      } else if (action === "json") {
        if (await downloadCardJson(state, card)) setShareStatus("JSON saved.");
      } else {
        await navigator.clipboard.writeText(cardLink(card.id));
        setShareStatus("Link copied.");
      }
    } catch (cause) {
      setShareStatus(`Something went wrong: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  if (!open) return null;
  return (
    <section className="transfer-picker share-panel" aria-label="Share card" data-share-skip>
      <strong>Share</strong>
      <div className="share-actions">
        <button onClick={() => void share("print")}>Print</button>
        <button onClick={() => void share("png")}>PNG</button>
        <button onClick={() => void share("json")}>JSON</button>
        <button onClick={() => void share("link")}>Copy link</button>
        <button onClick={() => setShowQr(!showQr)} aria-pressed={showQr}>
          QR code
        </button>
      </div>
      {showQr && (
        <figure className="share-qr">
          <span
            role="img"
            aria-label="QR code for the card link"
            dangerouslySetInnerHTML={{ __html: qrSvg(cardLink(card.id)) }}
          />
          <figcaption>{cardLink(card.id)}</figcaption>
        </figure>
      )}
      {shareStatus && <p role="status">{shareStatus}</p>}
    </section>
  );
}
