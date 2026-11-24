import { useState } from "react";
import { type Card, newId } from "../model";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { pickerBoxClass, pickerLabelClass } from "./cardLook";

/** Attaches a website link to the card. */
export function LinkEditor({
  onChange,
  onClose,
}: {
  onChange: (change: (card: Card) => Card) => void;
  onClose: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkError, setLinkError] = useState("");
  function addUrlAttachment() {
    try {
      const url = new URL(linkUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported URL");
      onChange((item) => ({
        ...item,
        attachments: [
          ...item.attachments,
          {
            id: newId(),
            name: linkName.trim() || url.hostname,
            mimeType: "text/uri-list",
            size: 0,
            sourceUrl: url.href,
            status: "link",
          },
        ],
      }));
      setLinkUrl("");
      setLinkName("");
      setLinkError("");
      onClose();
    } catch {
      setLinkError("Enter a link starting with http:// or https://.");
    }
  }
  return (
    <section className={pickerBoxClass} aria-label="Add link">
      <label className={pickerLabelClass}>
        URL
        <Input
          size="sm"
          className="w-full min-w-0"
          type="url"
          value={linkUrl}
          onChange={(event) => {
            setLinkUrl(event.target.value);
            setLinkError("");
          }}
          placeholder="https://example.com"
        />
      </label>
      <label className={pickerLabelClass}>
        Title
        <Input
          size="sm"
          className="w-full min-w-0"
          value={linkName}
          onChange={(event) => setLinkName(event.target.value)}
          placeholder="Optional"
        />
      </label>
      {linkError && (
        <p className="m-0 text-[#ae2a19]" role="alert">
          {linkError}
        </p>
      )}
      <Button variant="primary" disabled={!linkUrl.trim()} onClick={addUrlAttachment}>
        Add link
      </Button>
    </section>
  );
}
