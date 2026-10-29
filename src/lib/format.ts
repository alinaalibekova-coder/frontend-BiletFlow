// Helpers for showing dates and prices the way the Figma design shows them.
// Kazakhstan uses one time zone, so all times are shown in Asia/Almaty.

const TZ = "Asia/Almaty";

// If the backend sends a date without a time zone ("2026-09-11T20:00:00"),
// treat it as Kazakhstan time.
export function parseDate(iso: string): Date {
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso);
  return new Date(hasZone ? iso : `${iso}+05:00`);
}

// "11 сентября 2026"
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: TZ })
    .format(parseDate(iso))
    .replace(/\s?г\.?$/, "");
}

// "15 ноября"
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: TZ }).format(parseDate(iso));
}

// "20:00"
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(parseDate(iso));
}

// "2026-10-24" — used to compare days in the date strip
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(date);
}

// "Пн"
export function weekdayShort(date: Date): string {
  const w = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: TZ }).format(date);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// "14 000 ₸"
export function formatPrice(kzt: number): string {
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(kzt)} ₸`;
}

// The backend stores category as free text. Known codes get a Russian label,
// anything else is shown as typed.
const CATEGORY_LABELS: Record<string, string> = {
  concert: "Концерты", concerts: "Концерты",
  theatre: "Театры", theater: "Театры",
  cinema: "Кино", movie: "Кино",
  comedy: "Юмор", humor: "Юмор",
  museum: "Музеи и Выставки", exhibition: "Музеи и Выставки",
  kids: "Детям", children: "Детям",
  sport: "Спорт", sports: "Спорт",
  leisure: "Досуг",
  show: "Шоу",
  education: "Образование",
  music: "Музыка",
  festival: "Фестивали",
};

export function categoryLabel(category: string): string {
  const known = CATEGORY_LABELS[category.trim().toLowerCase()];
  if (known) return known;
  return category.charAt(0).toUpperCase() + category.slice(1);
}
