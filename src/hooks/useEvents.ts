import { useQuery } from "@tanstack/react-query";
import { getEvent, getEvents, getTicketTypes } from "../api/events";
import { parseDate } from "../lib/format";
import type { Event, TicketType } from "../api/types";

// Only events attendees should see: published and public.
// (If the backend leaves these fields out, the event is shown.)
const isVisible = (e: Event) =>
  (e.status ?? "PUBLISHED") === "PUBLISHED" && (e.visibilityStatus ?? "PUBLIC") === "PUBLIC";

const byStartTime = (a: Event, b: Event) =>
  parseDate(a.startTime).getTime() - parseDate(b.startTime).getTime();

// All visible events, sorted by date. TanStack Query caches the result,
// so the home page and the category menu share one request.
export function usePublicEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
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

export function useTicketTypes(eventId: number) {
  return useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: () => getTicketTypes(eventId),
    enabled: Number.isFinite(eventId),
  });
}

// Cheapest ticket that is on sale, or null if there are none.
export function minPrice(types: TicketType[] | undefined): number | null {
  const prices = (types ?? []).filter((t) => !t.hidden).map((t) => t.price);
  return prices.length ? Math.min(...prices) : null;
}
