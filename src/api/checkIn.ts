import { api } from "./client";
import type { CheckInResult, CheckInStats, Event, EventStaff, Page, Ticket } from "./types";

export const getAssignedEvents = (page = 0, size = 100) =>
  api<Page<Event>>(`/api/check-in/events?page=${page}&size=${size}`);

export const getEventAttendees = (eventId: number, query = "", page = 0, size = 20) => {
  const search = query ? `&q=${encodeURIComponent(query)}` : "";
  return api<Page<Ticket>>(`/api/check-in/events/${eventId}/attendees?page=${page}&size=${size}${search}`);
};

export const scanEventTicket = (eventId: number, code: string) =>
  api<CheckInResult>(`/api/check-in/events/${eventId}/scan`, { method: "POST", body: { code } });

export const undoEventCheckIn = (eventId: number, ticketId: number) =>
  api<CheckInResult>(`/api/check-in/events/${eventId}/tickets/${ticketId}/undo`, { method: "POST" });

export const getEventCheckInStats = (eventId: number) =>
  api<CheckInStats>(`/api/check-in/events/${eventId}/stats`);

export const getEventStaff = (eventId: number) =>
  api<EventStaff[]>(`/api/events/${eventId}/staff`);

export const assignEventStaff = (eventId: number, email: string) =>
  api<EventStaff>(`/api/events/${eventId}/staff`, { method: "POST", body: { email } });

export const removeEventStaff = (eventId: number, userId: number) =>
  api<void>(`/api/events/${eventId}/staff/${userId}`, { method: "DELETE" });
