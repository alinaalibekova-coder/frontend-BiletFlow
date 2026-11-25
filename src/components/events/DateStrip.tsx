import type { KeyboardEvent, MouseEvent } from "react";
import { dayKey, formatShortDate, parseDateFilter, weekdayShort, weekendRange } from "../../lib/format";
import { useLanguage } from "../../i18n/LanguageContext";
import { Icon } from "../ui/Icons";

interface Props {
  // "2026-10-24", a range "2026-10-24_2026-10-25", or null for all dates
  selected: string | null;
  onSelect: (value: string | null) => void;
}

const DAYS = 14;

// A date input only opens its calendar from its own icon, never from a click on the label around it.
// showPicker() opens it from anywhere; browsers without it fall back to focusing the field.
function openDatePicker(input: HTMLInputElement) {
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}

// Quick chips (today, tomorrow, weekend), then the next 14 days, then a free date picker.
export function DateStrip({ selected, onSelect }: Props) {
  const { t, tx, locale } = useLanguage();
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), date: d };
  });
  const weekend = weekendRange(today);
  const range = parseDateFilter(selected);
  // A single day picked in the calendar that is not one of the chips: show it on the button.
  const customDate = range && range.from === range.to && !days.some((d) => d.key === range.from) ? range.from : null;
  const pick = (value: string) => onSelect(selected === value ? null : value);
  const quick: [string, string][] = [[days[0].key, t("today")], [days[1].key, tx("Завтра")], [weekend, tx("Выходные")]];

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-gray-200 bg-white p-3 shadow-soft">
      <div role="group" aria-label={tx("Быстрый выбор даты")} className="flex flex-wrap items-center gap-2">
        {quick.map(([value, label]) => {
          const isSelected = selected === value;
          return (
            <button key={label} type="button" onClick={() => pick(value)} aria-pressed={isSelected}
              className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${isSelected ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-primary hover:bg-primary-soft hover:text-primary-dark"}`}>
              {isSelected && <Icon name="check" className="h-4 w-4" />}{label}
            </button>
          );
        })}
        {/* The real <input type="date"> covers the whole pill (transparent), so a tap opens the native
            calendar on phones, and a click or Enter/Space opens it on desktop. */}
        <label className={`relative ml-auto flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${customDate ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-primary hover:bg-primary-soft"}`}>
          <Icon name="calendar" className="h-4 w-4" />
          {customDate ? formatShortDate(customDate, locale) : t("chooseDate")}
          <input
            type="date"
            aria-label={t("chooseDate")}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            min={days[0].key}
            value={range && range.from === range.to ? range.from : ""}
            onChange={(e) => onSelect(e.target.value || null)}
            onClick={(e: MouseEvent<HTMLInputElement>) => openDatePicker(e.currentTarget)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDatePicker(e.currentTarget);
              }
            }}
          />
        </label>
      </div>
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto" role="group" aria-label={t("dateSelection")}>
        {days.map(({ key, date }, i) => {
          const isSelected = selected === key;
          // Part of a selected range (the weekend chip): outlined, not filled.
          const inRange = !isSelected && !!range && range.from !== range.to && key >= range.from && key <= range.to;
          const isWeekend = [0, 6].includes(new Date(`${key}T12:00:00+05:00`).getUTCDay());
          return (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={isSelected}
              className={`flex min-w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 ${
                isSelected ? "border-primary bg-primary text-white shadow-soft" : inRange ? "border-primary bg-primary-soft text-primary-dark" : "border-transparent bg-surface hover:border-primary hover:bg-primary-soft"
              }`}
            >
              {/* Weekend weekday in orange-800: 6.3:1 or better on the grey, lavender and white chips. */}
              <span className={`text-xs ${!isSelected && isWeekend ? "font-semibold text-orange-800" : ""}`}>
                {i === 0 ? t("today") : weekdayShort(date, locale)}
              </span>
              <span className="text-base font-bold">{key.slice(8).replace(/^0/, "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
