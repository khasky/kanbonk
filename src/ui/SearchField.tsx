import type { InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

/**
 * A search box with a magnifier inside its frame, on the dark top bar. The frame is the label, so a click anywhere in
 * it focuses the field. `className` may only add layout to the frame.
 */
export function SearchField({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label
      className={`flex h-8 items-center gap-2 rounded-sm border border-[#6b778c] bg-[#22272b] px-[9px]${className ? ` ${className}` : ""}`}
    >
      <Icon name="search" />
      <input
        className="w-full border-0 bg-transparent text-white outline-none placeholder:text-[#c7d1db] max-phone:min-w-0 max-phone:text-[16px]"
        {...props}
      />
    </label>
  );
}
