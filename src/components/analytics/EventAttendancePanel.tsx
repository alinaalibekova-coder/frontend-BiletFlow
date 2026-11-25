import { useState } from "react";
import { CheckInDonut } from "./Charts";
import { KpiCard } from "../ui/KpiCard";
import { useQuery } from "@tanstack/react-query";
import { getEventAttendance } from "../../api/sales";
import type { ArrivalInterval } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatDateTime, formatShortDate, formatTime } from "../../lib/format";
import { Button } from "../ui/Button";

// Minutes per bar in the arrivals chart; the backend accepts exactly these values
const INTERVALS = [5, 10, 15, 30, 60, 120, 1440];

// Attendance of one event (SRS 4.15): who came, who didn't, and when people arrived.
// All numbers come from the backend's ticket and check-in records.
export function EventAttendancePanel({ eventId }: { eventId: number }) {
  const { tx, locale } = useLanguage();
  const [ticketTypeId, setTicketTypeId] = useState<number | undefined>();
  const [stepMinutes, setStepMinutes] = useState(15);

  // Unfiltered numbers: also the source of the ticket-type list for the filter
  const all = useQuery({
    queryKey: ["event-attendance", eventId, null, stepMinutes],
    queryFn: () => getEventAttendance(eventId, { interval: stepMinutes }),
  });
  const filtered = useQuery({
    queryKey: ["event-attendance", eventId, ticketTypeId, stepMinutes],
    queryFn: () => getEventAttendance(eventId, { ticketTypeId, interval: stepMinutes }),
    enabled: ticketTypeId !== undefined,
  });
  const data = ticketTypeId === undefined ? all.data : filtered.data;
  const error = ticketTypeId === undefined ? all.error : filtered.error;
  const loading = ticketTypeId === undefined ? all.isLoading : filtered.isLoading;

  // Before and during the event, people who haven't checked in may still come
  const finished = data?.phase === "COMPLETED";
  const absentLabel = finished ? tx("Не пришли") : tx("Ещё не пришли");

  return (
    <section className="mt-6 border-t pt-4" aria-labelledby={`attendance-${eventId}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h4 id={`attendance-${eventId}`} className="font-semibold">{tx("Посещаемость")}</h4>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs">
            <span className="block text-muted">{tx("Тип билета")}</span>
            <select
              value={ticketTypeId ?? ""}
              onChange={(e) => setTicketTypeId(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 rounded-lg border px-2 py-1 text-sm"
            >
              <option value="">{tx("Все типы билетов")}</option>
              {(all.data?.ticketTypes ?? []).map((type) => (
                <option key={type.ticketTypeId} value={type.ticketTypeId}>{type.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-muted">{tx("Шаг графика")}</span>
            <select value={stepMinutes} onChange={(e) => setStepMinutes(Number(e.target.value))} className="mt-1 rounded-lg border px-2 py-1 text-sm">
              {INTERVALS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 1440 ? tx("1 день") : minutes >= 60 ? `${minutes / 60} ${tx("ч")}` : `${minutes} ${tx("мин")}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && <p className="mt-3 rounded-xl bg-surface p-4 text-center text-sm">{tx("Загрузка…")}</p>}
      {error && (
        <div className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p>{error instanceof Error ? tx(error.message) : tx("Не удалось загрузить данные.")}</p>
          <Button variant="secondary" className="mt-2" onClick={() => void (ticketTypeId === undefined ? all.refetch() : filtered.refetch())}>{tx("Повторить")}</Button>
        </div>
      )}

      {data && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon="users" label={tx("Владельцы билетов")} value={data.ticketHolders.toLocaleString(locale)} />
            <KpiCard icon="check" label={tx("Прошли check-in")} value={data.checkedIn.toLocaleString(locale)} />
            <KpiCard icon="clock" label={absentLabel} value={data.absent.toLocaleString(locale)} />
            <KpiCard icon="chart" label={tx("Процент check-in")} value={`${data.checkInRate}%`} />
          </div>

          <div className="mt-4 rounded-[var(--radius-card)] border border-gray-200 bg-white p-4">
            <CheckInDonut checkedIn={data.checkedIn} total={data.ticketHolders} rate={Number(data.checkInRate)} absentLabel={absentLabel} />
          </div>

          <p className="mt-2 text-xs text-muted">
            {data.firstArrival ? tx("Первый вход: {0}", [formatDateTime(data.firstArrival, locale)]) : tx("Пока никто не прошёл check-in.")}
            {data.lastArrival ? ` · ${tx("Последний вход: {0}", [formatDateTime(data.lastArrival, locale)])}` : ""}
            {data.undoneCheckIns > 0 ? ` · ${tx("Отменённых check-in: {0}", [data.undoneCheckIns])}` : ""}
          </p>

          {ticketTypeId === undefined && data.ticketTypes.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b text-xs text-muted">
                  <tr>
                    <th className="py-2">{tx("Тип билета")}</th>
                    <th>{tx("Владельцы")}</th>
                    <th>{tx("Прошли")}</th>
                    <th>{absentLabel}</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ticketTypes.map((type) => (
                    <tr key={type.ticketTypeId} className="border-b">
                      <td className="py-2">{type.name}{type.hidden ? ` · ${tx("скрыт")}` : ""}</td>
                      <td>{type.ticketHolders}</td>
                      <td>{type.checkedIn}</td>
                      <td>{type.absent}</td>
                      <td>{type.checkInRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ArrivalsChart arrivals={data.arrivals} dailyBars={data.intervalMinutes === 1440} />
        </>
      )}
    </section>
  );
}


// Arrivals over time as simple bars. The backend only sends intervals with arrivals.
function ArrivalsChart({ arrivals, dailyBars }: { arrivals: ArrivalInterval[]; dailyBars: boolean }) {
  const { tx, locale } = useLanguage();
  if (arrivals.length === 0) return null;
  const max = Math.max(...arrivals.map((a) => a.checkedIn));
  return (
    <div className="mt-4">
      <h5 className="text-sm font-semibold">{tx("Входы по времени")}</h5>
      <ul className="mt-2 space-y-1">
        {arrivals.map((slot) => (
          <li key={slot.from} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs">
            <span className="text-muted">{dailyBars ? formatShortDate(slot.from, locale) : formatTime(slot.from)}</span>
            <span className="h-4 rounded bg-surface" aria-hidden="true">
              <span className="block h-full rounded-r bg-primary" style={{ width: `${(slot.checkedIn / max) * 100}%` }} />
            </span>
            <span>{tx("{0} чел. · всего {1}", [slot.checkedIn, slot.cumulative])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
