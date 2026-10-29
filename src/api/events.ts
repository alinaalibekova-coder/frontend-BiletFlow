import { api } from "./client";
import type { Event, Page, TicketType } from "./types";

// GET /api/events — the backend has no filters yet (city, date, category, search),
// so we load one big page and filter in the browser. Replace this when the
// backend adds query parameters.
export const getEvents = (page = 0, size = 100) =>
  api<Page<Event>>(`/api/events?page=${page}&size=${size}`);

// GET /api/events/{id}
export const getEvent = (id: number) => api<Event>(`/api/events/${id}`);

// GET /api/events/{eventId}/ticket-types — prices live here, not on the event
export const getTicketTypes = (eventId: number) =>
  api<TicketType[]>(`/api/events/${eventId}/ticket-types`);
