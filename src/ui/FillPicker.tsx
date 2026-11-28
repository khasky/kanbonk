import { t } from "../i18n";
import { type Fill, fillColors, fillGradients, gradientCss } from "../model/fill";
import { Button } from "./Button";
import { ColorInput } from "./ColorInput";
import { FileButton } from "./FileButton";
import { Swatch } from "./Swatch";
import { useFileUrl } from "./useFileUrl";

const headingClass = "m-0 text-[12px] font-semibold text-ink-subtle";
const gridClass = "grid grid-cols-6 gap-1.5";

function ImageSwatch({
  id,
  name,
  pressed,
  onClick,
}: {
  id: string;
  name: string;
  pressed: boolean;
  onClick: () => void;
}) {
  const url = useFileUrl(id);
  return (
    <Swatch
      color={url ? `url("${url}") center / cover` : "var(--color-surface-sunken)"}
      label={name}
      pressed={pressed}
      onClick={onClick}
    />
  );
}

/**
 * Picks what fills a board, a workspace or a card: a standard color, a standard gradient, any color from the color
 * picker, or an image — one of `images` or a new one from `onUpload`, which stores it and then calls `onChange`. With
 * `removeLabel` a button clears the fill.
 */
export function FillPicker({
  value,
  onChange,
  onUpload,
  images = [],
  removeLabel,
  onRemove,
}: {
  value: Fill | undefined;
  onChange: (fill: Fill) => void;
  onUpload: (file: File) => void;
  /** Stored images to pick from, e.g. a card's image attachments. */
  images?: Array<{ id: string; name: string }>;
  removeLabel?: string;
  onRemove?: () => void;
}) {
  const plain = !value?.imageId && !value?.gradient;
  const shownImages =
    value?.imageId && !images.some((image) => image.id === value.imageId)
      ? [...images, { id: value.imageId, name: t("ui.fillImage") }]
      : images;
  return (
    <div className="grid gap-3">
      <h5 className={headingClass}>{t("ui.fillColors")}</h5>
      <div className={gridClass}>
        {fillColors.map((color) => (
          <Swatch
            key={color}
            color={color}
            label={t("ui.fillColor", { color })}
            pressed={plain && value?.color?.toLowerCase() === color}
            onClick={() => onChange({ color })}
          />
        ))}
      </div>
      <h5 className={headingClass}>{t("ui.fillGradients")}</h5>
      <div className={gridClass}>
        {Object.entries(fillGradients).map(([gradient, stops], index) => (
          <Swatch
            key={gradient}
            color={gradientCss(stops)}
            label={t("ui.fillGradient", { index: index + 1 })}
            pressed={!value?.imageId && value?.gradient === gradient}
            onClick={() => onChange({ gradient })}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <span className="h-8 w-[50px] overflow-hidden rounded-sm bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
          <ColorInput
            className="h-full w-full cursor-pointer border-0 p-0 opacity-85"
            value={value?.color && /^#[\da-f]{6}$/i.test(value.color) ? value.color : "#579dff"}
            label={t("ui.fillCustom")}
            onCommit={(color) => onChange({ color })}
          />
        </span>
        {t("ui.fillCustom")}
      </label>
      <h5 className={headingClass}>{t("ui.fillImages")}</h5>
      {shownImages.length > 0 && (
        <div className={gridClass}>
          {shownImages.map((image) => (
            <ImageSwatch
              key={image.id}
              id={image.id}
              name={image.name}
              pressed={value?.imageId === image.id}
              onClick={() => onChange({ imageId: image.id })}
            />
          ))}
        </div>
      )}
      <FileButton
        accept="image/*"
        className="justify-self-start"
        onFiles={(files) => {
          if (files[0]) onUpload(files[0]);
        }}
      >
        {t("ui.fillUpload")}
      </FileButton>
      {removeLabel && onRemove && (
        <Button variant="secondary" className="justify-self-start" onClick={onRemove} disabled={!value}>
          {removeLabel}
        </Button>
      )}
    </div>
  );
}
