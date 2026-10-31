# BiletFlow — attendee web app

React + TypeScript + Vite + Tailwind CSS. Talks to the team backend at
`http://89.168.75.147:8080` (Swagger: `/swagger-ui.html`).

## What works now

| Page | Address | Backend endpoints used |
| --- | --- | --- |
| Home: banner, date strip, category menu, search, event grid | `/` | `GET /api/events`, `GET /api/events/{id}/ticket-types` |
| Event page: details, venue, prices, ticket list | `/events/5` | `GET /api/events/{id}`, `GET /api/events/{id}/ticket-types` |
| Login / registration window (email + password) | "Войти" button | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/users/me` |
| Organizer dashboard: My Events, Create Event, Event Management | `/organizer/events` | `GET /api/organizers/profile`, `GET /api/events/organizer/{organizerId}`, `GET /api/venues`, `POST /api/events`, event publish/unpublish/cancel endpoints |

## Organizer dashboard and backend integration

The organizer dashboard uses the logged-in user from `GET /api/users/me`. The
frontend permits access only when `user.role` is `ORGANIZER` (also accepting
`ROLE_ORGANIZER`). Its role check is for navigation and user experience only:
the backend must validate the bearer token, organizer role, and event ownership
for every protected endpoint.

The dashboard loads the organizer profile from `GET /api/organizers/profile`,
then loads that profile's events from
`GET /api/events/organizer/{organizerId}?page=0&size=100`. Event creation sends
the Swagger `CreateEventRequest` fields to `POST /api/events`; a venue must
already exist because `venueId` is required. Event management calls
`POST /api/events/{eventId}/publish`, `/unpublish`, or `/cancel`. All requests
use the shared API client, which adds the saved bearer token and reports backend
errors.

To grant access, the backend must assign the `ORGANIZER` role and make the
organizer profile available to that user. The user also needs at least one
venue before creating an event. Keep these authorization checks on the backend;
the frontend role check must never be treated as a security boundary.

Temporary workarounds until the backend adds them:

- **Search, date and category filters** run in the browser (`src/pages/HomePage.tsx`).
- **Price on cards** comes from one ticket-types request per card (`src/components/events/EventCard.tsx`).
- **Posters** are grey placeholders (no image field yet).
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
