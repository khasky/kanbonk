import { backdropFill, type Workspace } from "../model";
import { useFillStyle } from "./useFileUrl";

const sizes = { sm: "size-6", lg: "size-11 text-[22px]" };

/**
 * The square with a workspace's first letter in its color, gradient or image (green by default): `sm` in the sidebar
 * and on tiles, `lg` on the workspace page.
 */
export function WorkspaceAvatar({ workspace, size = "sm" }: { workspace: Workspace; size?: keyof typeof sizes }) {
  const style = useFillStyle(backdropFill(workspace), true);
  return (
    <span
      className={`grid place-items-center rounded-[3px] bg-[linear-gradient(135deg,#216e4e,#6cc3a0)] font-bold text-white ${sizes[size]}`}
      style={style}
    >
      {workspace.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
