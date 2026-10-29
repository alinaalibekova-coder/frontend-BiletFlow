import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { minPrice, useTicketTypes } from "../../hooks/useEvents";
import { categoryLabel, formatPrice, formatShortDate } from "../../lib/format";

// One card in the "Популярные события" grid.
export function EventCard({ event }: { event: Event }) {
  // The event has no price field yet, so each card asks for its ticket types.
  // When the backend adds `minPrice` to events, delete these two lines.
  const { data: types } = useTicketTypes(event.id);
  const price = minPrice(types);

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-md"
    >
      {/* Poster placeholder: the backend has no images yet */}
      <div className="aspect-[4/3] bg-surface" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-semibold uppercase text-muted">{categoryLabel(event.category)}</p>
        <h3 className="mt-0.5 font-semibold leading-snug group-hover:underline">{event.title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {formatShortDate(event.startTime)}
          {event.venue?.name && ` • ${event.venue.name}`}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-sm font-semibold">
            {price === null ? "" : price === 0 ? "Бесплатно" : `от ${formatPrice(price)}`}
          </span>
          <span className="rounded-md bg-surface px-3 py-1 text-xs font-semibold">Билеты</span>
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
