import { ApiError } from "../api/client";

// A Campaign QR on the home page (/?promo=<token>) is kept for the tab under this key
// and offered on the next event page the attendee opens.
export const PROMO_STORAGE_KEY = "bf_promo";

// "url": ?promo= on the event link itself; the attendee asked for it, so a failure is shown.
// "stored": carried over from the home page; a failure is dropped silently and never blocks checkout.
// "typed": entered in the promo field.
export type PromoSource = "url" | "stored" | "typed";
export interface PromoState { value: string; token: boolean; source: PromoSource }
export interface PromoPreviewState<T> { data?: T; error: unknown; isFetching: boolean }

export function readStoredPromo(): string {
  try { return sessionStorage.getItem(PROMO_STORAGE_KEY) ?? ""; } catch { return ""; }
}
export function saveStoredPromo(value: string) {
  try { sessionStorage.setItem(PROMO_STORAGE_KEY, value); } catch { /* Private browsing without storage: the link still works directly. */ }
}
export function clearStoredPromo() {
  try { sessionStorage.removeItem(PROMO_STORAGE_KEY); } catch { /* Nothing stored. */ }
}

// Whether a promo choice lets checkout continue. Only promos the attendee asked for
// (URL or typed) must be valid; a carried-over one is simply not applied until it is.
export function promoAllowsCheckout<T>(promo: PromoState, preview: PromoPreviewState<T>): boolean {
  if (!promo.value || promo.source === "stored") return true;
  return !!preview.data && !preview.error && !preview.isFetching;
}

// The canonical code to quote and order with, once the backend has accepted the promo.
export function appliedPromoCode<T extends { code: string }>(promo: PromoState, preview: PromoPreviewState<T>): string | undefined {
  return promo.value && preview.data && !preview.error ? preview.data.code : undefined;
}

// A carried-over promo the backend rejected (wrong event, expired, used up) is consumed:
// it is removed from the tab so no other event tries it again. Network and server
// errors keep it, since the promo itself may still be valid.
export function shouldDropStoredPromo(promo: PromoState, error: unknown): boolean {
  return promo.source === "stored" && !!promo.value && error instanceof ApiError && error.status >= 400 && error.status < 500;
}
