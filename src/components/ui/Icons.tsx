import type { SVGProps } from "react";
import { categoryKey } from "../../lib/format";

// Small hand-drawn icon set (24×24, stroke = currentColor). Decorative by default:
// pass a `title` only when the icon is the sole label of something.
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, className = "h-5 w-5", ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} focusable="false" {...rest}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const paths = {
  ticket: <><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M14 6v12" strokeDasharray="2 2" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
  users: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.5M17.5 19a5 5 0 0 0-2.5-4.3" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12h17" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  map: <><path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4M12 17h.01" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  wallet: <><rect x="3.5" y="6" width="17" height="13" rx="2.5" /><path d="M16 12.5h2M3.5 9.5h17" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  // categories
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  theatre: <><path d="M4 5h9v6a4.5 4.5 0 0 1-9 0Z" /><path d="M11 9h9v6a4.5 4.5 0 0 1-9 0" /><path d="M7 9h.01M10 9h.01M14.5 13h.01M17 13h.01" /></>,
  film: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M8 4v16M16 4v16M3.5 9h4.5M3.5 15h4.5M16 9h4.5M16 15h4.5" /></>,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
  frame: <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="m4 16 5-5 4 4 2.5-2.5L20 17" /><circle cx="15.5" cy="8.5" r="1.5" /></>,
  balloon: <><path d="M12 3a5.5 5.5 0 0 1 5.5 5.5c0 3.8-3.5 7-5.5 7s-5.5-3.2-5.5-7A5.5 5.5 0 0 1 12 3Z" /><path d="M12 15.5 11 18c0 1.5 2 1.5 2 3" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="m12 7.5 4 3-1.5 4.5h-5L8 10.5Z" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5Z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z" /></>,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...rest }: IconProps & { name: IconName }) {
  return <Svg {...rest}>{paths[name]}</Svg>;
}

// One icon per known category (by its normalized Russian label), "star" for anything else.
const CATEGORY_ICONS: Record<string, IconName> = {
  "концерты": "mic", "музыка": "music", "театры": "theatre", "кино": "film", "юмор": "smile",
  "музеи и выставки": "frame", "детям": "balloon", "спорт": "ball", "образование": "book",
  "технологии": "cpu", "фестивали": "flag", "вечеринки": "sparkle", "встречи": "users",
  "шоу": "star", "досуг": "smile", "другое": "grid",
};
export const categoryIcon = (category: string): IconName => CATEGORY_ICONS[categoryKey(category)] ?? "star";

// The wordmark's ticket with a notch, drawn as one filled shape.
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path className="fill-primary" d="M6 7h20a3 3 0 0 1 3 3v3a3 3 0 0 0 0 6v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3a3 3 0 0 0 0-6v-3a3 3 0 0 1 3-3Z" />
      <path d="M20 9.5v13" stroke="white" strokeWidth="1.6" strokeDasharray="1.6 2" strokeLinecap="round" />
      <path d="m9.5 16 2.5 2.5 4.5-5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
