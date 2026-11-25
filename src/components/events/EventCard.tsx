import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { minPrice, useTicketTypes } from "../../hooks/useEvents";
import { categoryLabel, formatPrice, formatShortDate } from "../../lib/format";
import { EventPoster } from "./EventPoster";
import { useLanguage } from "../../i18n/LanguageContext";
import { cityLabel, venueCity } from "../../lib/cities";

// One card in the "Популярные события" grid.
export function EventCard({ event }: { event: Event }) {
  const { t, tx, locale, language } = useLanguage();
  const city = venueCity(event.venue);
  // The backend's minPrice is the cheapest visible ticket type. A number needs no request.
  // null is ambiguous (no ticket types at all, or every type hidden), and older APIs omit it,
  // so only those cards load their ticket types to say the same as the event page.
  const serverPrice = typeof event.minPrice === "number";
  const { data: types } = useTicketTypes(event.id, !serverPrice);
  const price = serverPrice ? event.minPrice ?? null : minPrice(types, event.paidSalesActive);
  const ticketsNotRequired = !serverPrice && event.status === "PUBLISHED" && types !== undefined && types.length === 0;
  const visibleTypes = (types ?? []).filter(type => !type.hidden);
  const soldOut = visibleTypes.length > 0 && visibleTypes.every(type => type.available <= 0);
  const priceText = ticketsNotRequired
    ? t("noTicketsRequired")
    : price !== null
      ? price === 0 ? t("free") : t("fromPrice", { price: formatPrice(price, locale) })
      : types === undefined ? "" : soldOut ? tx("Билеты закончились") : tx("Билеты пока недоступны");

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-md"
    >
      <EventPoster posterUrl={event.posterUrl} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-semibold uppercase text-muted">{categoryLabel(event.category, locale)}</p>
        <h3 className="mt-0.5 font-semibold leading-snug group-hover:underline">{event.title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {formatShortDate(event.startTime, locale)}
          {event.venue?.name && ` • ${event.venue.name}`}
        </p>
        <p className="mt-1 text-xs text-muted">{city ? cityLabel(city, language) : t("unknownCity")}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-sm font-semibold">{priceText}</span>
          {!ticketsNotRequired && (
            <span className="rounded-md bg-surface px-3 py-1 text-xs font-semibold">{t("tickets")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border" aria-hidden="true">
      <div className="aspect-[4/3] bg-surface" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-16 rounded bg-surface" />
        <div className="h-4 w-3/4 rounded bg-surface" />
        <div className="h-3 w-1/2 rounded bg-surface" />
      </div>
    </div>
  );
}
