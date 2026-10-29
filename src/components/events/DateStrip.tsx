import { dayKey, weekdayShort } from "../../lib/format";

interface Props {
  selected: string | null; // "2026-10-24" or null for all dates
  onSelect: (day: string | null) => void;
}

const DAYS = 14;

// Row of dates under the banner: Сегодня 24, Пт 25, Сб 26 …
export function DateStrip({ selected, onSelect }: Props) {
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKey(d), date: d };
  });

  const pick = (key: string) => onSelect(selected === key ? null : key);

  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-xl bg-surface p-2" role="group" aria-label="Выбор даты">
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
            <span className={`text-[10px] ${!isSelected && isWeekend ? "text-orange-500" : ""}`}>
              {i === 0 ? "Сегодня" : weekdayShort(date)}
            </span>
            <span className="text-base font-bold">{key.slice(8).replace(/^0/, "")}</span>
          </button>
        );
      })}
      <label className="ml-auto flex shrink-0 cursor-pointer items-center rounded-lg bg-white px-3 py-2 text-xs hover:bg-gray-100">
        Выбрать дату
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
