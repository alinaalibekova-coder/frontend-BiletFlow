import { api } from "./client";
import type { CreateEventRequest, Event, OrganizerProfile, Page, TicketType, Venue } from "./types";

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

export const getOrganizerProfile = () => api<OrganizerProfile>("/api/organizers/profile");

export const getOrganizerEvents = (organizerId: number, page = 0, size = 100) =>
  api<Page<Event>>(`/api/events/organizer/${organizerId}?page=${page}&size=${size}`);

export const getVenues = (page = 0, size = 100) =>
  api<Page<Venue>>(`/api/venues?page=${page}&size=${size}`);

export const createEvent = (event: CreateEventRequest) =>
  api<Event>("/api/events", { method: "POST", body: event });

export type EventManagementAction = "publish" | "unpublish" | "cancel";

export const manageEvent = (eventId: number, action: EventManagementAction) =>
  api<Event>(`/api/events/${eventId}/${action}`, { method: "POST" });
