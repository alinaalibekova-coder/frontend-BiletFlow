# BiletFlow — attendee web app

React + TypeScript + Vite + Tailwind CSS. Talks to the team backend at
`https://biletflow.duckdns.org` (Swagger: `/swagger-ui.html`).

## What works now

| Page | Address | Backend endpoints used |
| --- | --- | --- |
| Home: banner, date strip, category menu, search, event grid | `/` | `GET /api/events`, `GET /api/events/{id}/ticket-types` |
| Event page: details, venue, prices, ticket list | `/events/5` | `GET /api/events/{id}`, `GET /api/events/{id}/ticket-types` |
| Login / registration window (email + password) | "Войти" button | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/users/me` |
| Organizer dashboard: My Events, Create Event, Event Management, edit event and tickets | `/organizer/events` | `GET /api/organizers/profile`, `GET /api/events/organizer/{organizerId}`, `GET`/`POST /api/venues`, `POST /api/events`, `GET`/`PUT /api/events/{id}`, `GET`/`POST /api/events/{id}/ticket-types`, poster upload/delete endpoints, event publish/unpublish/cancel endpoints |

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

If the needed venue is missing, the event form can create it through
`POST /api/venues` with `name`, `address`, and a positive integer `capacity`,
refresh the venue list, and select the new venue automatically. The form shows
the venue limit, prevents an event capacity above it, and explains that leaving
event capacity empty uses the venue capacity. The backend enforces this limit
on both event creation and updates.

After saving an event, the organizer is taken to a ticket setup step. It uses
`POST /api/events/{eventId}/ticket-types`; each ticket type has its own name,
price, quantity, and optional sales window. Multiple ticket types (for example
Standard and VIP) can be added. The backend validates aggregate ticket
quantities against the event capacity. Poster upload and deletion are also
available from ticket setup and event editing.

When publishing a draft, the dashboard checks whether it has any visible
available ticket types. If not, it asks the organizer to add tickets first or
confirm publishing without tickets.
For a published event with no ticket types, the public event page and event
card display "Билеты не требуются" instead of offering ticket purchase.

Events include `posterUrl`; the frontend displays it on event cards and event
pages, and organizers can upload or remove posters using
`POST`/`DELETE /api/events/{eventId}/poster`. Uploads are restricted to JPEG,
PNG, or WebP files up to 5 MB. Published public/unlisted posters load directly;
organizer pages fetch draft/private posters with the saved bearer token and a
blob URL. Venue maps and seat selection are not part of this API change.

The backend's update mapper ignores null fields. As a result, clearing optional
end/registration dates or capacity is not currently supported: an empty field
is omitted and its previous value remains. To support clearing these values,
the backend needs an explicit patch/clear contract (for example JSON Merge
Patch or dedicated clear flags); ordinary nulls currently mean "leave unchanged".

To grant access, the backend must assign the `ORGANIZER` role and make the
organizer profile available to that user. The user also needs at least one
venue before creating an event. Keep these authorization checks on the backend;
the frontend role check must never be treated as a security boundary.

Temporary workarounds until the backend adds them:

- **Search, date and category filters** run in the browser (`src/pages/HomePage.tsx`).
- **Price on cards** comes from one ticket-types request per card (`src/components/events/EventCard.tsx`).
- **City** and **KZ/RU/ENG** are shown but not working yet.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer (check with `node -v`).

```bash
cd biletflow-web
npm install      # downloads libraries into node_modules (first time only, ~1 min)
npm run dev      # starts the app
```

Open http://localhost:5173. Stop the app with `Ctrl + C`.

Every request to `/api/...` is forwarded to the backend by Vite
(see `vite.config.ts`), so you don't need CORS settings during development.

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
