const sizes = { sm: "size-6", lg: "size-11 text-[22px]" };

/** The green square with a workspace's first letter: `sm` in the sidebar and on tiles, `lg` on the workspace page. */
export function WorkspaceAvatar({ name, size = "sm" }: { name: string; size?: keyof typeof sizes }) {
  return (
    <span
      className={`grid place-items-center rounded-[3px] bg-[linear-gradient(135deg,#216e4e,#6cc3a0)] font-bold text-white ${sizes[size]}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
