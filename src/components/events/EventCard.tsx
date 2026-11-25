import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { isBuyableNow, minPrice, useTicketTypes } from "../../hooks/useEvents";
import { categoryLabel, dateBadge, formatPrice, formatShortDate, formatTime } from "../../lib/format";
import { EventPoster } from "./EventPoster";
import { useLanguage } from "../../i18n/LanguageContext";
import { cityLabel, venueCity } from "../../lib/cities";
import { Icon } from "../ui/Icons";

// At or below this many tickets left, the card shows a "few left" chip.
const LOW_STOCK = 10;

// One card in the catalog grid: poster first, then the facts and the price.
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
  // Only from ticket types this card already loaded: no extra request per card. Cards with a
  // numeric server minPrice load none, so they cannot show "few left" or "sold out": the public
  // EventResponse has no stock field (ticketsRemaining exists only on the organizer sales API).
  // Backend field needed on EventResponse: `ticketsRemaining` (sum of `available` over visible ticket
  // types currently on sale, or null when unknown) and/or `soldOut` (boolean).
  const left = visibleTypes.filter(type => isBuyableNow(type, event.paidSalesActive)).reduce((sum, type) => sum + type.available, 0);
  const fewLeft = left > 0 && left <= LOW_STOCK;
  const priceText = ticketsNotRequired
    ? t("noTicketsRequired")
    : price !== null
      ? price === 0 ? t("free") : t("fromPrice", { price: formatPrice(price, locale) })
      : types === undefined ? "" : soldOut ? tx("Билеты закончились") : tx("Билеты пока недоступны");
  const badge = dateBadge(event.startTime, locale);

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-gray-200 bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lifted motion-reduce:hover:translate-y-0"
    >
      <div className="relative">
        <EventPoster posterUrl={event.posterUrl} category={event.category} alt="" className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100" />
        <span className="absolute left-3 top-3 flex min-w-12 flex-col items-center rounded-xl bg-white px-2 py-1 leading-tight text-ink shadow-soft">
          <span className="text-lg font-extrabold">{badge.day}</span>
          <span className="text-xs font-semibold uppercase text-primary-dark">{badge.month}</span>
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{categoryLabel(event.category, locale)}</span>
        {fewLeft && <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-warn px-2.5 py-1 text-xs font-bold text-ink">
          <Icon name="alert" className="h-3.5 w-3.5" />{tx("Осталось {0}", [left])}
        </span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold leading-snug text-ink group-hover:text-primary-dark">{event.title}</h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="clock" className="h-4 w-4" />
          <span>{formatShortDate(event.startTime, locale)}, {formatTime(event.startTime)}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Icon name="pin" className="h-4 w-4" />
          <span className="truncate">{[event.venue?.name, city ? cityLabel(city, language) : t("unknownCity")].filter(Boolean).join(" · ")}</span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className={`text-sm font-bold ${priceText ? "rounded-full bg-primary-soft px-3 py-1 text-primary-dark" : ""}`}>{priceText}</span>
          {!ticketsNotRequired && <span aria-hidden="true" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white group-hover:bg-primary-dark">{tx("Купить")}</span>}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-gray-200 bg-white" aria-hidden="true">
      <div className="shimmer aspect-[4/3]" />
      <div className="space-y-2 p-4">
        <div className="shimmer h-4 w-3/4 rounded" />
        <div className="shimmer h-3 w-1/2 rounded" />
        <div className="shimmer h-3 w-2/3 rounded" />
        <div className="flex justify-between pt-3"><div className="shimmer h-6 w-20 rounded-full" /><div className="shimmer h-7 w-16 rounded-lg" /></div>
      </div>
    </div>
  );
}
