import { type InputHTMLAttributes, useEffect, useRef } from "react";
import { Checkbox } from "./Field";

/**
 * A `Checkbox` that can also be half-ticked (`mixed`): "select all" when some rows are ticked, or a choice that is
 * on some of the cards and stays as it is on each.
 */
export function MixedCheckbox({
  mixed,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { mixed: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return <Checkbox ref={ref} aria-checked={mixed ? "mixed" : undefined} {...props} />;
}
