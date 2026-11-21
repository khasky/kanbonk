import type { ReactNode } from "react";

/**
 * A section heading with its controls on the right; they wrap under it when there is no room. A heading element in
 * it takes `className="min-w-0 mr-auto"` so the controls stay right-aligned.
 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2">{children}</div>;
}
