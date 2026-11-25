import { useQuery } from "@tanstack/react-query";
import { getAllEvents, getEvent, getTicketTypes } from "../api/events";
import { parseDate } from "../lib/format";
import type { Event, TicketType } from "../api/types";

// Only events attendees should see: published and public.
// (If the backend leaves these fields out, the event is shown.)
const isVisible = (e: Event) =>
  (e.status ?? "PUBLISHED") === "PUBLISHED" &&
  (e.visibilityStatus ?? "PUBLIC") === "PUBLIC" &&
  !e.suspended;

const byStartTime = (a: Event, b: Event) =>
  parseDate(a.startTime).getTime() - parseDate(b.startTime).getTime();

// All visible events, sorted by date. TanStack Query caches the result,
// so the home page and the category menu share one request.
export function usePublicEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => getAllEvents(),
    select: (page) => page.content.filter(isVisible).sort(byStartTime),
  });
}

export function useEvent(id: number) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => getEvent(id),
    enabled: Number.isFinite(id),
  });
}

export function useTicketTypes(eventId: number, enabled = true) {
  return useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: () => getTicketTypes(eventId),
    enabled: enabled && Number.isFinite(eventId),
  });
}

// Whether a ticket type can be put in an order right now: listed, not sold out, inside its own
// sales window, and not a paid type while the event's paid sales are inactive.
export function isBuyableNow(type: TicketType, paidSalesActive?: boolean, now = Date.now()): boolean {
  return !type.hidden && type.available > 0
    && !(type.price > 0 && paidSalesActive === false)
    && !(type.salesStart && parseDate(type.salesStart).getTime() > now)
    && !(type.salesEnd && parseDate(type.salesEnd).getTime() <= now);
}

// Cheapest ticket that is on sale right now, or null if none can be bought.
export function minPrice(types: TicketType[] | undefined, paidSalesActive?: boolean, now = Date.now()): number | null {
  const prices = (types ?? []).filter((t) => isBuyableNow(t, paidSalesActive, now)).map((t) => t.price);
  return prices.length ? Math.min(...prices) : null;
}
