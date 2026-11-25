import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { usePublicEvents } from "../hooks/useEvents";
import { EventCard, EventCardSkeleton } from "../components/events/EventCard";
import { HeroBanner } from "../components/events/HeroBanner";
import { DateStrip } from "../components/events/DateStrip";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { categoryKey, categoryLabel, eventOverlapsDays, eventVisibleUntil, parseDateFilter } from "../lib/format";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
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
  const { t, tx, locale } = useLanguage();
  const promo = params.get("promo");
  useEffect(() => { if (promo) saveStoredPromo(promo); }, [promo]);

  const q = (params.get("q") ?? "").trim().toLowerCase();
  const category = params.get("category");
  const date = params.get("date");
  const dateRange = parseDateFilter(date);
  const cityParam = params.get("city");
  const city = cityParam === "unknown" || cities.some(item => item.id === cityParam) ? cityParam : null;
  const hasFilters = !!(q || category || date || city);
  // Start again from the first cards whenever the filters change.
  const filterKey = [q, category, date, city].join("|");
  const [shownCount, setShownCount] = useState({ key: filterKey, count: CARDS_PER_STEP });
  const visibleCount = shownCount.key === filterKey ? shownCount.count : CARDS_PER_STEP;

  const resetFilters = () => { const next = new URLSearchParams(params); for (const key of ["q", "category", "date", "city"]) next.delete(key); setParams(next); };
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
      (!dateRange || eventOverlapsDays(e, dateRange.from, dateRange.to)),
  );

  const heading = q
    ? t("searchResults", { query: params.get("q") ?? "" })
    : category
      ? categoryLabel(category, locale)
      : t("popular");

  return (
    <>
      {!hasFilters && upcoming.length > 0 && <HeroBanner events={upcoming.slice(0, 3)} />}
      <DateStrip selected={date} onSelect={setDate} />

      {/* The page's only h1, with or without the banner and filters. */}
      <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{heading}</h1>
        {!isLoading && shown.length > 0 && <p className="text-sm text-muted">{tx("Найдено событий: {0}", [shown.length])}</p>}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && <ErrorMessage error={error} onRetry={() => refetch()} />}

      {!isLoading && !error && shown.length === 0 && (
        <EmptyState
          icon={hasFilters ? "search" : "calendar"}
          title={hasFilters ? t("noResults") : t("noEvents")}
          action={hasFilters ? <Button onClick={resetFilters}>{t("resetFilters")}</Button> : undefined}
        />
      )}
      {hasFilters && shown.length > 0 && <button type="button" onClick={resetFilters} className="mb-4 text-sm font-semibold text-primary-dark underline">{t("resetFilters")}</button>}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
            className="rounded-full border border-primary px-6 py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary-soft"
          >
            {t("showMore")}
          </button>
        </div>
      )}
    </>
  );
}
