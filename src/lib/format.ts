// Helpers for showing dates and prices the way the Figma design shows them.
// Kazakhstan uses one time zone (UTC+5, Asia/Almaty since March 2024). parseDate reads backend
// times as +05:00, so the formatters use the fixed-offset zone too: "Etc/GMT-5" is UTC+5 in every
// browser, whereas a browser with tzdata older than 2024 would still show Asia/Almaty as UTC+6.
const TZ = "Etc/GMT-5";
const KAZAKH_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
const KAZAKH_WEEKDAYS = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"];
function kazakhDate(iso: string, includeYear: boolean) {
  // Some embedded browsers ship without Kazakh ICU data and return "M11".
  const key = dayKey(parseDate(iso));
  const [year, month, day] = key.split("-").map(Number);
  return `${day} ${KAZAKH_MONTHS[month - 1]}${includeYear ? ` ${year}` : ""}`;
}

// If the backend sends a date without a time zone ("2026-09-11T20:00:00"),
// treat it as Kazakhstan time.
export function parseDate(iso: string): Date {
  // Daily sales use LocalDate (YYYY-MM-DD), unlike event LocalDateTime.
  // A timezone suffix is valid only after a time component.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00+05:00`);
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso);
  return new Date(hasZone ? iso : `${iso}+05:00`);
}

// Milliseconds for a form value ("2026-12-10T18:00") or a backend LocalDateTime,
// read as Kazakhstan time whatever time zone the browser is in.
export function almatyTimestamp(value: string): number {
  return parseDate(value).getTime();
}

// "11 сентября 2026"
export function formatLongDate(iso: string, locale = "ru-RU"): string {
  if (locale.startsWith("kk")) return kazakhDate(iso, true);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: TZ })
    .format(parseDate(iso))
    .replace(/\s?г\.?$/, "");
}

// "15 ноября"
export function formatShortDate(iso: string, locale = "ru-RU"): string {
  if (locale.startsWith("kk")) return kazakhDate(iso, false);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: TZ }).format(parseDate(iso));
}

// "20:00"
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(parseDate(iso));
}

export function formatDateTime(iso: string, locale = "ru-RU"): string {
  return `${formatLongDate(iso, locale)}, ${formatTime(iso)}`;
}

// "2026-10-24" — used to compare days in the date strip
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(date);
}

// When an event leaves the catalog: its end, or for events without an end time, the end
// of its start day in Kazakhstan, so an evening concert stays listed while it is on.
export function eventVisibleUntil(event: { startTime: string; endTime?: string | null }): number {
  if (event.endTime) return parseDate(event.endTime).getTime();
  return parseDate(`${dayKey(parseDate(event.startTime))}T23:59:59.999`).getTime();
}

// Whether an event takes place on a day ("2026-10-24"): every day from its start to its end counts.
export function eventCoversDay(event: { startTime: string; endTime?: string | null }, day: string): boolean {
  const first = dayKey(parseDate(event.startTime));
  const last = event.endTime ? dayKey(parseDate(event.endTime)) : first;
  return first <= day && day <= (last < first ? first : last);
}

// "Пн"
export function weekdayShort(date: Date, locale = "ru-RU"): string {
  if (locale.startsWith("kk")) return KAZAKH_WEEKDAYS[new Date(`${dayKey(date)}T12:00:00+05:00`).getUTCDay()];
  const w = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: TZ }).format(date);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// "14 000 ₸"
export function formatPrice(kzt: number, locale = "ru-RU"): string {
  return `${new Intl.NumberFormat(locale.startsWith("kk") ? "ru-RU" : locale, { maximumFractionDigits: 2 }).format(kzt)} ₸`;
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
  technology: "Технологии",
  social: "Встречи",
  party: "Вечеринки", parties: "Вечеринки",
  other: "Другое",
};

const LOCALIZED_CATEGORIES: Record<string, { kk: string; en: string }> = {
  "Концерты": { kk: "Концерттер", en: "Concerts" }, "Театры": { kk: "Театрлар", en: "Theatre" }, "Кино": { kk: "Кино", en: "Cinema" },
  "Юмор": { kk: "Әзіл", en: "Comedy" }, "Музеи и Выставки": { kk: "Мұражайлар мен көрмелер", en: "Museums and exhibitions" },
  "Детям": { kk: "Балаларға", en: "For children" }, "Спорт": { kk: "Спорт", en: "Sport" }, "Досуг": { kk: "Демалыс", en: "Leisure" },
  "Шоу": { kk: "Шоу", en: "Shows" }, "Образование": { kk: "Білім", en: "Education" }, "Музыка": { kk: "Музыка", en: "Music" }, "Фестивали": { kk: "Фестивальдер", en: "Festivals" },
  "Технологии": { kk: "Технологиялар", en: "Technology" }, "Встречи": { kk: "Кездесулер", en: "Meetups" }, "Вечеринки": { kk: "Кештер", en: "Parties" }, "Другое": { kk: "Басқа", en: "Other" },
};
const CATEGORY_ALIASES: Record<string, string> = { "концерт": "Концерты", "театр": "Театры", "музей": "Музеи и Выставки", "выставка": "Музеи и Выставки", "фестиваль": "Фестивали" };
// A stable comparison key for legacy codes and translated labels. Stored event values stay intact.
export function categoryKey(category: string): string {
  const key = category.trim().toLowerCase().replace(/\s+/g, " ");
  const label = CATEGORY_LABELS[key] ?? CATEGORY_ALIASES[key];
  if (label) return label.toLowerCase();
  for (const [source, variants] of Object.entries(LOCALIZED_CATEGORIES)) {
    if ([source, variants.en, variants.kk].some(value => value.toLowerCase() === key)) return source.toLowerCase();
  }
  return key;
}
export function categoryLabel(category: string, locale = "ru-RU"): string {
  const key = category.trim().toLowerCase();
  const known = CATEGORY_LABELS[key] ?? CATEGORY_ALIASES[key] ?? Object.keys(LOCALIZED_CATEGORIES).find(label => label.toLowerCase() === categoryKey(category));
  if (known) return locale.startsWith("kk") ? LOCALIZED_CATEGORIES[known]?.kk ?? known : locale.startsWith("en") ? LOCALIZED_CATEGORIES[known]?.en ?? known : known;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// Agreed category list for the event form. The English code is what gets saved;
// categoryLabel shows it in Russian, Kazakh or English.
export const EVENT_CATEGORIES = [
  "Music", "Concert", "Festival", "Theatre", "Cinema", "Comedy", "Exhibition",
  "Kids", "Sport", "Education", "Technology", "Social", "Party", "Other",
] as const;

// Options for the category dropdown. When editing, the saved value is kept exactly:
// a list entry with a different letter case is replaced by it, and a value that is
// not in the list is added as an extra option marked legacy.
export function eventCategoryOptions(current?: string | null): { value: string; legacy: boolean }[] {
  const options = EVENT_CATEGORIES.map(value => ({ value: value as string, legacy: false }));
  if (!current) return options;
  const index = options.findIndex(option => option.value.toLowerCase() === current.trim().toLowerCase());
  if (index >= 0) options[index] = { value: current, legacy: false };
  else options.push({ value: current, legacy: true });
  return options;
}

// "04:59" for a reservation countdown; whole minutes may exceed 59 ("75:00").
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Screen readers hear the countdown only when it crosses these points, not every second.
export type HoldMilestone = "expired" | "1min" | "5min" | null;
export function holdMilestone(ms: number): HoldMilestone {
  if (ms <= 0) return "expired";
  if (ms <= 60_000) return "1min";
  if (ms <= 300_000) return "5min";
  return null;
}
