# BiletFlow — attendee web app

React + TypeScript + Vite + Tailwind CSS. Talks to the team backend at
`https://biletflow.duckdns.org` (Swagger: `/swagger-ui.html`).

## What works now

| Page | Address | Backend endpoints used |
| --- | --- | --- |
| Home: banner, date strip, category menu, search, event grid | `/` | `GET /api/events`, `GET /api/events/{id}/ticket-types` |
| Event page: details, venue, prices, ticket list | `/events/5` | `GET /api/events/{id}`, `GET /api/events/{id}/ticket-types` |
| Checkout: attendee name, promo quote, payment session, Halyk return and payment history | `/events/{id}`, `/orders/{id}`, `/orders/{id}/payment-result` | Orders, `/quote`, `/payment-session`, `/payment-check`, `/payments`; `/pay` only for free or SIMULATED orders |
| Attendee account: own orders, tickets, ticket QR, pending order cancellation | `/account` | `GET`/`POST /api/orders`, `GET /api/tickets`, `GET /api/tickets/{ticketId}/qr`, `POST /api/orders/{orderId}/cancel` |
| Account profile and settings: view account details and role, open role-specific sections, update email/password, or delete account | `/account/settings` | `GET /api/users/me`, organizer profile, `PUT /api/users/me/credentials`, `DELETE /api/users/me` |
| Event staff check-in: assigned events, attendee search, scanning and check-in stats | `/staff` | `/api/check-in/events`, `/api/check-in/events/{eventId}/attendees`, `/scan`, `/stats`, `/{ticketId}/undo` |
| Platform user administration and event moderation | `/admin/users` | `GET /api/users`, `PUT /api/users/{id}`, `PUT /api/users/{id}/role`, `DELETE /api/users/{id}`, `GET /api/events`, event suspend/unsuspend endpoints |
| Platform dashboard: event moderation, staff, per-event sales, organizer verification, paid-sales moderation, escalated support | `/admin/dashboard` | Events/staff, per-event sales/orders, organizer verification requests, `/api/admin/paid-sales-activations`, support cases |
| Login / registration window (email + password) | "Войти" button | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/users/me` |
| Organizer dashboard: events, editable tickets, official sales/order reports, and staff assignment | `/organizer/events` | Organizer profile and event endpoints, `GET`/`POST /api/venues`, event CRUD and lifecycle endpoints, ticket type create/update/hide/unhide endpoints, `/api/organizer/sales/events`, `/api/organizer/events/{eventId}/sales`, `/api/organizer/events/{eventId}/orders`, `/api/events/{eventId}/staff`, poster endpoints |

## Organizer dashboard and backend integration

The organizer dashboard uses the logged-in user from `GET /api/users/me`. The
frontend permits access only when `user.role` is `ORGANIZER` (also accepting
`ROLE_ORGANIZER`). Its role check is for navigation and user experience only:
the backend must validate the bearer token, organizer role, and event ownership
for every protected endpoint.

The dashboard loads `GET /api/organizers/profile` and uses its `userId` (not
the profile's own `id`) to request
`GET /api/events/organizer/{organizerId}?page=0&size=100`. Creation sends the
backend `CreateEventRequest` fields to `POST /api/events`; editing loads the
event with `GET /api/events/{id}` and submits only changed fields to
`PUT /api/events/{id}`. The backend DTO uses Java `LocalDateTime`, so date-time
values are sent without a timezone suffix. A venue must already exist because
`venueId` is required when creating an event. Event management calls
`POST /api/events/{eventId}/publish`, `/unpublish`, or `/cancel`. All requests
use the shared API client, which adds the saved bearer token and reports backend
errors.

The event form first asks for a city, then lists venues in that city. Changing
the city clears the venue selection. Editing preselects the current venue's
city; legacy events without a recognized city retain their current venue.

If the needed venue is missing, the form asks separately for its city, name,
street/building address and capacity, then creates it through
`POST /api/venues` with `name`, `address`, and a positive integer `capacity`,
refresh the venue list, and select the new venue automatically. The form shows
the venue limit, prevents an event capacity above it, and explains that leaving
event capacity empty uses the venue capacity. The backend enforces this limit
on both event creation and updates.
The deployed API still has no city field: the selected city is saved at the
start of `address` (for example `Астана, ул. Абая, 10`). This persists through
backend reads and feeds the same city filter used by the catalog. The explicit
prefix takes priority over city names in a street name. Events continue to
send only `venueId`, so the event city always comes from its selected venue.

After saving an event, the organizer is taken to a ticket setup step. It uses
`POST /api/events/{eventId}/ticket-types`; each ticket type has its own name,
price, quantity, and optional sales window. Multiple ticket types (for example
Standard and VIP) can be added. The backend validates aggregate ticket
quantities against the event capacity. Poster upload and deletion are also
available from ticket setup and event editing.
Existing ticket types can be edited, hidden, and unhidden with the ticket-type
management endpoints. Quantity cannot be reduced below tickets already sold;
the backend remains the source of truth for capacity and order constraints.

When publishing a draft, the dashboard checks whether it has any visible
available ticket types. If not, it asks the organizer to add tickets first or
confirm publishing without tickets.
For a published event with no ticket types, the public event page and event
card display "Билеты не требуются" instead of offering ticket purchase.

The organizer's Sales tab uses the backend's official sales summary, event
sales, and paginated event-order endpoints. It displays paid/pending/cancelled/
expired orders, tickets sold and reserved, backend revenue, ticket-type
breakdowns, daily sales, and searchable/filterable order lists. Organizers can
also assign and remove event staff by email.

The attendee account at `/account` lists the signed-in user's paginated orders
and tickets, shows ticket QR codes, and allows cancellation of pending orders.
The staff check-in page at `/staff` exposes only assigned events and uses the
backend attendee search, scan, undo, and check-in-stat endpoints. Platform
administration at `/admin/users` lists users, supports credential and role
updates, deletion, and event suspension/unsuspension with a reason. Frontend
role guards only affect navigation and UX; authorization must be enforced by
the backend on every protected endpoint.

On the event page, checkout uses `POST /api/orders/quote` for the server's price
and discount before `POST /api/orders` reserves inventory. The optional
`attendeeName` and canonical `promoCode` are sent on creation. Campaign links
`/events/{id}?promo=<token>` resolve through `/promo?token=` (typed codes use
`?code=`); an invalid promo from the event link shows its error. A `/?promo=` token is kept in
`sessionStorage` (`bf_promo`) and tried on each event opened in that tab: an event that rejects it
drops it silently and removes it, so it never blocks checkout; it is also removed after an order
uses it or when the attendee clicks Remove.
Free orders are normally PAID immediately. A legacy pending free order can
still be confirmed through `/pay`.

Paid checkout opens `/payment-session`. Only `provider: SIMULATED` calls
`/pay`; HALYK loads the returned HTTPS `scriptUrl` and calls `halyk.pay(payment)`.
The return page calls `/payment-check` immediately and polls while PENDING.
The URL's success/failure hint never decides whether an order is paid.
Failures remain visible, and users can retry or check the payment manually.
The order page lists `/payments`, with demonstration records labelled clearly.
Card details never pass through this frontend's API client.
A PENDING order shows a live countdown to `expiresAt`; at zero the order is reloaded, payment is
disabled and the expiry message is shown. Screen readers hear it at 5 minutes, 1 minute and expiry.

The account lists attendee names and downloads PDF tickets as authenticated
Blobs. Check-in search supports name, email and code. Monetary amounts retain
up to two fractional digits, including server-calculated promo discounts.

## New account, organizer and administration flows

- `/verify-email?token=...`, `/forgot-password`, `/reset-password?token=...`
  implement the email token flows. Verification requires a deliberate button
  click so opening a link does not consume it during a React remount. The
  profile and shared verification notice support resending email. Forgot and
  resend responses do not reveal whether an email has an account.
- `/notifications` lists paginated notifications and marks one or all read.
  The header polls the backend's `{unread}` counter every 30 seconds.
- `/support`, `/support/new`, `/support/{caseId}` provide case creation,
  filtering, polling and replies. Event, order and ticket pages link to
  prefilled support forms. Organizers can also open PLATFORM cases.
  Requesters have no staff actions; eligible handlers can assign and change
  status, and organizers/admins can escalate. A requester reply reopens a
  resolved case; handlers must change its status before replying.
- `/organizer/events/{eventId}/campaigns` creates campaigns with percent/fixed
  discounts, optional dates, redemption limits and ticket types. It lists
  backend results, enables/disables campaigns and downloads their Campaign QR.
  The campaign QR is explicitly distinguished from an admission QR.
- `/account/settings` supports organizer verification requests and simulated
  payout account registration. Only the IBAN's last four characters are
  returned/stored by the backend; the full input is cleared after saving.
- `/organizer/events/{eventId}/activation` shows the activation checklist,
  simulated fee, explicit terms acceptance and activation. Unactivated or
  suspended paid sales block paid ticket choice while preserving free tickets.
- `/admin/dashboard/verification`, `/admin/dashboard/activations` and
  `/admin/dashboard/support` handle organizer decisions, separate paid-sales
  suspension/resumption and escalated cases. Suspending paid sales uses
  `/activation/suspend`, whereas moderating the entire event uses `/suspend`.
  The admin Sales screen selects an event and calls its sales/orders endpoints;
  it never calls the organizer-only aggregate endpoint. Backend source confirms
  admin staff management is allowed; event/ticket editing remains owner-only.

All authorization must still be enforced by the backend. Signing out clears
private query caches before another account is used. A 401, or a 403 carrying the explicit code ACCOUNT_SUSPENDED, clears
the session and displays the server reason. Ordinary 403 responses preserve the session. Signing in or out in
one tab is followed by the others (a `storage` listener on `bf_token`), which also clear their caches;
a 401 for a token another tab already replaced makes the tab re-read the saved token. Refunds, event history, account suspension,
assigned seat selection and calendar export are integrated. Payouts remain simulated;
the payout screens explicitly indicate that no money moves.

Backend configuration must set `APP_FRONTEND_URL` to this frontend's reachable
base URL for email, Campaign QR and Halyk return links. Halyk credentials,
payment mode, SMTP and activation fee are backend settings; no secrets belong
in the frontend. Production hosting must route SPA paths (including the bank
return and email routes) to `index.html` and proxy `/api` to the backend.

## Verification

The November backend features are integrated:

- Assigned seats: the event ticket picker sends `seatIds` beside standing ticket quantities,
  refreshes availability, and shows seat labels on orders, tickets and check-in results.
  Organizers configure modes, section prices and blocked seats from each event's seating page;
  admins manage venue layouts under `/admin/dashboard/venues`. When creating a venue,
  choosing a layout derives capacity from the map; capacity is required only without a layout.
- Calendar links and authenticated `.ics` downloads are available on events and tickets.
  Signed-in users can report another organizer's event; administrators review reports under
  `/admin/dashboard/reports`, with event suspension as a separate action.
- `/admin/dashboard` opens the monitoring overview. Events, orders, payments, refunds and
  campaigns have paginated searches. Settings control future activation and processing fees
  and provide authenticated CSV downloads. `/admin/users` supports filtered search and suspension.
- `/organizer/payouts` and `/admin/dashboard/payouts` show simulated payout breakdowns;
  admins can hold, release and pay them. Completed events link to their payout details.
- Organizer and admin modules load on demand. Tests render asynchronous route boundaries
  and use mocked APIs without creating live orders, reports, accounts or payments.

Run `npm test` for API contract and React route-rendering regressions, then
`npm run build` for TypeScript and the production build. Tests use mocked
fetch and query data, covering provider routing (Halyk never calls `/pay`),
decline/retry, payment status, PDF/QR binary responses, promo codes, auth,
notifications, support roles and paid-sales moderation. They do not perform a
real bank transaction, send email or write to the live backend.

Events include `posterUrl`; the frontend displays it on event cards and event
pages, and organizers can upload or remove posters using
`POST`/`DELETE /api/events/{eventId}/poster`. Uploads are restricted to JPEG,
PNG, or WebP files up to 5 MB. Published public/unlisted posters load directly;
organizer pages fetch draft/private posters with the saved bearer token and a
blob URL. Assigned seating is configured per event, with venue layouts and section
pricing; attendees choose specific seats, including mixed seated and standing orders.

The backend's update mapper ignores null fields. As a result, clearing optional
end/registration dates or capacity is not currently supported: an empty field
is omitted and its previous value remains. To support clearing these values,
the backend needs an explicit patch/clear contract (for example JSON Merge
Patch or dedicated clear flags); ordinary nulls currently mean "leave unchanged".

Attendees can become organizers from the header, /organizer, or account settings.
POST /api/organizers/profile returns the profile and a replacement token with the
ORGANIZER role. Paid sales still require verification and activation.
The user also needs a venue before creating an event. Keep authorization on the backend;
the frontend role check must never be treated as a security boundary.

Temporary workarounds until the backend adds them:

- **Search, date, city and category filters** run in the browser (`src/pages/HomePage.tsx`). The
  backend catalog now accepts `q`, `category`, `venueId`, `from`/`to` and `priceMin`/`priceMax`, but
  has no city field, so the frontend keeps one client-side filter set. Events without an end time
  stay listed until the end of their start day (Asia/Almaty); a date matches every day an event spans.
- **Price on cards** uses the backend's `EventResponse.minPrice` (cheapest non-hidden ticket type).
  `null` means either no ticket types or only hidden ones, so only those cards load their ticket
  types, to show "No tickets required" or "Tickets not available yet" exactly as the event page does.
  The catalog initially mounts 24 cards and offers Show more.
- **Catalog pagination** follows the initial backend page count without a hidden 50-page cutoff.
  Unexpected empty or repeated page numbers produce a retryable error instead of a false complete result.
  Category grouping and filtering normalize legacy case variants and known translated aliases;
  stored event categories are preserved when editing.
- **City** is a URL filter (`?city=astana`, `?city=almaty`, etc.) inferred from
  recognized city names in venue addresses. Unspecified/unrecognized addresses
  stay visible under All cities and City not specified; the frontend does not
  guess a city. A dedicated backend city field is needed for arbitrary cities.
- **KZ/RU/ENG** apply across the catalog, event details, checkout, orders,
  account settings, authentication, notifications, support, check-in and both
  dashboards, including forms, statuses, dates and prices. Language is stored
  in `bf_language` and can be shared using `?lang=kk|ru|en`. Event titles,
  descriptions, venue details, attendee names and support messages remain as
  authored. API enum values and submitted form data are not translated.
  Shared UI phrases are in `src/lib/language.ts`; the page phrase catalog is
  `src/i18n/messages.json`. Known local errors and parameterized validation
  messages are localized; unknown server messages are preserved verbatim.

## Run it on your computer

Use [Node.js](https://nodejs.org) 22.12 or newer (check with `node -v`). CI and the Docker build use Node 22.

```bash
cd biletflow-web
npm install      # downloads libraries into node_modules (first time only, ~1 min)
npm run dev      # starts the app
```

Open http://localhost:5173. Stop the app with `Ctrl + C`.

Every request to `/api/...` is forwarded to the backend by Vite
(see `vite.config.ts`), so you don't need CORS settings during development.
The development proxy rewrites `Origin` to the backend's own origin on the
server-to-server hop, so using another local port does not trigger the backend's
`Invalid CORS request` rejection. Backend authentication and production CORS
settings remain enforced.

## If the page is empty

- **"Пока нет опубликованных событий"**: the backend has no events with status
  PUBLISHED and visibility PUBLIC. Create one in Swagger: register → create an
  organizer profile → create a venue → create an event → add a ticket type →
  publish the event.
- **"Чтобы увидеть события, войдите в аккаунт"**: the backend only shows events
  to logged-in users. Log in, or ask the backend developer to make
  `GET /api/events` public.
- **"Нет связи с сервером"**: the backend server is off.

Open the browser DevTools (F12) → **Network** tab to see every request and
the backend's answer.

## Where things are

```text
src/
  api/          everything that talks to the backend (only client.ts calls fetch)
  auth/         login state: who is logged in, open/close the login window
  hooks/        data loading for pages (TanStack Query)
  components/
    ui/         Button, TextInput, Modal, ErrorMessage
    layout/     Header, CategoryNav, PageLayout
    events/     EventCard, HeroBanner, DateStrip
    auth/       LoginModal
  pages/        HomePage, EventPage, NotFoundPage
  lib/          date and price formatting
  App.tsx       which page shows for which address
  main.tsx      app start
  index.css     colors from the Figma design
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | run the app for development |
| `npm run build` | check types and build the final version into `dist/` |
| `npm run preview` | open the built version |

## Registration, calendar and sales contracts

- Event ownership is checked against the signed-in user ID, not the organizer profile ID.
  Owner/admin access to drafts is enforced by the backend; preview links never grant access.
- Registration boundaries and event start are interpreted in Asia/Almaty (UTC+5; formatters use the
  fixed zone `Etc/GMT-5` so browsers with pre-2024 tzdata agree with parsing). The event page sets one
  timer for the next boundary (opening, closing or start) and checks again before submitting an order.
- Cancelled-event ICS downloads use the authenticated calendar endpoint unchanged. The backend
  preserves the UID and increments SEQUENCE with STATUS:CANCELLED. A cancelled/refunded ticket
  alone does not imply that its event was cancelled; ticket calendars consult event metadata.
- The live sales API supports from/to (inclusive dates) and ticketTypeId. In the current backend
  implementation these affect salesByDay only. Financial totals, inventory and campaigns remain
  all-time, explicitly labelled in the UI.
- Inventory uses the backend ticketsRemaining and percentSold fields. Remaining capacity is
  capacity minus sold and reserved tickets; section restrictions may further limit sales.
  Aggregate percentages use total sold divided by total known capacity, not an average of percentages.
  Missing capacities or remaining counts are displayed as unknown instead of invented zeros.
- Suspension integration: the backend `ErrorResponse` carries a machine `code` (`exception/ErrorCode.java`);
  a 403 with `code: ACCOUNT_SUSPENDED` signs the user out. The frontend reads top-level `code` or
  `error.code` and does not infer suspension from prose.
- Halyk accepts only the exact test and production payment-api.js URLs from the official
  payment-page documentation: https://epayment.kz/ru/docs/platezhnaya-stranica .
  Other hosts, paths, ports, credentials, query strings and fragments are rejected.


## Docker deployment

Build and start the frontend with Docker Compose:

```powershell
docker compose up --build -d
```

Open http://localhost:8080 . Set FRONTEND_PORT to choose another local port.
The default port binding is loopback-only; expose the service through the team's TLS ingress for production.
BACKEND_ORIGIN defaults to https://biletflow.duckdns.org and must be an origin without a path or trailing slash.
To use a backend on the same Compose network, set it to that service's internal address, for example
http://backend:8080. For a backend running directly on Windows with Docker Desktop, use
http://host.docker.internal:8080. This is a runtime setting and does not require rebuilding the frontend.
The repository's Compose file contains only the frontend service; attach it to the team's existing backend
network or copy this service into their Compose file. No backend or production server is modified by this setup.

The image builds the app with npm ci and npm run build, then serves only dist with the official nginx image.
The nginx template provides SPA fallback, an /api proxy preserving paths, queries, bodies and authorization,
API error passthrough, /health, asset caching, and CSP/security headers. Event poster URLs from API responses
are routed through the same-origin proxy so private posters and internal backend hostnames work.
TLS verification remains enabled for HTTPS upstreams. Configure APP_FRONTEND_URL on the backend to the
public HTTPS frontend origin for email, calendar and payment-return links. TLS termination and HSTS belong
on the production ingress; this container listens on HTTP internally.

CSP permits the two approved Halyk payment scripts and their payment frames. Inline scripts and eval are
not permitted. Inline styles remain permitted for React charts, SVG maps and the bank widget's styles.
This policy is for the built nginx deployment; Vite's development server does not use it.
References: https://hub.docker.com/_/nginx and https://nginx.org/en/docs/http/ngx_http_proxy_module.html .

CI has a separate deployment-smoke job. It builds the real image, starts a temporary mock backend and
checks a deep SPA URL, assets, CSP headers, API query/body/auth forwarding, API errors and a PDF response.
It never makes orders, reports, role changes or payments on the live VM. To run the same check with Docker:

```powershell
docker build -t biletflow-frontend:ci .
node tests/deployment.smoke.mjs
```

## Recorded MVP scope and remaining backend work

- Current event media support is one poster per event; a gallery is not implemented. This records the
  current release scope, not a claim that an unprovided SRS has approved this restriction.
- The current backend deducts processing fees from organizer revenue. Sales screens explain the deduction
  and label net revenue after both discounts and refunds. Frontend checkout does not add a separate buyer fee.
- JWTs are stored in localStorage in this academic MVP. They are readable by same-origin JavaScript, so CSP
  reduces exposure but cannot make them equivalent to HttpOnly cookies. A cookie-based session model requires
  a backend contract and CSRF/session design; it is not silently substituted here.
- The web staff screen supports manual ticket codes, USB barcode scanners (the code field keeps focus
  between scans), check-in from search, and optional camera scanning where the browser has the
  `BarcodeDetector` API (feature-detected, falls back to manual entry; every camera track stops when the
  scanner closes). nginx sends `Permissions-Policy: camera=(self)` for this. Decoded http(s) links, such as
  a Campaign QR, are rejected without calling the scan endpoint. A separate RN/Expo app is not part of this
  repository. Optional GA4 is not enabled.
- Confirmations use the in-page `ConfirmDialog` (built on `Modal`: focus trap, focus restore, Escape,
  labelled by its visible title) instead of `window.confirm`.
- Ticket cards show event date, time and venue from the cached event query (`TicketResponse` has no
  such fields); several tickets of one event share one request.
- Backend work still needed: a city field for server-side catalog filtering; filtering financial sales
  totals and campaign attribution, beyond the currently filtered daily series.
