import { dayKey, weekdayShort } from "../../lib/format";
import { useLanguage } from "../../i18n/LanguageContext";

interface Props {
  selected: string | null; // "2026-10-24" or null for all dates
  onSelect: (day: string | null) => void;
}

const DAYS = 14;

// Row of dates under the banner: Сегодня 24, Пт 25, Сб 26 …
export function DateStrip({ selected, onSelect }: Props) {
  const { t, locale } = useLanguage();
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), date: d };
  });

  const pick = (key: string) => onSelect(selected === key ? null : key);

  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-xl bg-surface p-2" role="group" aria-label={t("dateSelection")}>
      {days.map(({ key, date }, i) => {
        const isSelected = selected === key;
        const isWeekend = [0, 6].includes(new Date(`${key}T12:00:00+05:00`).getUTCDay());
        return (
          <button
            key={key}
            type="button"
            onClick={() => pick(key)}
            aria-pressed={isSelected}
            className={`flex min-w-12 flex-col items-center rounded-lg px-2 py-1 ${
              isSelected ? "bg-brand text-white" : "bg-white hover:bg-gray-100"
            }`}
          >
            {/* Weekend weekday in orange-700: 5.2:1 on the white button. */}
            <span className={`text-xs ${!isSelected && isWeekend ? "font-semibold text-orange-700" : ""}`}>
              {i === 0 ? t("today") : weekdayShort(date, locale)}
            </span>
            <span className="text-base font-bold">{key.slice(8).replace(/^0/, "")}</span>
          </button>
        );
      })}
      <label className="ml-auto flex shrink-0 cursor-pointer items-center rounded-lg bg-white px-3 py-2 text-xs hover:bg-gray-100">
        {t("chooseDate")}
        <input
          type="date"
          className="sr-only"
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        />
      </label>
    </div>
  );
}
