/** A green bar of how much of something is done, with its percentage (or `caption`) before it. */
export function ProgressBar({
  done,
  total,
  label,
  caption,
}: {
  done: number;
  total: number;
  /** What the bar measures, for screen readers. */
  label: string;
  caption?: string;
}) {
  const percent = total ? Math.round((100 * done) / total) : 0;
  return (
    <div className="flex items-center gap-[9px] text-[12px]">
      {caption ?? `${percent}%`}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line"
      >
        <span className="block h-full bg-[#4bce97]" style={{ width: `${total ? (100 * done) / total : 0}%` }} />
      </div>
    </div>
  );
}
