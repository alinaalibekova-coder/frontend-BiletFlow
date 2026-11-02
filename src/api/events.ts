import { api, apiBlob } from "./client";
import type {
  CreateEventRequest,
  CreateTicketTypeRequest,
  CreateVenueRequest,
  Event,
  OrganizerProfile,
  Page,
  TicketType,
  UpdateEventRequest,
  Venue,
} from "./types";

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

export const createVenue = (venue: CreateVenueRequest) =>
  api<Venue>("/api/venues", { method: "POST", body: venue });

export const uploadEventPoster = (eventId: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<Event>(`/api/events/${eventId}/poster`, { method: "POST", body: form });
};

export const deleteEventPoster = (eventId: number) =>
  api<void>(`/api/events/${eventId}/poster`, { method: "DELETE" });

export const getEventPoster = (posterUrl: string) => apiBlob(posterUrl);

export const createTicketType = (eventId: number, ticketType: CreateTicketTypeRequest) =>
  api<TicketType>(`/api/events/${eventId}/ticket-types`, { method: "POST", body: ticketType });

export const createEvent = (event: CreateEventRequest) =>
  api<Event>("/api/events", { method: "POST", body: event });

export const updateEvent = (eventId: number, event: UpdateEventRequest) =>
  api<Event>(`/api/events/${eventId}`, { method: "PUT", body: event });

export type EventManagementAction = "publish" | "unpublish" | "cancel";

export const manageEvent = (eventId: number, action: EventManagementAction) =>
  api<Event>(`/api/events/${eventId}/${action}`, { method: "POST" });
