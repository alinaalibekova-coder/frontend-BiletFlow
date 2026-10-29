import { useSearchParams } from "react-router-dom";
import { usePublicEvents } from "../hooks/useEvents";
import { EventCard, EventCardSkeleton } from "../components/events/EventCard";
import { HeroBanner } from "../components/events/HeroBanner";
import { DateStrip } from "../components/events/DateStrip";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { categoryLabel, dayKey, parseDate } from "../lib/format";

// Home page = the "event search" wireframe.
// Filters live in the URL (?q=…&category=…&date=…) so links can be shared
// and the browser's back button works.
export default function HomePage() {
  const { data: events, isLoading, error, refetch } = usePublicEvents();
  const [params, setParams] = useSearchParams();

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const category = params.get("category");
  const date = params.get("date");
  const hasFilters = !!(q || category || date);

  const setDate = (day: string | null) => {
    const next = new URLSearchParams(params);
    if (day) next.set("date", day);
    else next.delete("date");
    setParams(next);
  };

  // Hide events that already ended
  const now = Date.now();
  const upcoming = (events ?? []).filter((e) => parseDate(e.endTime ?? e.startTime).getTime() >= now);

  // Filtering happens here in the browser until the backend supports it
  const shown = upcoming.filter(
    (e) =>
      (!q || e.title.toLowerCase().includes(q) || (e.venue?.name ?? "").toLowerCase().includes(q)) &&
      (!category || e.category === category) &&
      (!date || dayKey(parseDate(e.startTime)) === date),
  );

  const heading = q
    ? `Результаты поиска «${params.get("q")}»`
    : category
      ? categoryLabel(category)
      : "Популярные события";

  return (
    <>
      {!hasFilters && upcoming[0] && <HeroBanner event={upcoming[0]} />}
      <DateStrip selected={date} onSelect={setDate} />

      <h2 className="mb-4 mt-8 text-xl font-bold">{heading}</h2>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && <ErrorMessage error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && shown.length === 0 && (
        <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted">
          {hasFilters ? "Ничего не найдено. Попробуйте другую дату или запрос." : "Пока нет опубликованных событий."}
        </p>
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </>
  );
}
