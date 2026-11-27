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
  | "grid"
  | "image"
  | "tag"
  | "check-square"
  | "user-plus"
  | "text"
  | "message"
  | "link"
  | "smile"
  | "copy"
  | "share"
  | "pencil"
  | "layers"
  | "sub-cards"
  | "dependency"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up"
  | "external"
  | "chevrons-left"
  | "chevrons-right"
  | "collapse"
  | "expand"
  | "card-template"
  | "check"
  | "eye"
  | "chart"
  | "alert"
  | "mirror"
  | "flag";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    eye: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    alert: <path d="M12 3 2 20h20L12 3ZM12 10v4M12 17h.01" />,
    mirror: <path d="M9 9h11v11H9zM5 15H4V4h11v1" />,
    flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
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
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.8" />
        <path d="m21 15-4.5-4.5L6 21" />
      </>
    ),
    tag: (
      <>
        <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
        <circle cx="8" cy="8" r="1.5" />
      </>
    ),
    "check-square": (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    "user-plus": (
      <>
        <circle cx="10" cy="8" r="4" />
        <path d="M3 21a7 7 0 0 1 12-5M19 15v6M16 18h6" />
      </>
    ),
    text: <path d="M4 6h16M4 12h16M4 18h10" />,
    message: (
      <>
        <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    link: (
      <>
        <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
        <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
      </>
    ),
    smile: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </>
    ),
    pencil: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    "sub-cards": (
      <>
        <rect x="3" y="3" width="8" height="6" rx="1.5" />
        <rect x="13" y="15" width="8" height="6" rx="1.5" />
        <path d="M7 9v6a3 3 0 0 0 3 3h3" />
      </>
    ),
    dependency: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6H14a4 4 0 0 1 4 4v5.5" />
        <path d="m15 13 3 3 3-3" />
      </>
    ),
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-up": <path d="m18 15-6-6-6 6" />,
    external: <path d="M14 4h6v6M10 14 20 4M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
    "chevrons-left": <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />,
    "chevrons-right": <path d="m6 17 5-5-5-5M13 17l5-5-5-5" />,
    check: <path d="m5 12 5 5L20 7" />,
    collapse: <path d="M2 12h7m0 0-3-3m3 3-3 3M22 12h-7m0 0 3-3m-3 3 3 3" />,
    expand: <path d="M3 12h18M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3" />,
    "card-template": (
      <>
        <path d="M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        <path d="M18 2v6M15 5h6" />
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
