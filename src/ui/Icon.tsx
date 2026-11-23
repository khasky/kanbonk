export type IconName =
  | "plus"
  | "close"
  | "star"
  | "search"
  | "clip"
  | "clock"
  | "trash"
  | "history"
  | "info"
  | "inbox"
  | "calendar"
  | "grid";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    star: <path d="m12 2 3 6.5 7 1-5 5 .9 7.5L12 18.5 6.1 22l.9-7.5-5-5 7-1L12 2Z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    clip: <path d="m21 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 3 7M3 4v7h7" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    inbox: (
      <>
        <path d="M3 13h5l1.5 3h5l1.5-3h5" />
        <path d="M5.5 5h13l2.5 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2.5-8Z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
