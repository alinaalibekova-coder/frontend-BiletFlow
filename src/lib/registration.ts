import type { Event } from "../api/types";
import { parseDate } from "./format";

export function registrationState(event: Pick<Event, "startTime" | "registrationOpeningTime" | "registrationClosingTime">, now = Date.now()): "open" | "not-open" | "closed" | "started" {
  if (now >= parseDate(event.startTime).getTime()) return "started";
  if (event.registrationClosingTime && now > parseDate(event.registrationClosingTime).getTime()) return "closed";
  if (event.registrationOpeningTime && now < parseDate(event.registrationOpeningTime).getTime()) return "not-open";
  return "open";
}

// The next moment registrationState can change (opening, closing, or event start), or null when it
// never will again. The event page sets one timer for it instead of re-rendering every second.
export function nextRegistrationBoundary(event: Pick<Event, "startTime" | "registrationOpeningTime" | "registrationClosingTime">, now = Date.now()): number | null {
  const boundaries = [
    event.registrationOpeningTime && parseDate(event.registrationOpeningTime).getTime(),
    // "closed" starts strictly after the closing time.
    event.registrationClosingTime && parseDate(event.registrationClosingTime).getTime() + 1,
    parseDate(event.startTime).getTime(),
  ].filter((time): time is number => typeof time === "number" && Number.isFinite(time) && time > now);
  return boundaries.length ? Math.min(...boundaries) : null;
}
