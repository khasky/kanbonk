import { type RefObject, useState } from "react";
import type { AppState, Card } from "../model";
import { Button } from "../ui/Button";
import { pickerBoxClass } from "./cardLook";
import { cardLink, downloadCardJson, downloadCardPng, printCard, qrSvg } from "./share";

/** Print, save or copy a link to the card. `dialog` is the element saved as an image. */
export function SharePanel({
  card,
  state,
  dialog,
}: {
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
  return (
    <section className={pickerBoxClass} aria-label="Share card" data-share-skip>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" onClick={() => void share("print")}>
          Print
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void share("png")}>
          PNG
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void share("json")}>
          JSON
        </Button>
        <Button variant="secondary" size="lg" onClick={() => void share("link")}>
          Copy link
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="col-span-2"
          onClick={() => setShowQr(!showQr)}
          aria-pressed={showQr}
        >
          QR code
        </Button>
      </div>
      {showQr && (
        <figure className="mx-0 mt-2 mb-0 flex flex-col items-center gap-1.5">
          <span
            className="block h-[180px] w-[180px] bg-white [&_svg]:h-full [&_svg]:w-full"
            role="img"
            aria-label="QR code for the card link"
            dangerouslySetInnerHTML={{ __html: qrSvg(cardLink(card.id)) }}
          />
          <figcaption className="text-center text-[12px] break-all">{cardLink(card.id)}</figcaption>
        </figure>
      )}
      {shareStatus && (
        <p className="m-0" role="status">
          {shareStatus}
        </p>
      )}
    </section>
  );
}
