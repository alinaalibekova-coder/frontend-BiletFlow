import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

const outfile = path.resolve("node_modules/.cache/biletflow-ui-test.mjs");
await build({ stdin: { contents: `
  import React from 'react';
  import { renderToString, renderToReadableStream } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { AuthProvider } from './src/auth/AuthContext';
  import App from './src/App';
  import { EventSalesDetail } from './src/pages/OrganizerInsightsPage';
  import { EventSuspensionDialog } from './src/components/events/EventSuspensionDialog';
  import { ConfirmDialog } from './src/components/ui/ConfirmDialog';
  import { DateStrip } from './src/components/events/DateStrip';
  export function renderConfirm(props) {
    return renderToString(React.createElement(ConfirmDialog, { open: true, onConfirm() {}, onCancel() {}, ...props }));
  }
  export function renderDateStrip() {
    return renderToString(React.createElement(DateStrip, { selected: null, onSelect() {} }));
  }
  import { SeatMapPicker } from './src/components/events/SeatMapPicker';
  import { OrderItemsList } from './src/components/orders/OrderItemsList';
  import { CheckInResultCard } from './src/components/checkin/CheckInResultCard';
  export { readEventForm } from './src/pages/OrganizerPage';
  export { ApiError } from './src/api/client';
  import { EventSalesAnalytics } from './src/components/analytics/SalesInsights';
  export async function renderAnalytics(eventId, seeds) {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    for (const [key,value] of seeds) client.setQueryData(key,value);
    const stream = await renderToReadableStream(React.createElement(QueryClientProvider, { client },
      React.createElement(EventSalesAnalytics, { eventId }, sales => React.createElement(EventSalesDetail, { sales }))));
    await stream.allReady;
    const html = await new Response(stream).text();
    client.clear();
    return html;
  }
  export async function renderSeatMap(map, seats, selected = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(['seat-section', 7, 1], { section: map.sections[0], seats });
    const stream = await renderToReadableStream(React.createElement(QueryClientProvider, { client },
      React.createElement(SeatMapPicker, { eventId: 7, map, selected, activeSectionId: 1, onSelectSection() {}, onToggle() {}, onSeatsGone() {} })));
    await stream.allReady;
    const html = await new Response(stream).text();
    client.clear();
    return html;
  }
  export function renderSuspensionDialog(pending = false, error = null) {
    return renderToString(React.createElement(EventSuspensionDialog, { event: { id: 1, title: 'Free Java Workshop' }, pending, error, onConfirm() {}, onClose() {} }));
  }
  export function renderCheckInResult(result) {
    return renderToString(React.createElement(CheckInResultCard, { result }));
  }
  export function renderOrderItems(items) {
    return renderToString(React.createElement(OrderItemsList, { items }));
  }
  export function renderSalesDetail(sales) {
    return renderToString(React.createElement(EventSalesDetail, { sales }));
  }
  // errorSeeds: [queryKey, Error] pairs rendered as failed queries (not refetched on mount).
  export async function renderRoute(url, user, seeds = [], storedLanguage, { errorSeeds = [], session = {} } = {}) {
    const storage = new Map(user ? [['bf_token', 'ui-test-token']] : []);
    if (storedLanguage) storage.set('bf_language', storedLanguage);
    globalThis.localStorage = { getItem: key => storage.get(key) ?? null };
    globalThis.sessionStorage = { getItem: key => session[key] ?? null };
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    if (user) client.setQueryData(['me', 'ui-test-token'], user);
    for (const [key, value] of seeds) client.setQueryData(key, value);
    for (const [key, error] of errorSeeds) {
      client.setQueryDefaults(key, { retryOnMount: false });
      client.getQueryCache().build(client, { queryKey: key }).setState({ status: 'error', error, errorUpdatedAt: Date.now(), fetchStatus: 'idle' });
    }
    const stream = await renderToReadableStream(React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [url] },
        React.createElement(AuthProvider, null, React.createElement(App)))));
    await stream.allReady;
    const html = await new Response(stream).text();
    client.clear();
    return html;
  }
`, resolveDir: process.cwd() }, bundle: true, packages: "external", platform: "node", format: "esm", outfile });
const { ApiError, renderConfirm, renderDateStrip, renderRoute, renderSalesDetail, renderSuspensionDialog, renderSeatMap, renderOrderItems, renderCheckInResult, readEventForm, renderAnalytics } = await import(pathToFileURL(outfile));
const attendee = { id: 2, email: "attendee@test.invalid", role: "ATTENDEE", verificationStatus: true };
const organizer = { ...attendee, id: 1, role: "ORGANIZER" };
const admin = { ...attendee, id: 9, role: "PLATFORM_ADMIN" };
const page = content => ({ content, totalPages: 1, number: 0 });
const order = { id: 42, eventId: 7, eventTitle: "Jazz", status: "PENDING", totalAmount: 8000, attendeeName: "Алия", items: [] };
const event = { id: 7, title: "Jazz", category: "MUSIC", status: "PUBLISHED", startTime: "2027-12-10T18:00:00", paidSalesActive: false };
const activation = { eventId: 7, eventTitle: "Jazz", status: "SUSPENDED", simulated: true, feeAmount: 5000, checklist: [{ key: "FEE_PAID", done: true }], readyToActivate: false, suspensionReason: "Проверка" };
const detail = { supportCase: { id: 3, subject: "Помощь с билетом", type: "ATTENDEE", category: "PAYMENT", status: "OPEN", requesterId: 2, eventId: 7 }, messages: [{ id: 1, authorName: "Алия", body: "Нет билета", fromStaff: false, createdAt: "2026-11-13T12:00:00" }] };

test("success return URL never renders pending backend order as paid", async () => {
  const html = await renderRoute("/orders/42/payment-result?status=success", attendee, [[["order", 42], order], [["order-payments", 42], []]]);
  assert.match(html, /Проверяем оплату/);
  assert.doesNotMatch(html, /Оплата подтверждена/);
  assert.match(html, /Алия/);
});
test("paid confirmation no longer claims every payment was simulated", async () => {
  const html = await renderRoute("/orders/42", attendee, [[["order", 42], { ...order, status: "PAID" }], [["order-payments", 42], []]]);
  assert.match(html, /Оплата подтверждена/);
  assert.doesNotMatch(html, /Симулированная оплата прошла успешно/);
  assert.doesNotMatch(html, />Оплатить заказ</);
});
test("PDF download and attendee name appear on the ticket", async () => {
  const html = await renderRoute("/account", attendee, [[["my-orders", 0], page([])], [["my-tickets", 0], page([{ id: 5, eventTitle: "Jazz", ticketTypeName: "Standard", status: "VALID", attendeeName: "Алия", attendeeEmail: attendee.email, orderId: 42 }])]]);
  assert.match(html, /Скачать билет PDF/);
  assert.match(html, /Алия/);
  assert.match(html, /support\/new\?ticketId=5/);
});
test("unactivated paid sales disable paid ticket choice while free tickets remain selectable", async () => {
  const html = await renderRoute("/events/7", attendee, [[["event", 7], event], [["ticket-types", 7], [{ id: 3, name: "Paid", price: 5000, available: 10, hidden: false }, { id: 4, name: "Free", price: 0, available: 10, hidden: false }]]]);
  assert.match(html, /Платные продажи ещё не активированы/);
  assert.match(html, /disabled="" aria-label="Добавить билет Paid"/);
  assert.doesNotMatch(html, /disabled="" aria-label="Добавить билет Free"/);
  assert.match(html, /Имя посетителя/);
  assert.match(html, /Промокод/);
});
test("requesters see a support thread without staff assignment, status or escalation controls", async () => {
  const html = await renderRoute("/support/3", attendee, [[["support-case", 2, 3], detail]]);
  assert.match(html, /Нет билета/);
  assert.match(html, /Ваш ответ/);
  assert.doesNotMatch(html, /Email исполнителя|Изменить статус|Передать платформе/);
});
test("organizer handling another person's case sees staff controls", async () => {
  const html = await renderRoute("/support/3", organizer, [[["support-case", 1, 3], detail]]);
  assert.match(html, /Email исполнителя/);
  assert.match(html, /Изменить статус/);
  assert.match(html, /Передать платформе/);
});
test("organizer requester of a platform case has no staff controls", async () => {
  const html = await renderRoute("/support/3", organizer, [[["support-case", 1, 3], { ...detail, supportCase: { ...detail.supportCase, type: "PLATFORM", requesterId: 1 } }]]);
  assert.doesNotMatch(html, /Email исполнителя|Изменить статус|Передать платформе/);
});
test("resolved support threads prevent staff replies until status changes", async () => {
  const html = await renderRoute("/support/3", organizer, [[["support-case", 1, 3], { ...detail, supportCase: { ...detail.supportCase, status: "RESOLVED" } }]]);
  assert.match(html, /сначала измените статус/);
  assert.doesNotMatch(html, /Ваш ответ/);
});
test("admin event list omits unsupported ticket and event editing actions", async () => {
  const html = await renderRoute("/admin/dashboard/events", admin, [[["admin-search", "events", {}, 0], page([event])]]);
  assert.doesNotMatch(html, /href="\/admin\/dashboard\/events\/7\/(edit|tickets)"/);
  assert.match(html, /href="\/admin\/dashboard\/events\/7\/staff"/);
});
test("organizers see campaigns and activation links for their event", async () => {
  const html = await renderRoute("/organizer/events", organizer, [[["organizer-profile", "ORGANIZER"], { userId: 1 }], [["organizer-events", 1, 0], page([event])]]);
  assert.match(html, /\/organizer\/events\/7\/campaigns/);
  assert.match(html, /\/organizer\/events\/7\/activation/);
});
test("admin activation moderation explicitly preserves free and already sold tickets", async () => {
  const html = await renderRoute("/admin/dashboard/activations", admin, [[["admin-activations", "", 0], page([activation])]]);
  assert.match(html, /Бесплатные и уже проданные билеты продолжают работать/);
  assert.match(html, /Возобновить платные продажи/);
  assert.doesNotMatch(html, /Принять условия/);
});
test("unverified profiles show the verification notice and reset links require a token", async () => {
  const html = await renderRoute("/reset-password", { ...attendee, verificationStatus: false });
  assert.match(html, /Подтвердите email/);
  assert.match(html, /В ссылке нет токена/);
  assert.doesNotMatch(html, /autoComplete="new-password"/);
});
test("attendee cannot open organizer or admin-only pages", async () => {
  // An attendee is offered to become an organizer instead of the dashboard.
  const organizerPage = await renderRoute("/organizer/events/7/campaigns", attendee);
  assert.match(organizerPage, /Станьте организатором/);
  assert.match(organizerPage, /Контакты для посетителей/);
  assert.doesNotMatch(organizerPage, /Мои мероприятия/);
  assert.match(await renderRoute("/admin/dashboard/verification", attendee), /Недостаточно прав/);
});
test("sales details render populated LocalDate daily statistics without a blank page", async () => {
  const html = renderSalesDetail({ revenue: 10000, paidOrders: 2, cancelledOrders: 0, expiredOrders: 0, discounts: 2000, netRevenue: 8000, processingFees: 200, estimatedPayout: 7800, salesByDay: [{ date: "2026-11-12", revenue: 5000, ticketsSold: 1 }, { date: "2026-11-13", revenue: 5000, ticketsSold: 1 }] });
  assert.match(html, /12 ноября 2026/);
  assert.match(html, /13 ноября 2026/);
  assert.match(html, /Продажи по дням/);
});
test("event suspension has an in-page reason form, length limit and explicit confirmation", async () => {
  const html = renderSuspensionDialog();
  assert.match(html, /role="dialog"/);
  assert.match(html, /Free Java Workshop/);
  assert.match(html, /Причина приостановки/);
  assert.match(html, /required="" maxLength="500"/);
  assert.match(html, /disabled=""[^>]*>Подтвердить приостановку/);
  assert.match(html, /неоплаченные заказы отменятся/);
  assert.match(html, /Отмена/);
});
test("moderation failures stay visible in the dialog and pending submissions are disabled", async () => {
  assert.match(renderSuspensionDialog(false, new Error("Сервер временно недоступен")), /role="alert"[^>]*>Сервер временно недоступен/);
  const pending = renderSuspensionDialog(true);
  assert.match(pending, /disabled=""[^>]*>Приостанавливаем/);
  assert.match(pending, /disabled=""[^>]*>Отмена/);
});
test("cancelled events cannot be suspended through the management page", async () => {
  const html = await renderRoute("/admin/dashboard/manage", admin, [[["organizer-events", "all", 0], page([{ ...event, status: "CANCELLED" }])]]);
  assert.match(html, /disabled="" title="Отменённое событие нельзя приостановить"/);
});
const catalogEvents = [
  { ...event, id: 7, title: "Astana jazz", venue: { name: "Hall A", address: "Demo street, Astana" } },
  { ...event, id: 8, title: "Almaty jazz", venue: { name: "Hall B", address: "Алматы, Абая 1" } },
  { ...event, id: 9, title: "Unspecified jazz", venue: { name: "Hall C", address: "тестовый адрес, 1" } },
];
const catalogSeeds = [[["events"], page(catalogEvents)], ...catalogEvents.map(item => [["ticket-types", item.id], [{ id: item.id, price: 5000, hidden: false }]])];
test("English and Kazakh home routes translate navigation, dates, categories and ticket labels", async () => {
  const en = await renderRoute("/?lang=en", null, catalogSeeds);
  assert.match(en, /Popular events/);
  assert.match(en, /Search events/);
  assert.match(en, /All cities/);
  assert.match(en, /Music/);
  assert.match(en, /December/);
  assert.match(en, /Buy tickets/);
  const kk = await renderRoute("/?lang=kk", null, catalogSeeds);
  assert.match(kk, /Танымал іс-шаралар/);
  assert.match(kk, /Барлық қалалар/);
  assert.match(kk, /Бүгін/);
  assert.match(kk, /Билет сатып алу/);
  assert.match(kk, /желтоқсан/);
});
test("the catalog shows 24 cards first and a show-more button, so hidden cards load no prices yet", async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ ...event, id: 100 + i, title: `Concert ${i + 1}` }));
  const html = await renderRoute("/?lang=en", null, [[["events"], page(many)]]);
  assert.equal((html.match(/<h3[^>]*>Concert \d+</g) ?? []).length, 24);
  assert.match(html, /Concert 24</);
  assert.doesNotMatch(html, /Concert 25</);
  assert.match(html, />Show more</);
  const few = await renderRoute("/?lang=en", null, catalogSeeds);
  assert.doesNotMatch(few, /Show more/);
});
test("an event card uses the event's minPrice when the backend sends it", async () => {
  const priced = [{ ...event, id: 7, title: "Free jazz", minPrice: 0 }, { ...event, id: 8, title: "Paid jazz", minPrice: 2500 }];
  const html = await renderRoute("/?lang=kk", null, [[["events"], page(priced)]]);
  assert.match(html, /Тегін/);
  assert.match(html, /2[\s\u00a0]500 ₸ бастап/);
});
test("city, search, category and date filters combine and category links retain the city", async () => {
  const html = await renderRoute("/?city=astana&lang=en&q=astana&category=MUSIC&date=2027-12-10", null, catalogSeeds);
  assert.match(html, /Astana jazz/);
  assert.doesNotMatch(html, /Almaty jazz|Unspecified jazz/);
  assert.match(html, /city=astana/);
  assert.match(html, /Clear filters/);
  assert.match(html, /value="astana" selected=""/);
});
test("all cities includes unrecognized addresses and missing cities have their own filter", async () => {
  const all = await renderRoute("/?lang=en", null, catalogSeeds);
  assert.match(all, /Astana jazz/); assert.match(all, /Almaty jazz/); assert.match(all, /Unspecified jazz/);
  const unknown = await renderRoute("/?city=unknown&lang=en", null, catalogSeeds);
  assert.match(unknown, /Unspecified jazz/);
  assert.doesNotMatch(unknown, /Astana jazz|Almaty jazz/);
  const empty = await renderRoute("/?city=shymkent&lang=en", null, catalogSeeds);
  assert.match(empty, /No events found/);
  assert.doesNotMatch(empty, /Astana jazz|Almaty jazz|Unspecified jazz/);
});
test("saved language survives navigation and an explicit URL language overrides it", async () => {
  assert.match(await renderRoute("/", null, catalogSeeds, "en"), /Popular events/);
  assert.match(await renderRoute("/?lang=ru", null, catalogSeeds, "en"), /Популярные события/);
});

const translatedPageSeeds = [
  [["event", 7], { ...event, description: "Авторское описание события", capacity: 100, venue: { id: 1, name: "Original venue", address: "Astana", capacity: 100 } }],
  [["ticket-types", 7], [{ id: 3, eventId: 7, name: "Авторский билет", description: "Авторское описание билета", price: 5000, available: 10, sold: 0, quantity: 10, hidden: false }]],
  [["order", 42], order], [["order-payments", 42], []],
  [["my-orders", 0], page([])], [["my-tickets", 0], page([{ id: 5, eventTitle: "Название события", ticketTypeName: "Название билета", status: "VALID", attendeeName: "Имя посетителя", orderId: 42 }])],
  [["organizer-profile"], { id: 4, userId: 1, verificationStatus: "UNVERIFIED", contactInformation: "Original contact" }],
  [["organizer-profile", "ORGANIZER"], { id: 4, userId: 1 }], [["payout-account"], null],
  [["organizer-events", 1, 0], page([event])], [["organizer-events", "all", 0], page([event])],
  [["venues"], page([{ id: 1, name: "Original venue", address: "Astana", capacity: 100 }])],
  [["support-cases", 2, "", false, 0], page([])], [["support-cases", 9, "", true, 0], page([])],
  [["support-case", 2, 3], detail], [["support-case", 1, 3], detail],
  [["notifications", 2, 0], page([])], [["assigned-events"], page([])], [["admin-users", 0, {}], page([])], [["admin-events"], page([])],
  [["event-staff", 7], []], [["admin-sales-events", 0], page([event])], [["campaigns", 7], []],
  [["activation", 7], activation], [["admin-activations", "", 0], page([activation])], [["verification-requests", 0], page([])],
  [["organizer-sales-summary"], { events: [], totals: {} }],
];
const translatedPages = [
  ["/events/7", attendee, "About the event", "Іс-шара туралы"],
  ["/orders/42", attendee, "Order confirmation", "Тапсырысты растау"],
  ["/orders/42/payment-result", attendee, "Checking payment.", "Төлем тексерілуде."],
  ["/account", attendee, "My orders", "Менің тапсырыстарым"],
  ["/account/settings", attendee, "Profile and account settings", "Профиль және аккаунт баптаулары"],
  ["/account/settings", organizer, "Organizer verification and payout details", "Ұйымдастырушыны растау және төлем деректемелері"],
  ["/forgot-password", null, "Password recovery", "Құпиясөзді қалпына келтіру"],
  ["/reset-password?token=demo", null, "New password", "Жаңа құпиясөз"],
  ["/verify-email?token=demo", null, "Email verification", "Email растау"],
  ["/notifications", attendee, "No notifications yet.", "Әзірге хабарландыру жоқ."],
  ["/support", attendee, "Create case", "Өтініш жасау"],
  ["/support/new?eventId=7", attendee, "New support case", "Жаңа қолдау өтініші"],
  ["/support/3", attendee, "Your reply", "Сіздің жауабыңыз"],
  ["/support/3", organizer, "Assignee email", "Жауапты қызметкердің email мекенжайы"],
  ["/staff", organizer, "Event check-in", "Іс-шараға кіруді тексеру"],
  ["/organizer/events", organizer, "My events", "Менің іс-шараларым"],
  ["/organizer/create", organizer, "Create event", "Іс-шара жасау"],
  ["/organizer/events/7/edit", organizer, "Edit event", "Іс-шараны өзгерту"],
  ["/organizer/events/7/tickets", organizer, "Ticket types", "Жасалған билет түрлері"],
  ["/organizer/events/7/staff", organizer, "Event staff", "Іс-шара қызметкерлері"],
  ["/organizer/events/7/campaigns", organizer, "Create campaign", "Науқан жасау"],
  ["/organizer/events/7/activation", organizer, "Paid-sales activation", "Ақылы сатылымды белсендіру"],
  ["/organizer/manage", organizer, "Event management", "Іс-шараларды басқару"],
  ["/organizer/sales", organizer, "Event sales", "Іс-шара сатылымдары"],
  ["/admin/users", admin, "Platform users", "Платформа пайдаланушылары"],
  ["/admin/dashboard/events", admin, "All platform events", "Платформаның барлық іс-шаралары"],
  ["/admin/dashboard/manage", admin, "Event management", "Іс-шараларды басқару"],
  ["/admin/dashboard/sales", admin, "Sales and orders by event", "Іс-шара бойынша сатылымдар мен тапсырыстар"],
  ["/admin/dashboard/verification", admin, "Organizer verification requests", "Ұйымдастырушылардың өтінімдері"],
  ["/admin/dashboard/activations", admin, "Paid sales", "Ақылы сатылым"],
  ["/admin/dashboard/support", admin, "Escalated cases", "Платформаға берілген өтініштер"],
  ["/missing-page", null, "Page not found", "Бет табылмады"],
];
for (const [url, user, en, kk] of translatedPages) {
  test(`English and Kazakh content on ${url} (${user?.role ?? "guest"})`, async () => {
    for (const [language, expected] of [["en", en], ["kk", kk]]) {
      const params = new URL(url, "http://test.invalid"); params.searchParams.set("lang", language);
      const html = await renderRoute(params.pathname + params.search, user, translatedPageSeeds);
      assert.ok(html.includes(expected), `Missing ${language} text: ${expected}`);
    }
  });
}
test("event localization keeps organizer content, attendee names and ticket names unchanged", async () => {
  const html = await renderRoute("/events/7?lang=en", attendee, translatedPageSeeds);
  assert.match(html, /Авторское описание события/);
  assert.match(html, /Авторский билет/);
  assert.match(html, /Attendee name/);
  const tickets = await renderRoute("/account?lang=kk", attendee, translatedPageSeeds);
  assert.match(tickets, /Имя посетителя/);
  assert.match(tickets, /Жарамды/);
});
test("translated support statuses retain raw API enum values in form controls", async () => {
  const html = await renderRoute("/support/3?lang=en", organizer, translatedPageSeeds);
  assert.match(html, /value="OPEN" selected=""/);
  assert.match(html, />Open<\/option>/);
  assert.match(html, /value="WAITING_FOR_CUSTOMER"/);
  assert.doesNotMatch(html, /value="Open"/);
});
test("every static page phrase has English and Kazakh translations", async () => {
  const messages = JSON.parse(fs.readFileSync("src/i18n/messages.json", "utf8"));
  for (const root of ["src/pages", "src/components"]) {
    for (const name of fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith(".tsx"))) {
      const file = path.join(root, name);
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === "tx" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text.trim().replace(/\s+/g, " ");
          assert.equal(messages[key]?.length, 2, `Missing translation in ${file}: ${key}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
});
test("event creation asks for city before venue and does not list venues until a city is chosen", async () => {
  const html = await renderRoute("/organizer/create?lang=en", organizer, translatedPageSeeds);
  assert.match(html, /Event city/);
  assert.ok(html.indexOf("Event city") < html.indexOf('name="venueId"'));
  assert.match(html, /Select a city first/);
  assert.match(html, /name="eventCity" required=""/);
  assert.match(html, /name="venueId" required="" disabled=""/);
  assert.doesNotMatch(html, /<option[^>]*>Original venue/);
});
test("event editing preselects its venue city and lists only venues in that city", async () => {
  const venues = [
    { id: 1, name: "Original venue", address: "Astana", capacity: 100 },
    { id: 2, name: "Second Astana hall", address: "Астана, Abay 1", capacity: 200 },
    { id: 3, name: "Almaty hall", address: "Алматы, Abay 2", capacity: 300 },
  ];
  const html = await renderRoute("/organizer/events/7/edit?lang=en", organizer, [...translatedPageSeeds, [["venues"], page(venues)]]);
  assert.match(html, /value="astana" selected=""/);
  assert.match(html, /Second Astana hall/);
  assert.doesNotMatch(html, /Almaty hall/);
});
test("editing a legacy event without a city keeps its existing venue available", async () => {
  const legacy = { ...event, venue: { id: 1, name: "Legacy hall", address: "Unknown street", capacity: 100 } };
  const html = await renderRoute("/organizer/events/7/edit?lang=en", organizer, [...translatedPageSeeds, [["event", 7], legacy]]);
  assert.match(html, /value="unknown" selected=""/);
  assert.match(html, /Legacy hall/);
  assert.match(html, /The current venue has no specified city/);
});
test("event form times are checked in Kazakhstan time, not the browser's time zone", () => {
  const almatyInput = minutesFromNow => new Date(Date.now() + 5 * 3600_000 + minutesFromNow * 60_000).toISOString().slice(0, 16);
  const form = fields => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ title: "Jazz", category: "Music", venueId: "1", visibilityStatus: "PUBLIC", ...fields })) data.set(key, value);
    return data;
  };
  assert.throws(() => readEventForm(form({ startTime: almatyInput(-30) })), /в будущем/);
  assert.equal(readEventForm(form({ startTime: almatyInput(30) })).startTime, `${almatyInput(30)}:00`);
  assert.throws(() => readEventForm(form({ startTime: "2027-12-10T18:00", endTime: "2027-12-10T18:00" })), /позже начала/);
  assert.throws(() => readEventForm(form({ startTime: "2027-12-10T18:00", registrationClosingTime: "2027-12-10T18:30" })), /до начала события/);
});
test("event category is chosen from the agreed list in every language", async () => {
  const html = await renderRoute("/organizer/create?lang=kk", organizer, translatedPageSeeds);
  assert.doesNotMatch(html, /<input[^>]*name="category"/);
  const select = html.match(/<select[^>]*name="category"[\s\S]*?<\/select>/)?.[0] ?? "";
  assert.equal((select.match(/<option /g) ?? []).length, 15);
  assert.match(select, /value="Technology"[^>]*>Технологиялар</);
  assert.match(select, /value="Other"[^>]*>Басқа</);
  const english = await renderRoute("/organizer/create?lang=en", organizer, translatedPageSeeds);
  assert.match(english, /value="Social"[^>]*>Meetups</);
});
test("editing an event keeps its saved category, including values outside the list", async () => {
  const upper = await renderRoute("/organizer/events/7/edit?lang=en", organizer, translatedPageSeeds);
  const upperSelect = upper.match(/<select[^>]*name="category"[\s\S]*?<\/select>/)?.[0] ?? "";
  assert.match(upperSelect, /value="MUSIC" selected=""[^>]*>Music</);
  assert.doesNotMatch(upperSelect, /value="Music"/);
  const legacy = await renderRoute("/organizer/events/7/edit?lang=en", organizer, [...translatedPageSeeds, [["event", 7], { ...event, category: "Festivals" }]]);
  const legacySelect = legacy.match(/<select[^>]*name="category"[\s\S]*?<\/select>/)?.[0] ?? "";
  assert.match(legacySelect, /value="Festivals" selected=""[^>]*>Festivals · current value</);
  assert.match(legacySelect, /value="Festival"[^>]*>Festivals</);
});

test("calendar and report actions use the event owner user ID and expose cancellation downloads", async () => {
  const seeds = [[["event", 7], { ...event, organizerId: organizer.id }], [["ticket-types", 7], []]];
  const attendeeHtml = await renderRoute("/events/7", attendee, seeds);
  assert.match(attendeeHtml, /Добавить в календарь/);
  assert.match(attendeeHtml, /Пожаловаться на событие/);
  const ownHtml = await renderRoute("/events/7", organizer, [...seeds, [["organizer-profile"], { id: 5, userId: organizer.id }]]);
  assert.doesNotMatch(ownHtml, /Пожаловаться на событие/);
  const cancelled = await renderRoute("/events/7", attendee, [...seeds, [["event", 7], { ...event, status: "CANCELLED" }]]);
  assert.doesNotMatch(cancelled, /Добавить в календарь/);
  assert.match(cancelled, /Скачать отмену события/);
  const otherEvent = await renderRoute("/events/7", organizer, [...seeds, [["event",7],{ ...event, organizerId: 5 }], [["organizer-profile"],{ id:5, userId:organizer.id }]]);
  assert.match(otherEvent, /Пожаловаться на событие/);
});
test("assigned event ticket creation derives quantity from sections and locks venue and capacity editing", async () => {
  const assigned = { ...event, seatingMode: "ASSIGNED", venue: { id: 1, name: "Hall", address: "Astana", capacity: 488 }, capacity: 488 };
  const seeds = [...translatedPageSeeds, [["event",7],assigned]];
  const tickets = await renderRoute("/organizer/events/7/tickets", organizer, seeds);
  assert.doesNotMatch(tickets, /name="quantity"/);
  assert.match(tickets, /\/organizer\/events\/7\/seating/);
  const editing = await renderRoute("/organizer/events/7/edit", organizer, seeds);
  assert.match(editing, /name="venueId" required="" disabled=""/);
  assert.match(editing, /type="hidden"[^>]*name="venueId"|name="venueId"[^>]*type="hidden"/);
  const capacity = editing.match(/<input[^>]*name="capacity"[^>]*>/)?.[0] ?? "";
  assert.match(capacity, /disabled=""/);
});
test("admin user suspension controls exclude yourself and platform admins", async () => {
  const people = [{ ...attendee, id: 20 }, admin, { ...attendee, id: 21, suspended: true, suspensionReason: "Review" }];
  const html = await renderRoute("/admin/users", admin, [[["admin-users",0,{}],page(people)], [["admin-events"],page([])]]);
  assert.equal((html.match(/>Приостановить аккаунт<\/button>/g) ?? []).length, 1);
  assert.equal((html.match(/>Восстановить аккаунт<\/button>/g) ?? []).length, 1);
  assert.match(html, /Review/);
  assert.match(html, /name="suspended"/);
});
test("admin settings constrain future fees and include authenticated CSV controls", async () => {
  const html = await renderRoute("/admin/dashboard/settings?lang=en", admin, [[["platform-settings"], { activationFeeKzt: 5000, processingFeePercent: 2 }]]);
  assert.match(html, /Changes apply only to future charges/);
  assert.match(html, /name="activationFeeKzt"/);
  assert.match(html, /max="50"/);
  assert.match(html, /Download CSV/);
});
test("report details offer review and event suspension as separate actions", async () => {
  const report = { id: 3, eventId: 7, eventTitle: "Jazz", reporterEmail: "reporter@test.invalid", reason: "FRAUD", status: "OPEN", message: "Evidence" };
  const html = await renderRoute("/admin/dashboard/reports/3?lang=en", admin, [[["report",3],report], [["reported-event",7],event]]);
  assert.match(html, /Evidence/);
  assert.match(html, /value="ACTIONED"/);
  assert.match(html, /Complete review/);
  assert.match(html, />Suspend<\/button>/);
});
test("simulated payouts show the financial breakdown and disable actions on paid payouts", async () => {
  const payout = { id: 3, eventId: 7, eventTitle: "Jazz", organizerEmail: "organizer@test.invalid", status: "PAID", grossRevenue: 10000, discounts: 1000, refunds: 1000, processingFees: 200, amount: 7800, simulated: true, reference: "SIM-3" };
  const html = await renderRoute("/admin/dashboard/payouts/3?lang=en", admin, [[["payout",3],payout]]);
  assert.match(html, /Simulated payout/);
  assert.match(html, /SIM-3/);
  assert.match(html, /7.?800/);
  assert.doesNotMatch(html, /Pay now \(simulation\)/);
  const held = await renderRoute("/admin/dashboard/payouts/3?lang=kk", admin, [[["payout",3],{ ...payout, status: "ON_HOLD", statusReason: "Review" }]]);
  assert.match(held, /Кідіртуді алып тастау/);
  assert.match(held, /Қазір төлеу/);
});
test("attendees cannot open the new administration routes", async () => {
  for (const route of ["overview", "reports", "settings", "payments", "payouts/3", "venues"]) {
    const html = await renderRoute(`/admin/dashboard/${route}`, attendee);
    assert.match(html, /Недостаточно прав/);
    assert.doesNotMatch(html, /name="activationFeeKzt"/);
  }
});

test("seat maps distinguish every server status and label accessible seats for keyboard users", async () => {
  const section = { id: 1, key: "A", name: "North stand", kind: "SEATED", onSale: true, ticketTypeId: 4, ticketTypeName: "Standard", price: 1000, available: 1, x: 0, y: 0, width: 100, height: 40 };
  const seats = ["AVAILABLE", "HELD", "YOURS", "SOLD", "UNAVAILABLE"].map((status, index) => ({ id: index + 1, row: "A", number: index + 1, x: 10 + index * 10, y: 20, accessible: index === 0, status }));
  const html = await renderSeatMap({ eventId: 7, width: 100, height: 40, sections: [section] }, seats);
  for (const text of ["Свободно", "Зарезервировано другим покупателем", "В вашем неоплаченном заказе", "Продано", "Недоступно"]) assert.ok(html.includes(text));
  assert.match(html, /доступная среда/);
  assert.match(html, /data-seat-id="1"[^>]*tabindex="0"/);
  assert.match(html, /data-seat-id="4"[^>]*aria-disabled="true"/);
});

test("organizer order lines show every seat of one ticket type without duplicate React keys", () => {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    const html = renderOrderItems([
      { ticketTypeId: 3, ticketTypeName: "Партер", quantity: 1, unitPrice: 5000, seatId: 11, seatLabel: "Партер, ряд A, место 1" },
      { ticketTypeId: 3, ticketTypeName: "Партер", quantity: 1, unitPrice: 5000, seatId: 12, seatLabel: "Партер, ряд A, место 2" },
      { ticketTypeId: 4, ticketTypeName: "Танцпол", quantity: 2, unitPrice: 3000 },
    ]);
    assert.match(html, /ряд A, место 1/);
    assert.match(html, /ряд A, место 2/);
    assert.match(html, /Танцпол × 2/);
    assert.equal(errors.filter(e => /same key/.test(e)).length, 0);
  } finally { console.error = original; }
});

test("check-in results are clearly distinct for every scan outcome", () => {
  const ticket = { id: 5, code: "T-1", status: "USED", ticketTypeName: "Fan field", attendeeEmail: "a@test.invalid", attendeeName: "Алия", seatLabel: null };
  const titles = {
    CHECKED_IN: "Проход разрешён",
    ALREADY_USED: "Билет уже использован",
    CANCELLED: "Билет отменён",
    REFUNDED: "Билет возвращён",
    WRONG_EVENT: "Билет на другое мероприятие",
    INVALID: "Недействительный билет",
  };
  for (const [result, title] of Object.entries(titles)) {
    const hasTicket = result !== "INVALID" && result !== "WRONG_EVENT";
    const html = renderCheckInResult({ result, message: "", checkedInAt: "2026-11-22T00:47:00", ticket: hasTicket ? ticket : null }).replace(/<!-- -->/g, "");
    assert.match(html, /role="alert"/);
    assert.match(html, new RegExp(`data-result="${result}"`));
    assert.match(html, new RegExp(title));
    if (hasTicket) assert.match(html, /Алия · Fan field/);
  }
  assert.match(renderCheckInResult({ result: "ALREADY_USED", message: "", checkedInAt: "2026-11-22T00:47:00", ticket }), /Отмечен:/);
  assert.match(renderCheckInResult({ result: "CHECKED_IN", message: "", ticket }), /bg-green-50/);
  assert.match(renderCheckInResult({ result: "REFUNDED", message: "", ticket }), /bg-red-50/);
});
test("staff can check in a valid ticket found by search and undo only a used one", async () => {
  const valid = { id: 5, code: "T-5", status: "VALID", ticketTypeName: "Fan field", attendeeEmail: "valid@test.invalid", eventId: 7, eventTitle: "Jazz", orderId: 1, ticketTypeId: 3 };
  const used = { ...valid, id: 6, code: "T-6", status: "USED", attendeeEmail: "used@test.invalid", usedAt: "2026-11-22T00:47:00" };
  const html = await renderRoute("/staff", organizer, [
    [["assigned-events"], page([event])],
    [["check-in-stats", 7], { eventId: 7, registered: 2, checkedIn: 1, notCheckedIn: 1 }],
    [["event-attendees", 7, "", 0], page([valid, used])],
  ]);
  assert.equal((html.match(/Отметить проход/g) ?? []).length, 1);
  assert.equal((html.match(/Отменить check-in/g) ?? []).length, 1);
  assert.ok(html.indexOf("valid@test.invalid") < html.indexOf("Отметить проход"));
  assert.ok(html.indexOf("used@test.invalid") < html.indexOf("Отменить check-in"));
});

test("cancelled and refunded tickets show no QR code and are marked invalid for entry", async () => {
  const base = { eventTitle: "Jazz", ticketTypeName: "Standard", attendeeName: "Алия", attendeeEmail: attendee.email, orderId: 42, eventId: 7 };
  const html = await renderRoute("/account", attendee, [[["my-orders", 0], page([])], [["my-tickets", 0], page([
    { ...base, id: 5, status: "VALID" },
    { ...base, id: 6, status: "CANCELLED" },
    { ...base, id: 7, status: "REFUNDED" },
  ])]]);
  assert.equal((html.match(/Показать QR-код/g) ?? []).length, 1);
  assert.equal((html.match(/data-qr-invalid="true"/g) ?? []).length, 2);
  assert.equal((html.match(/QR-код недействителен для входа\./g) ?? []).length, 2);
  assert.match(html, /Билет отменён/);
  assert.match(html, /Билет возвращён/);
});

test("drafts have organizer preview links, a private-draft banner and disabled checkout", async () => {
  const draft = { ...event, status:"DRAFT", organizerId:organizer.id };
  const list = await renderRoute("/organizer/events",organizer,[[["organizer-profile","ORGANIZER"],{ id:99,userId:organizer.id }],[["organizer-events",organizer.id,0],page([draft])]]);
  assert.match(list,/href="\/events\/7\?preview=1"/);
  const html = await renderRoute("/events/7?preview=1&lang=en",organizer,[[["event",7],draft],[["ticket-types",7],[{ id:4,name:"Free",price:0,available:10 }]]]);
  assert.match(html,/Draft — not published/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Choose tickets<\/button>/);
  assert.doesNotMatch(html,/Report event/);
});

test("registration windows block both choosing and adding tickets, and display the event end time", async () => {
  const current = Date.now();
  const future = offset => new Date(current + offset).toISOString();
  const types = [{ id:4,name:"Free",price:0,available:10,hidden:false }];
  for (const [opening,closing,message] of [[future(3600000),future(7200000),"Registration has not opened yet"],[future(-7200000),future(-3600000),"Registration is closed"]]) {
    const html = await renderRoute("/events/7?lang=en",attendee,[[["event",7],{ ...event,startTime:future(10800000),endTime:future(14400000),registrationOpeningTime:opening,registrationClosingTime:closing }],[["ticket-types",7],types]]);
    assert.ok(html.includes(message));
    assert.match(html,/Registration opens:/);
    assert.match(html,/Registration closes:/);
    assert.match(html,/Ends:/);
    assert.match(html,/<button[^>]*disabled=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Choose tickets<\/button>/);
    assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Add a Free ticket"/);
  }
});

test("paid confirmation offers calendar actions while pending confirmation does not", async () => {
  const seeds = [[["order",42],{ ...order,status:"PAID" }],[["order-payments",42],[]]];
  const html = await renderRoute("/orders/42?lang=en",attendee,seeds);
  assert.match(html,/Add to calendar/);
  const pending = await renderRoute("/orders/42?lang=en",attendee,[[["order",42],order],[["order-payments",42],[]]]);
  assert.doesNotMatch(pending,/Add to calendar/);
});

test("ticket cancellation and refund do not imply event cancellation; calendar metadata decides", async () => {
  const ticket = { id:5,eventId:7,eventTitle:"Jazz",ticketTypeName:"Standard",attendeeEmail:attendee.email,orderId:42,status:"REFUNDED" };
  const seeds = [[["my-orders",0],page([])],[["my-tickets",0],page([ticket])]];
  // The refunded ticket's event is still on: the loaded event decides, no calendar request needed.
  const active = await renderRoute("/account?lang=en",attendee,[...seeds,[["event",7],event]]);
  assert.match(active,/Add to calendar/);
  assert.doesNotMatch(active,/Download event cancellation/);
  const cancelled = await renderRoute("/account?lang=en",attendee,[...seeds,[["event",7],{ ...event, status:"CANCELLED" }]]);
  assert.match(cancelled,/Download event cancellation \(.ics\)/);
  assert.doesNotMatch(cancelled,/Add to calendar/);
  // A cancelled event is no longer public (404): then the calendar endpoint tells.
  const hidden = await renderRoute("/account?lang=en",attendee,[...seeds,[["calendar",7],{ cancelled:true }]],undefined,{ errorSeeds:[[["event",7],new ApiError(404,"Not found")]] });
  assert.match(hidden,/Download event cancellation \(.ics\)/);
});

test("sales analytics include real filter controls, server inventory metrics and all-time campaign attribution", async () => {
  const data = { ...event,eventId:7,eventTitle:"Jazz",capacity:100,ticketsRemaining:12,percentSold:50,paidOrders:2,cancelledOrders:0,expiredOrders:0,revenue:10000,discounts:1000,netRevenue:9000,processingFees:200,estimatedPayout:8800,salesByDay:[] };
  const html = await renderAnalytics(7,[[["organizer-sales-detail",7],data],[["ticket-types",7],[{ id:4,name:"Авторский VIP" }]],[["campaigns",7],[{ id:2,name:"Авторская кампания",code:"PROMO",redemptions:3,ticketsSold:4,grossRevenue:12345,discountAmount:345,netRevenue:12000 }]]]);
  assert.match(html,/name="from"/);
  assert.match(html,/name="to"/);
  assert.match(html,/name="ticketTypeId"/);
  assert.match(html,/value="4"/);
  assert.match(html,/Авторский VIP/);
  assert.match(html,/Итоги и остатки показаны за всё время/);
  assert.match(html,/Остаток вместимости/);
  assert.match(html,/50%/);
  assert.match(html,/Авторская кампания/);
  assert.match(html,/12.?345/);
  assert.match(html,/12.?000/);
});

test("category navigation combines legacy aliases and old category URLs select every matching event", async () => {
  const items = [
    { ...event,id:801,title:"Lower code",category:"Music",minPrice:0 },
    { ...event,id:802,title:"Upper code",category:"MUSIC",minPrice:0 },
    { ...event,id:803,title:"Russian label",category:"Музыка",minPrice:0 },
    { ...event,id:804,title:"Unrelated lesson",category:"Music theory",minPrice:0 },
  ];
  const seeds = [[["events"],page(items)]];
  for (const category of ["Music","MUSIC","Музыка"]) {
    const html = await renderRoute(`/?lang=ru&category=${encodeURIComponent(category)}`,null,seeds);
    assert.match(html,/Lower code/);
    assert.match(html,/Upper code/);
    assert.match(html,/Russian label/);
    assert.doesNotMatch(html,/Unrelated lesson/);
    assert.equal((html.match(/>Музыка<\/a>/g)??[]).length,1);
    assert.equal((html.match(/aria-current="page"/g)??[]).length,1);
  }
  const html = await renderRoute("/?lang=en",null,seeds);
  assert.equal((html.match(/>Music<\/a>/g)??[]).length,1);
});

test("event sales explain processing fees and label net revenue after refunds", () => {
  const html = renderSalesDetail({ revenue:10000,paidOrders:2,cancelledOrders:0,expiredOrders:0,discounts:1000,refunds:2000,netRevenue:7000,processingFees:200,estimatedPayout:6800,salesByDay:[] });
  assert.match(html,/После скидок и возвратов/);
  assert.match(html,/Комиссия обработки удерживается из дохода организатора/);
  assert.doesNotMatch(html,/>После скидок<\/p>/);
  assert.match(html,/6.?800/);
});

// ---- Review fixes (phase 1) ----
const almatyLocal = ms => new Date(Date.now() + 5 * 3600_000 + ms).toISOString().slice(0, 19);
const buyable = [[["event", 7], { ...event, paidSalesActive: true }], [["ticket-types", 7], [{ id: 3, eventId: 7, name: "Standard", price: 5000, available: 10, sold: 0, quantity: 10, hidden: false }]]];
test("an invalid promo from the event link shows its error", async () => {
  const html = await renderRoute("/events/7?promo=BAD-TOKEN", attendee, buyable, undefined, {
    errorSeeds: [[["promo-preview", 7, "BAD-TOKEN", true], new Error("Промокод не найден")]],
  });
  assert.match(html, /role="alert"[^>]*>Промокод не найден/);
  assert.match(html, /value="BAD-TOKEN"/);
});
test("a promo stored by another campaign link is never shown or applied on the first render of an event", async () => {
  const html = await renderRoute("/events/7", attendee, buyable, undefined, { session: { bf_promo: "OTHER-EVENT-TOKEN" } });
  assert.doesNotMatch(html, /OTHER-EVENT-TOKEN/);
  assert.doesNotMatch(html, /role="alert"/);
});
test("selected seats show a white checkmark and sold accessible seats keep their status symbol", async () => {
  const section = { id: 1, key: "A", name: "North stand", kind: "SEATED", onSale: true, ticketTypeId: 4, ticketTypeName: "Standard", price: 1000, available: 2, x: 0, y: 0, width: 100, height: 40 };
  const seats = [
    { id: 1, row: "A", number: 1, x: 10, y: 20, accessible: false, status: "AVAILABLE" },
    { id: 2, row: "A", number: 2, x: 20, y: 20, accessible: true, status: "SOLD" },
    { id: 3, row: "A", number: 3, x: 30, y: 20, accessible: true, status: "AVAILABLE" },
  ];
  const selected = { 1: { id: 1, sectionId: 1, sectionName: "North stand", row: "A", number: 1, ticketTypeId: 4, ticketTypeName: "Standard", price: 1000 } };
  const html = await renderSeatMap({ eventId: 7, width: 100, height: 40, sections: [section] }, seats, selected);
  assert.match(html, /class="pointer-events-none fill-white"[^>]*>✓</);
  assert.match(html, /class="pointer-events-none fill-white"[^>]*>×</);
  assert.match(html, /class="pointer-events-none fill-black"[^>]*>3</);
  assert.equal((html.match(/data-accessible-badge="true"/g) ?? []).length, 2);
  assert.match(html, /Ряд A, место 2, доступная среда, Продано/);
  assert.match(html, /значок рядом с местом/);
});
test("a pending order shows a live reservation countdown and warns under two minutes", async () => {
  const seeds = minutes => [[["order", 42], { ...order, expiresAt: almatyLocal(minutes * 60_000) }], [["order-payments", 42], []]];
  const calm = await renderRoute("/orders/42", attendee, seeds(10));
  assert.match(calm, /Билеты зарезервированы ещё/);
  assert.match(calm, /<time[^>]*>(10:00|09:5\d)<\/time>/);
  assert.doesNotMatch(calm, /data-hold-warning/);
  assert.equal((calm.match(/<main/g) ?? []).length, 1);
  const urgent = await renderRoute("/orders/42", attendee, seeds(1.5));
  assert.match(urgent, /data-hold-warning="true"/);
  assert.match(urgent, /Осталось меньше 2 минут/);
  assert.match(urgent, /<time[^>]*>01:(30|2\d)<\/time>/);
});
test("an expired hold disables payment and shows the expiry message", async () => {
  const html = await renderRoute("/orders/42", attendee, [[["order", 42], { ...order, expiresAt: almatyLocal(-60_000) }], [["order-payments", 42], []]]);
  assert.match(html, /disabled=""[^>]*>Оплатить заказ</);
  assert.match(html, /Срок действия заказа истёк/);
  assert.match(html, /Проверить оплату/);
});
test("event cards match the event page when the server minPrice is null", async () => {
  const cards = [{ ...event, id: 7, title: "No tickets", minPrice: null }, { ...event, id: 8, title: "Hidden tickets", minPrice: null }, { ...event, id: 9, title: "Priced", minPrice: 2500 }];
  const html = await renderRoute("/", null, [[["events"], page(cards)], [["ticket-types", 7], []], [["ticket-types", 8], [{ id: 1, eventId: 8, name: "Hidden", price: 100, available: 5, hidden: true }]]]);
  assert.match(html, /Билеты не требуются/);
  assert.match(html, /Билеты пока недоступны/);
  assert.match(html, /от 2[\s ]500 ₸/);
});

// ---- Accessibility and SRS gaps (phase 2) ----
test("ConfirmDialog is a labelled alert dialog with verb-first destructive actions", () => {
  const html = renderConfirm({ title: "Отменить заказ №42?", message: "Билеты вернутся в продажу.", confirmLabel: "Отменить заказ", cancelLabel: "Оставить заказ", destructive: true });
  assert.match(html, /role="alertdialog"/);
  const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelledBy);
  assert.match(html, new RegExp(`<h2 id="${labelledBy}"[^>]*>Отменить заказ №42\\?</h2>`));
  assert.match(html, /bg-danger[^>]*>Отменить заказ</);
  assert.match(html, />Оставить заказ</);
  const en = renderConfirm({ title: "T", confirmLabel: "OK" });
  assert.match(en, />Отмена</);
});
test("modal dialogs are labelled by their visible heading", () => {
  const html = renderSuspensionDialog();
  const labelledBy = html.match(/role="dialog"[^>]*aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelledBy);
  assert.match(html, new RegExp(`id="${labelledBy}"[^>]*>Приостановить мероприятие<`));
  assert.equal((html.match(/Приостановить мероприятие</g) ?? []).length, 1);
});
test("no window.confirm and no sub-12px text remain in the app", () => {
  for (const root of ["src/pages", "src/components"]) {
    for (const name of fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith(".tsx"))) {
      const source = fs.readFileSync(path.join(root, name), "utf8");
      assert.doesNotMatch(source, /window\.confirm\(/, name);
      assert.doesNotMatch(source, /text-\[1[01]px\]/, name);
    }
  }
});
test("weekend dates use a colour that passes contrast", () => {
  const html = renderDateStrip();
  assert.doesNotMatch(html, /text-orange-500|text-\[10px\]/);
  assert.match(html, /text-orange-800/);
});
test("the home page has exactly one h1 with or without filters", async () => {
  for (const url of ["/", "/?q=jazz", "/?category=MUSIC&date=2027-12-10"]) {
    const html = await renderRoute(url, null, catalogSeeds);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, url);
  }
});
test("my tickets show event date, time and venue before the calendar menu", async () => {
  const html = (await renderRoute("/account", attendee, [[["my-orders", 0], page([])], [["my-tickets", 0], page([{ id: 5, eventId: 7, eventTitle: "Jazz", ticketTypeName: "Standard", status: "VALID", attendeeEmail: attendee.email, orderId: 42 }])],
    [["event", 7], { ...event, venue: { id: 1, name: "Hall A", address: "Астана, Абая 1" } }]])).replace(/<!-- -->/g, "");
  assert.match(html, /10 декабря 2027, 18:00/);
  assert.match(html, /Hall A, Астана, Абая 1/);
  assert.ok(html.indexOf("Hall A") < html.indexOf("Добавить в календарь"));
  assert.ok(html.indexOf("Билет №5") < html.indexOf("Добавить в календарь"));
});
test("staff check-in focuses the code field and offers optional camera scanning", async () => {
  const html = await renderRoute("/staff", organizer, [
    [["assigned-events"], page([event])],
    [["check-in-stats", 7], { eventId: 7, registered: 0, checkedIn: 0, notCheckedIn: 0 }],
    [["event-attendees", 7, "", 0], page([])],
  ]);
  assert.match(html, /<input[^>]*autofocus=""[^>]*aria-label="Код билета"|<input[^>]*aria-label="Код билета"[^>]*autofocus=""/i);
  assert.match(html, /aria-expanded="false"[^>]*>Сканировать камерой</);
});

// ---- Redesign (phase 3) ----
test("the header groups account and role links in a collapsed, labelled user menu", async () => {
  const html = await renderRoute("/", admin, [...catalogSeeds, [["unread-notifications", admin.id], { unread: 3 }]]);
  assert.match(html, /aria-label="BiletFlow"/);
  const button = html.match(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"/);
  assert.ok(button, "menu button");
  assert.match(html, new RegExp(`id="${button[1]}" hidden=""`));
  for (const href of ["/account", "/account/settings", "/notifications", "/support", "/admin/dashboard", "/admin/users"]) assert.match(html, new RegExp(`href="${href}"`));
  assert.match(html, /aria-label="Уведомления: непрочитанных 3"/);
  const guest = await renderRoute("/", null, catalogSeeds);
  assert.match(guest, />Войти</);
  assert.doesNotMatch(guest, /aria-controls=/);
});
test("category chips have icons and mark the active category without relying on colour", async () => {
  const html = await renderRoute("/?category=MUSIC", null, catalogSeeds);
  const nav = html.match(/<nav aria-label="Категории"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.match(nav, /aria-current="page"[^>]*>(<svg[\s\S]*?<\/svg>)?Музыка/);
  assert.equal((nav.match(/<svg/g) ?? []).length, (nav.match(/<li/g) ?? []).length);
});
test("the hero is an accessible carousel of the next three events with a pause control", async () => {
  const many = [7, 8, 9, 10].map((id, i) => ({ ...event, id, title: `Show ${id}`, startTime: `2027-12-1${i}T18:00:00`, minPrice: 1000 }));
  const html = (await renderRoute("/", null, [[["events"], page(many)]])).replace(/<!-- -->/g, "");
  const hero = html.match(/<section aria-roledescription="карусель"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(hero, /aria-label="Ближайшие события"/);
  assert.match(hero, /<h2[^>]*>Show 7<\/h2>/);
  assert.equal((hero.match(/aria-label="Слайд \d: Show/g) ?? []).length, 3);
  assert.doesNotMatch(hero, /Show 10/);
  assert.match(hero, /aria-current="true"/);
  assert.match(hero, /aria-label="Предыдущее событие"/);
  assert.match(hero, /aria-label="Следующее событие"/);
  assert.match(hero, /aria-pressed="false"[^>]*>Пауза</);
  assert.match(hero, /data-poster-fallback="true"/);
  assert.match(hero, /от 1[\s ]000 ₸/);
});
test("event cards show a date badge, icon rows and a few-left chip from already loaded ticket types", async () => {
  const html = (await renderRoute("/?q=jazz", null, [[["events"], page([{ ...event, title: "Jazz", paidSalesActive: true }])], [["ticket-types", 7], [{ id: 1, eventId: 7, name: "A", price: 3000, available: 4, hidden: false }]]])).replace(/<!-- -->/g, "");
  assert.match(html, /text-lg font-extrabold">10</);
  assert.match(html, /uppercase text-primary-dark">дек/);
  assert.match(html, /Осталось 4/);
  assert.match(html, /от 3[\s ]000 ₸/);
  const plenty = await renderRoute("/?q=jazz", null, [[["events"], page([{ ...event, title: "Jazz", minPrice: 3000 }])]]);
  assert.doesNotMatch(plenty, /Осталось \d/);
});
test("the weekend chip filters by a date range and empty results offer a reset", async () => {
  const html = await renderRoute("/?date=2027-12-11_2027-12-12", null, [[["events"], page([{ ...event, title: "Friday", startTime: "2027-12-10T18:00:00" }, { ...event, id: 8, title: "Saturday", startTime: "2027-12-11T18:00:00" }])]]);
  assert.match(html, /Saturday/);
  assert.doesNotMatch(html, /<h3[^>]*>Friday/);
  assert.match(html, />Выходные</);
  assert.match(html, />Завтра</);
  const empty = await renderRoute("/?q=nothing-matches", null, catalogSeeds);
  assert.match(empty, /Ничего не найдено/);
  assert.match(empty, /<button[^>]*>Сбросить фильтры<\/button>/);
});
test("the event page has a poster header, map links, anchored sections, share, and sticky purchase panels", async () => {
  const seeds = [[["event", 7], { ...event, paidSalesActive: true, description: "About", refundPolicy: "Refunds", venue: { id: 1, name: "Hall A", address: "Астана, Абая 1" } }],
    [["ticket-types", 7], [{ id: 3, eventId: 7, name: "Standard", price: 5000, available: 10, sold: 0, quantity: 10, hidden: false }]]];
  const html = (await renderRoute("/events/7", attendee, seeds)).replace(/<!-- -->/g, "");
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=%D0%90%D1%81%D1%82%D0%B0%D0%BD%D0%B0%2C%20%D0%90%D0%B1%D0%B0%D1%8F%201"/);
  assert.match(html, /href="https:\/\/2gis\.kz\/search\//);
  for (const anchor of ["about", "venue", "refund", "tickets"]) {
    assert.match(html, new RegExp(`href="#${anchor}"`));
    assert.match(html, new RegExp(`id="${anchor}"`));
  }
  assert.match(html, />Поделиться</);
  assert.match(html, /aria-label="Покупка билетов"/);
  assert.equal((html.match(/от 5[\s ]000 ₸/g) ?? []).length >= 2, true, "price in the sticky panel and the mobile bar");
  assert.match(html, /Политика возврата/);
  assert.match(html, /Задать вопрос о событии/);
});
