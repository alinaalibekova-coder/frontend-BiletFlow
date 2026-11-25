import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { usePublicEvents } from "../hooks/useEvents";
import { EventCard, EventCardSkeleton } from "../components/events/EventCard";
import { HeroBanner } from "../components/events/HeroBanner";
import { DateStrip } from "../components/events/DateStrip";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { categoryKey, categoryLabel, eventCoversDay, eventVisibleUntil } from "../lib/format";
import { useLanguage } from "../i18n/LanguageContext";
import { cities, venueCity } from "../lib/cities";
import { saveStoredPromo } from "../lib/promo";

// Home page = the "event search" wireframe.
// Filters live in the URL (?q=…&category=…&date=…) so links can be shared
// and the browser's back button works.
// Cards shown at first and added by "Show more". Cards that are not shown
// do not load their prices.
const CARDS_PER_STEP = 24;

export default function HomePage() {
  const { data: events, isLoading, error, refetch } = usePublicEvents();
  const [params, setParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const promo = params.get("promo");
  useEffect(() => { if (promo) saveStoredPromo(promo); }, [promo]);

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const category = params.get("category");
  const date = params.get("date");
  const cityParam = params.get("city");
  const city = cityParam === "unknown" || cities.some(item => item.id === cityParam) ? cityParam : null;
  const hasFilters = !!(q || category || date || city);
  // Start again from the first cards whenever the filters change.
  const filterKey = [q, category, date, city].join("|");
  const [shownCount, setShownCount] = useState({ key: filterKey, count: CARDS_PER_STEP });
  const visibleCount = shownCount.key === filterKey ? shownCount.count : CARDS_PER_STEP;

  const setDate = (day: string | null) => {
    const next = new URLSearchParams(params);
    if (day) next.set("date", day);
    else next.delete("date");
    setParams(next);
  };

  // Hide events that already ended (events without an end time stay until the end of their day)
  const now = Date.now();
  const upcoming = (events ?? []).filter((e) => eventVisibleUntil(e) >= now);

  // Filtering happens here in the browser until the backend supports it
  const shown = upcoming.filter(
    (e) =>
      (!q || e.title.toLowerCase().includes(q) || (e.venue?.name ?? "").toLowerCase().includes(q)) &&
      (!category || categoryKey(e.category) === categoryKey(category)) &&
      (!city || (city === "unknown" ? venueCity(e.venue) === null : venueCity(e.venue) === city)) &&
      (!date || eventCoversDay(e, date)),
  );

  const heading = q
    ? t("searchResults", { query: params.get("q") ?? "" })
    : category
      ? categoryLabel(category, locale)
      : t("popular");

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
          {hasFilters ? t("noResults") : t("noEvents")}
        </p>
      )}
      {hasFilters && <button type="button" onClick={() => { const next = new URLSearchParams(params); for (const key of ["q", "category", "date", "city"]) next.delete(key); setParams(next); }} className="mb-4 mt-3 text-sm underline">{t("resetFilters")}</button>}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.slice(0, visibleCount).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
      {shown.length > visibleCount && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShownCount({ key: filterKey, count: visibleCount + CARDS_PER_STEP })}
            className="rounded-lg border px-5 py-2 text-sm font-semibold hover:bg-surface"
          >
            {t("showMore")}
          </button>
        </div>
      )}
    </>
  );
}
