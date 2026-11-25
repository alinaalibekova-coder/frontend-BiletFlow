import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Bundle the actual TypeScript modules; tests need no browser or live backend.
const bundle = await build({ stdin: { contents: `
  export * as orders from './src/api/orders';
  export { categoryKey, categoryLabel } from './src/lib/format';
  export { posterUrlThroughProxy } from './src/lib/posterUrl';
  export * as sales from './src/api/sales';
  export { registrationState, nextRegistrationBoundary } from './src/lib/registration';
  export * as promo from './src/lib/promo';
  export { looksLikeUrl } from './src/lib/checkInCode';
  export { minPrice, isBuyableNow } from './src/hooks/useEvents';
  export { formatCountdown, holdMilestone, eventVisibleUntil, eventCoversDay, formatTime, dayKey, parseDateFilter, weekendRange, eventOverlapsDays, dateBadge } from './src/lib/format';
  export { summarizeInventory } from './src/lib/salesInventory';
  export * as seating from './src/api/seating';
  export * as platform from './src/api/platform';
  export * as users from './src/api/users';
  export * as auth from './src/api/auth';
  export * as commerce from './src/api/commerce';
  export * as support from './src/api/support';
  export * as notifications from './src/api/notifications';
  export * as events from './src/api/events';
  export * as checkIn from './src/api/checkIn';
  export * as catalog from './src/lib/cities';
  export * as venueForms from './src/lib/venues';
  export * as languageUtils from './src/lib/language';
  export * as pageLanguage from './src/i18n/translateText';
  export * as client from './src/api/client';
  export { startOrderPayment } from './src/lib/checkout';
  export { formatPrice, parseDate, formatLongDate, formatShortDate, weekdayShort, almatyTimestamp } from './src/lib/format';
`, resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
const { parseDateFilter, weekendRange, eventOverlapsDays, dateBadge, looksLikeUrl, nextRegistrationBoundary, promo, minPrice, isBuyableNow, formatCountdown, holdMilestone, eventVisibleUntil, eventCoversDay, formatTime, dayKey, categoryKey, categoryLabel, posterUrlThroughProxy, checkIn, orders, sales, registrationState, summarizeInventory, seating, platform, users, auth, commerce, support, notifications, events, catalog, venueForms, languageUtils, pageLanguage, client, startOrderPayment, formatPrice, parseDate, formatLongDate, formatShortDate, weekdayShort, almatyTimestamp } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

let expected;
let requests;
let scripts;
let bankPayments;
const order = { id: 42, eventId: 7, status: "PENDING", totalAmount: 8000, attendeeName: "Алия", items: [] };
function request(path, method, body, response, status = 200) { expected.push({ path, method, body, response, status }); }

beforeEach(() => {
  expected = []; requests = []; scripts = []; bankPayments = [];
  const storage = new Map([["bf_token", "test-token"]]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.fetch = async (path, options = {}) => {
    const next = expected.shift();
    requests.push(String(path));
    assert.ok(next, `Unexpected request: ${path}`);
    assert.equal(String(path), next.path);
    assert.equal(options.method ?? "GET", next.method);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.deepEqual(options.body === undefined ? undefined : JSON.parse(options.body), next.body);
    return new Response(next.response === undefined ? null : next.response instanceof Blob ? next.response : JSON.stringify(next.response), { status: next.status, headers: { "Content-Type": next.response instanceof Blob ? next.response.type : "application/json" } });
  };
  globalThis.window = { setTimeout, clearTimeout, halyk: { pay: payment => bankPayments.push(payment) } };
  globalThis.document = {
    createElement: () => ({ remove() {} }),
    head: { append: script => { scripts.push(script); queueMicrotask(() => script.onload()); } },
  };
});
afterEach(() => assert.equal(expected.length, 0, "All expected requests must have been made"));

test("category keys combine case, aliases and translated labels without merging unrelated categories", () => {
  for (const value of ["Music","MUSIC"," music ","Музыка"]) assert.equal(categoryKey(value),categoryKey("Music"));
  for (const value of ["Concert","concerts","Концерт","Концерты"]) assert.equal(categoryKey(value),categoryKey("Concert"));
  assert.equal(categoryKey("Technology"),categoryKey("Технологиялар"));
  assert.equal(categoryLabel("Технологиялар","en-GB"),"Technology");
  assert.notEqual(categoryKey("Music"),categoryKey("Music theory"));
  assert.equal(categoryKey("  Custom   Festival  "),categoryKey("custom festival"));
});

test("event posters use the same-origin proxy even when the API names an internal backend", () => {
  assert.equal(posterUrlThroughProxy("http://backend:8080/api/events/7/poster?v=123"),"/api/events/7/poster?v=123");
  assert.equal(posterUrlThroughProxy("https://biletflow.duckdns.org/api/events/7/poster?v=9"),"/api/events/7/poster?v=9");
  assert.equal(posterUrlThroughProxy("/api/events/7/poster"),"/api/events/7/poster");
  assert.equal(posterUrlThroughProxy("/images/local.png"),"/images/local.png");
});

test("catalog traversal includes pages after page 50 and reports an explicit caller limit honestly", async () => {
  for (let page=0;page<51;page++) request(`/api/events?page=${page}&size=1`,"GET",undefined,{ content:[{id:page+1}],number:page,totalPages:51,last:page===50 });
  const all = await events.getAllEvents(1);
  assert.equal(all.content.length,51);
  assert.equal(all.last,true);
  for (let page=0;page<2;page++) request(`/api/events?page=${page}&size=1`,"GET",undefined,{ content:[{id:page+1}],number:page,totalPages:3,last:false });
  const limited = await events.getAllEvents(1,2);
  assert.equal(limited.content.length,2);
  assert.equal(limited.last,false);
});

test("catalog rejects repeated pages and unexpected empty pages rather than silently returning partial results", async () => {
  for (const second of [{ content:[{id:1}],number:0,totalPages:2,last:true },{ content:[],number:1,totalPages:2,last:true }]) {
    request("/api/events?page=0&size=100","GET",undefined,{ content:[{id:1}],number:0,totalPages:2,last:false });
    request("/api/events?page=1&size=100","GET",undefined,second);
    await assert.rejects(events.getAllEvents(),/весь каталог/);
  }
});

test("the catalog loads every page of events instead of stopping at the first 100", async () => {
  const events100 = from => Array.from({ length: 100 }, (_, i) => ({ id: from + i }));
  request("/api/events?page=0&size=100", "GET", undefined, { content: events100(1), totalPages: 3, number: 0, last: false });
  request("/api/events?page=1&size=100", "GET", undefined, { content: events100(101), totalPages: 3, number: 1, last: false });
  request("/api/events?page=2&size=100", "GET", undefined, { content: [{ id: 201 }], totalPages: 3, number: 2, last: true });
  const all = await events.getAllEvents();
  assert.equal(all.content.length, 201);
  assert.equal(all.content.at(-1).id, 201);
  request("/api/events?page=0&size=100", "GET", undefined, { content: [{ id: 1 }], totalPages: 1, number: 0, last: true });
  assert.equal((await events.getAllEvents()).content.length, 1);
});
test("ordinary authenticated 403 preserves the token, including suspension words without a machine code", async () => {
  const messages = [];
  const unsubscribe = client.onAuthFailure(message => messages.push(message));
  try {
    request("/api/events/7", "GET", undefined, { message: "Нет доступа" }, 403);
    await assert.rejects(events.getEvent(7), e => e.status === 403);
    request("/api/events/7/calendar.ics", "GET", undefined, { message: "Account suspended" }, 403);
    await assert.rejects(platform.downloadCalendar(7), e => e.status === 403);
    assert.equal(client.getToken(), "test-token");
    assert.deepEqual(messages, []);
    request("/api/events/7", "GET", undefined, { message: "Token expired" }, 401);
    await assert.rejects(events.getEvent(7), e => e.status === 401);
    assert.equal(client.getToken(), null);
    assert.deepEqual(messages, ["Token expired"]);
  } finally { unsubscribe(); }
});

test("an old unauthorized response cannot clear a newly adopted token", async () => {
  const originalFetch = globalThis.fetch;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async (...args) => { const response = await originalFetch(...args); await gate; return response; };
  request("/api/events/7", "GET", undefined, { message: "Expired" }, 401);
  const pending = events.getEvent(7);
  client.saveToken("new-token");
  release();
  await assert.rejects(pending, e => e.status === 401);
  assert.equal(client.getToken(), "new-token");
});

test("checkout rejects arbitrary scripts, lookalike Halyk hosts, nonstandard ports and URL suffixes", async () => {
  for (const scriptUrl of ["https://evil.example/payform/payment-api.js", "https://epay.homebank.kz.evil.example/payform/payment-api.js", "https://epay.homebank.kz@evil.example/payform/payment-api.js", "https://epay.homebank.kz:444/payform/payment-api.js", "https://epay.homebank.kz/payform/payment-api.js?override=1", "https://epay.homebank.kz/another.js", "http://epay.homebank.kz/payform/payment-api.js"]) {
    request("/api/orders/42/payment-session", "POST", undefined, { provider: "HALYK", scriptUrl, payment: {} });
    await assert.rejects(startOrderPayment(order, () => {}), /не разрешён/);
  }
  assert.equal(scripts.length,0);
  assert.equal(bankPayments.length,0);
});

test("registration boundaries use Kazakhstan time regardless of browser timezone", () => {
  const event = { startTime: "2027-01-01T18:00:00", registrationOpeningTime: "2027-01-01T10:00:00", registrationClosingTime: "2027-01-01T17:00:00" };
  assert.equal(registrationState(event, Date.parse("2027-01-01T04:59:59Z")), "not-open");
  assert.equal(registrationState(event, Date.parse("2027-01-01T05:00:00Z")), "open");
  assert.equal(registrationState(event, Date.parse("2027-01-01T12:00:01Z")), "closed");
  assert.equal(registrationState(event, Date.parse("2027-01-01T13:00:00Z")), "started");
  assert.equal(registrationState({ startTime: event.startTime }, Date.parse("2027-01-01T11:00:00Z")), "open");
});

test("inventory totals use server remaining counts and a capacity-weighted percentage; unknown is not zero", () => {
  assert.deepEqual(summarizeInventory([{ capacity:100,ticketsSold:50,ticketsRemaining:12 },{ capacity:300,ticketsSold:30,ticketsRemaining:100 }]), { capacity:400,ticketsRemaining:112,percentSold:20 });
  assert.deepEqual(summarizeInventory([{ capacity:null,ticketsSold:50,ticketsRemaining:null }]), { capacity:null,ticketsRemaining:null,percentSold:null });
  assert.equal(summarizeInventory([{ capacity:0,ticketsSold:0,ticketsRemaining:0 }]).percentSold,null);
});

test("sales filters use the supported date and ticket-type parameters while default requests stay unchanged", async () => {
  request("/api/organizer/events/7/sales?from=2026-11-01&to=2026-11-23&ticketTypeId=4", "GET", undefined, { salesByDay: [], ticketsRemaining:12,percentSold:50 });
  assert.equal((await sales.getEventSales(7,{ from:"2026-11-01",to:"2026-11-23",ticketTypeId:4 })).ticketsRemaining,12);
  request("/api/organizer/events/7/sales", "GET", undefined, { salesByDay: [] });
  await sales.getEventSales(7);
});

test("calendar links and calendar downloads use authenticated API requests", async () => {
  request("/api/events/7/calendar", "GET", undefined, { cancelled: false, googleCalendarUrl: "https://calendar.google.com/calendar/render" });
  assert.equal((await platform.getCalendar(7)).cancelled, false);
  request("/api/events/7/calendar.ics", "GET", undefined, new Blob(["BEGIN:VCALENDAR"], { type: "text/calendar" }));
  assert.equal(await (await platform.downloadCalendar(7)).text(), "BEGIN:VCALENDAR");
});
test("event report submission preserves duplicate-report errors and review is separate from suspension", async () => {
  request("/api/events/7/reports", "POST", { reason: "FRAUD", message: "Evidence" }, { id: 4, status: "OPEN" }, 201);
  assert.equal((await platform.reportEvent(7, "FRAUD", "Evidence")).status, "OPEN");
  request("/api/events/7/reports", "POST", { reason: "OTHER" }, { message: "You already have an open report" }, 409);
  await assert.rejects(platform.reportEvent(7,"OTHER"), e => e.status === 409 && e.message.includes("already"));
  request("/api/events/7/reports", "POST", { reason: "OTHER" }, undefined, 409);
  await assert.rejects(platform.reportEvent(7,"OTHER"), e => e.status === 409 && !/пользователь/.test(e.message) && /Обновите страницу/.test(e.message)
    && pageLanguage.translateText("en", e.message).startsWith("The action could not be completed")
    && pageLanguage.translateText("kk", e.message).startsWith("Әрекет орындалмады"));
  request("/api/admin/event-reports?status=OPEN&page=0", "GET", undefined, { content: [] });
  await platform.getReports({ status: "OPEN", page: 0 });
  request("/api/admin/event-reports/4", "GET", undefined, { id: 4 });
  await platform.getReport(4);
  request("/api/admin/event-reports/4/review", "POST", { outcome: "ACTIONED", note: "Reviewed" }, { id: 4, status: "ACTIONED" });
  await platform.reviewReport(4, "ACTIONED", "Reviewed");
});
test("platform search encodes filters, settings use fee fields, and CSV stays authenticated", async () => {
  request("/api/admin/overview", "GET", undefined, { openEventReports: 2 });
  assert.equal((await platform.getOverview()).openEventReports, 2);
  request("/api/admin/payments?q=A%26B&status=FAILED&page=0", "GET", undefined, { content: [] });
  await platform.searchAdmin("payments", { q: "A&B", status: "FAILED", page: 0, provider: "" });
  for (const resource of ["events", "orders", "refunds", "campaigns"]) {
    request(`/api/admin/${resource}?page=1`, "GET", undefined, { content: [] });
    await platform.searchAdmin(resource, { page: 1 });
  }
  request("/api/admin/settings", "GET", undefined, { activationFeeKzt: 5000, processingFeePercent: 2 });
  await platform.getSettings();
  request("/api/admin/settings", "PUT", { activationFeeKzt: 4500, processingFeePercent: 1.5 }, {});
  await platform.updateSettings({ activationFeeKzt: 4500, processingFeePercent: 1.5 });
  request("/api/admin/reports/payments.csv?from=2026-11-01&to=2026-11-23", "GET", undefined, new Blob(["id,amount\n1,100"], { type: "text/csv" }));
  assert.match(await (await platform.downloadCsv("payments", { from: "2026-11-01", to: "2026-11-23" })).text(), /1,100/);
});
test("payout lists, details and moderation use organizer and admin contracts", async () => {
  request("/api/organizer/payouts?status=ON_HOLD", "GET", undefined, { content: [] });
  await platform.getPayouts(false, { status: "ON_HOLD" });
  request("/api/organizer/events/7/payout", "GET", undefined, { simulated: true, amount: 99 });
  assert.equal((await platform.getEventPayout(7)).simulated, true);
  request("/api/admin/payouts?q=Jazz", "GET", undefined, { content: [] });
  await platform.getPayouts(true, { q: "Jazz" });
  request("/api/admin/payouts/3", "GET", undefined, { id: 3 });
  await platform.getPayout(3);
  request("/api/admin/payouts/3/hold", "POST", { reason: "Review" }, {});
  await platform.changePayout(3, "hold", "Review");
  for (const action of ["release", "pay-now"]) {
    request(`/api/admin/payouts/3/${action}`, "POST", undefined, {});
    await platform.changePayout(3, action);
  }
});
test("seating setup omits venue capacity for layouts and unlinks sections with null", async () => {
  const venue = venueForms.prepareVenueRequest({ cityId: "astana", name: "Hall", address: "Abay 1", capacity: "", seatingLayout: "concert-hall" });
  assert.equal(venue.seatingLayout, "concert-hall");
  assert.equal("capacity" in venue, false);
  request("/api/venues", "POST", venue, { id: 2, ...venue });
  await events.createVenue(venue);
  request("/api/venues/seating-layouts", "GET", undefined, [{ key: "arena", capacity: 16000 }]);
  await seating.getSeatingLayouts();
  request("/api/venues/2/seating-layout", "PUT", { seatingLayout: null }, {});
  await seating.setVenueLayout(2, null);
  request("/api/events/7/seating", "GET", undefined, { sections: [] });
  await seating.getSeating(7);
  request("/api/events/7/seating", "PUT", { mode: "ASSIGNED" }, { seatingMode: "ASSIGNED" });
  await seating.setSeatingMode(7, "ASSIGNED");
  request("/api/events/7/seating/sections/2", "PUT", { ticketTypeId: null }, {});
  await seating.assignSection(7, 2, null);
  request("/api/events/7/seating/seats", "PUT", { seatIds: [5, 6], blocked: true }, {});
  await seating.setSeatsBlocked(7, [5, 6], true);
});
test("user search and suspension keep backend field names", async () => {
  request("/api/users?page=0&size=20&q=A%26B&role=ATTENDEE&suspended=true", "GET", undefined, { content: [] });
  await users.getUsers(0,20,{ q: "A&B", role: "ATTENDEE", suspended: "true" });
  request("/api/users/3/suspend", "POST", { reason: "Review" }, {});
  await users.setUserSuspended(3,true,"Review");
  request("/api/users/3/unsuspend", "POST", undefined, {});
  await users.setUserSuspended(3,false);
});
test("explicit account suspension signs out and preserves its reason for JSON and blob calls", async () => {
  const messages = [];
  const unsubscribe = client.onAuthFailure(message => messages.push(message));
  try {
    request("/api/events/7", "GET", undefined, { code: "ACCOUNT_SUSPENDED", message: "Account suspended: review" }, 403);
    await assert.rejects(events.getEvent(7), e => e.status === 403);
    assert.equal(client.getToken(), null);
    assert.deepEqual(messages, ["Account suspended: review"]);
    client.saveToken("test-token");
    request("/api/events/7/calendar.ics", "GET", undefined, { error: { code: "ACCOUNT_SUSPENDED", message: "Account suspended" } }, 403);
    await assert.rejects(platform.downloadCalendar(7));
    assert.equal(client.getToken(), null);
    assert.equal(messages.length, 2);
  } finally { unsubscribe(); }
});
test("comma-separated backend errors are never rewritten as Russian date templates", () => {
  for (const language of ["ru", "en", "kk"]) {
    for (const message of ["North stand, sector 1", "This seat is no longer available: North stand, sector 1, row 3, seat 7"]) {
      assert.equal(pageLanguage.translateText(language, message), message);
    }
  }
});

test("English backend error messages are shown in Russian and Kazakh, keeping their details", () => {
  const cases = [
    ["Event not found with id: 7", "Событие №7 не найдено.", "№7 іс-шара табылмады."],
    ["Sales of 'VIP' have ended", "Продажи билетов «VIP» завершены.", "«VIP» билеттерін сату аяқталды."],
    ["This promo code has expired", "Срок действия промокода истёк.", "Промокодтың мерзімі өтті."],
    ["This seat is no longer available: North stand, row 3, seat 7. Please pick other seats.", "Это место больше недоступно: North stand, row 3, seat 7. Выберите другие места.", "Бұл орын енді қолжетімсіз: North stand, row 3, seat 7. Басқа орындарды таңдаңыз."],
    ["This account has been suspended: Fraud", "Этот аккаунт приостановлен. Причина: Fraud", "Бұл аккаунт уақытша тоқтатылған. Себебі: Fraud"],
  ];
  for (const [english, russian, kazakh] of cases) {
    assert.equal(pageLanguage.translateText("en", english), english);
    assert.equal(pageLanguage.translateText("ru", english), russian);
    assert.equal(pageLanguage.translateText("kk", english), kazakh);
  }
});
test("a short template such as '{0} at {1}' never takes over a longer message containing 'at'", () => {
  assert.equal(pageLanguage.translateText("ru", "A report can cover at most 31 days"), "Отчёт может охватывать не более 31 дней.");
  assert.equal(pageLanguage.translateText("ru", "You can choose at most 7 seats in one order."), "В одном заказе можно выбрать не больше 7 мест.");
  assert.equal(pageLanguage.translateText("kk", "10 December at 18:00"), "10 December күні 18:00");
});
test("checkout sends attendee name and the server promo code; quote never creates an order", async () => {
  const items = [{ ticketTypeId: 3, quantity: 2 }];
  request("/api/orders/quote", "POST", { eventId: 7, items, promoCode: "JAZZ2026" }, { subtotalAmount: 10000, discountAmount: 2000, totalAmount: 8000, promoCode: "JAZZ2026" });
  assert.equal((await orders.quoteOrder(7, items, "JAZZ2026")).totalAmount, 8000);
  request("/api/orders", "POST", { eventId: 7, items, attendeeName: "Алия", promoCode: "JAZZ2026" }, order, 201);
  assert.equal((await orders.createOrder(7, items, { attendeeName: "Алия", promoCode: "JAZZ2026" })).attendeeName, "Алия");
});
test("server discount amounts retain fractional tenge", () => {
  assert.equal(formatPrice(999.5), "999,5 ₸");
});
test("form date-time values are read as Kazakhstan time whatever the browser time zone", () => {
  assert.equal(almatyTimestamp("2026-12-10T18:00"), Date.UTC(2026, 11, 10, 13, 0));
  assert.equal(almatyTimestamp("2026-12-10T18:00:00"), Date.UTC(2026, 11, 10, 13, 0));
  assert.equal(almatyTimestamp("2027-01-01T00:30"), Date.UTC(2026, 11, 31, 19, 30));
});
test("daily sales dates and event timestamps both use Kazakhstan time", () => {
  assert.equal(parseDate("2026-11-13").toISOString(), "2026-11-12T19:00:00.000Z");
  assert.match(formatLongDate("2026-11-13"), /13 ноября 2026/);
  assert.equal(parseDate("2026-11-13T12:30:00").toISOString(), "2026-11-13T07:30:00.000Z");
  assert.equal(parseDate("2026-11-13T12:30:00Z").toISOString(), "2026-11-13T12:30:00.000Z");
  assert.equal(parseDate("2026-11-13T12:30:00+05:00").toISOString(), "2026-11-13T07:30:00.000Z");
});

test("Halyk checkout launches the bank script without calling /pay", async () => {
  const session = { provider: "HALYK", simulated: true, scriptUrl: "https://test-epay.epayment.kz/payform/payment-api.js", payment: { invoiceId: "invoice-42" } };
  request("/api/orders/42/payment-session", "POST", undefined, session);
  let received;
  assert.equal(await startOrderPayment(order, value => { received = value; }), undefined);
  assert.deepEqual(received, session);
  assert.equal(scripts[0].src, session.scriptUrl);
  assert.deepEqual(bankPayments, [session.payment]);
  assert.deepEqual(requests, ["/api/orders/42/payment-session"]);
});

test("simulated checkout opens a session before paying and returns only backend status", async () => {
  request("/api/orders/42/payment-session", "POST", undefined, { provider: "SIMULATED", simulated: true, scriptUrl: null, payment: null });
  request("/api/orders/42/pay", "POST", undefined, { ...order, status: "PAID" });
  assert.equal((await startOrderPayment(order, () => {})).status, "PAID");
  assert.equal(bankPayments.length, 0);
});

test("free pending orders confirm without opening a bank session", async () => {
  request("/api/orders/42/pay", "POST", undefined, { ...order, totalAmount: 0, status: "PAID" });
  assert.equal((await startOrderPayment({ ...order, totalAmount: 0 }, () => assert.fail("No paid session for free orders"))).status, "PAID");
});

test("a declined payment preserves the error and can be retried", async () => {
  request("/api/orders/42/pay", "POST", { simulatedOutcome: "DECLINED" }, { message: "Bank declined" }, 402);
  await assert.rejects(orders.payOrder(42, "DECLINED"), error => error instanceof client.ApiError && error.status === 402 && error.message === "Bank declined");
  request("/api/orders/42/pay", "POST", undefined, { ...order, status: "PAID" });
  assert.equal((await orders.payOrder(42)).status, "PAID");
});

test("bank result comes from payment-check and may remain pending", async () => {
  request("/api/orders/42/payment-check", "POST", undefined, order);
  assert.equal((await orders.checkPayment(42)).status, "PENDING");
  request("/api/orders/42/payment-check", "POST", undefined, { ...order, status: "PAID" });
  assert.equal((await orders.checkPayment(42)).status, "PAID");
  request("/api/orders/42/payments", "GET", undefined, [{ status: "FAILED", failureReason: "Declined", simulated: true }]);
  assert.equal((await orders.getPayments(42))[0].failureReason, "Declined");
});

test("unknown providers and malformed bank sessions never fall back to simulated pay", async () => {
  for (const session of [{ provider: "OTHER" }, { provider: "HALYK", scriptUrl: "http://bank.example/x.js", payment: {} }, { provider: "HALYK", scriptUrl: null, payment: null }]) {
    request("/api/orders/42/payment-session", "POST", undefined, session);
    await assert.rejects(startOrderPayment(order, () => {}));
  }
  assert.equal(bankPayments.length, 0);
});

test("bank script loading failure is recoverable", async () => {
  document.head.append = script => queueMicrotask(() => script.onerror());
  const session = { provider: "HALYK", scriptUrl: "https://epay.homebank.kz/payform/payment-api.js", payment: {} };
  request("/api/orders/42/payment-session", "POST", undefined, session);
  await assert.rejects(startOrderPayment(order, () => {}), /Не удалось загрузить/);
  document.head.append = script => queueMicrotask(() => script.onload());
  request("/api/orders/42/payment-session", "POST", undefined, session);
  await startOrderPayment(order, () => {});
  assert.equal(bankPayments.length, 1);
});

test("PDF and campaign QR use authenticated binary responses", async () => {
  request("/api/tickets/5/pdf", "GET", undefined, new Blob(["%PDF-test"], { type: "application/pdf" }));
  assert.equal(await (await orders.getTicketPdf(5)).text(), "%PDF-test");
  request("/api/events/7/campaigns/2/qr", "GET", undefined, new Blob(["png"], { type: "image/png" }));
  assert.equal((await commerce.getCampaignQr(7, 2)).type, "image/png");
});

test("promo tokens are encoded, and campaign creation uses the backend enum and restrictions", async () => {
  request("/api/events/7/promo?token=opaque%2Btoken", "GET", undefined, { code: "JAZZ2026" });
  assert.equal((await commerce.previewPromo(7, "opaque+token", true)).code, "JAZZ2026");
  const body = { name: "Jazz", discountType: "PERCENT", discountValue: 20, maxRedemptions: 10, ticketTypeIds: [3] };
  request("/api/events/7/campaigns", "POST", body, { id: 2 });
  await commerce.createCampaign(7, body);
  request("/api/events/7/campaigns/2/disable", "POST", undefined, {});
  await commerce.setCampaignEnabled(7, 2, false);
});

test("auth email flows handle empty 204 responses and reset uses newPassword", async () => {
  request("/api/auth/forgot-password", "POST", { email: "unknown@example.com" }, undefined, 204);
  assert.equal(await auth.forgotPassword("unknown@example.com"), undefined);
  request("/api/auth/resend-verification", "POST", { email: "person@example.com" }, undefined, 204);
  await auth.resendVerification("person@example.com");
  request("/api/auth/verify-email", "POST", { token: "one-use-token" }, undefined, 204);
  await auth.verifyEmail("one-use-token");
  request("/api/auth/reset-password", "POST", { token: "reset-token", newPassword: "NewPassword123" }, undefined, 204);
  await auth.resetPassword("reset-token", "NewPassword123");
});

test("notifications use the unread field and support one/all read operations", async () => {
  request("/api/notifications/unread-count", "GET", undefined, { unread: 3 });
  assert.equal((await notifications.getUnreadCount()).unread, 3);
  request("/api/notifications/8/read", "POST", undefined, { id: 8 });
  await notifications.markNotificationRead(8);
  request("/api/notifications/read-all", "POST", undefined, undefined, 204);
  await notifications.markAllNotificationsRead();
});

test("support sends thread body, assignment, status and escalation in their exact shapes", async () => {
  const body = { type: "ATTENDEE", category: "PAYMENT", subject: "Payment issue", message: "Help", orderId: 42 };
  request("/api/support/cases", "POST", body, { supportCase: { id: 3 }, messages: [] }, 201);
  assert.equal((await support.openSupportCase(body)).supportCase.id, 3);
  request("/api/support/cases/3/messages", "POST", { body: "Reply" }, {});
  await support.replyToCase(3, "Reply");
  request("/api/support/cases/3/assign", "POST", { email: "staff@example.com" }, {});
  await support.assignCase(3, "staff@example.com");
  request("/api/support/cases/3/status", "POST", { status: "WAITING_FOR_CUSTOMER" }, {});
  await support.setCaseStatus(3, "WAITING_FOR_CUSTOMER");
  request("/api/support/cases/3/escalate", "POST", undefined, {});
  await support.escalateCase(3);
  request("/api/support/cases?page=1&size=20&status=OPEN&escalated=true", "GET", undefined, { content: [] });
  await support.getSupportCases("OPEN", true, 1);
});

test("paid-sales suspension is distinct from whole-event suspension; optional status is omitted", async () => {
  request("/api/admin/paid-sales-activations?page=0&size=20", "GET", undefined, { content: [] });
  await commerce.getActivations();
  request("/api/events/7/activation/suspend", "POST", { reason: "Review required" }, { status: "SUSPENDED" });
  assert.equal((await commerce.activationAction(7, "suspend", "Review required")).status, "SUSPENDED");
  request("/api/events/7/activation/unsuspend", "POST", undefined, { status: "ACTIVE" });
  await commerce.activationAction(7, "unsuspend");
});

test("payout and verification requests match organizer/admin contracts", async () => {
  const body = { bankName: "Bank", accountHolder: "Organizer", iban: "KZ123456789012345678" };
  request("/api/organizers/profile/payout-account", "PUT", body, { ibanLast4: "5678", simulated: true });
  assert.equal((await commerce.savePayoutAccount(body)).ibanLast4, "5678");
  request("/api/organizers/profile/verification", "POST", undefined, { verificationStatus: "PENDING" });
  await commerce.requestVerification();
  request("/api/organizers/4/verification", "POST", { approved: false, note: "Need information" }, {});
  await commerce.reviewVerification(4, false, "Need information");
});
test("event moderation sends the reason and preserves errors for a retry", async () => {
  request("/api/events/1/suspend", "POST", { reason: "Проверка мероприятия" }, { message: "Нет доступа" }, 403);
  await assert.rejects(events.setEventSuspended(1, true, "Проверка мероприятия"), error => error instanceof client.ApiError && error.status === 403 && error.message === "Нет доступа");
  assert.equal(client.getToken(), "test-token");
  request("/api/events/1/suspend", "POST", { reason: "Проверка мероприятия" }, { id: 1, suspended: true, suspensionReason: "Проверка мероприятия" });
  assert.equal((await events.setEventSuspended(1, true, "Проверка мероприятия")).suspended, true);
  request("/api/events/1/unsuspend", "POST", undefined, { id: 1, suspended: false });
  assert.equal((await events.setEventSuspended(1, false)).suspended, false);
});
test("city recognition handles venue address languages without guessing missing cities", () => {
  assert.equal(catalog.venueCity({ address: "Demo street 1, Astana" }), "astana");
  assert.equal(catalog.venueCity({ address: "г. Алматы, пр. Абая, 1" }), "almaty");
  assert.equal(catalog.venueCity({ address: "Қазақстан, Қарағанды" }), "karaganda");
  assert.equal(catalog.venueCity({ address: "Nur-Sultan, test street" }), "astana");
  assert.equal(catalog.venueCity({ address: "Almatyland street, unknown city" }), null);
  assert.equal(catalog.venueCity({ address: "тестовый адрес, 1" }), null);
  assert.equal(catalog.venueCity(undefined), null);
  assert.equal(catalog.cityLabel("astana", "en"), "Astana");
});
test("catalog links preserve combined filters and language without auth tokens", () => {
  const params = catalog.catalogParams(new URLSearchParams("city=astana&lang=kk&q=jazz&date=2027-12-10&category=Music&promo=campaign&token=secret&status=success"));
  assert.equal(params.get("city"), "astana");
  assert.equal(params.get("lang"), "kk");
  assert.equal(params.get("q"), "jazz");
  assert.equal(params.get("promo"), "campaign");
  assert.equal(params.has("token"), false);
  assert.equal(params.has("status"), false);
});
test("all home language dictionaries have translations and interpolate search text", () => {
  for (const language of ["ru", "kk", "en"]) {
    assert.ok(Object.values(languageUtils.translations[language]).every(value => typeof value === "string" && value.length > 0));
    assert.match(languageUtils.translate(language, "searchResults", { query: "Jazz" }), /Jazz/);
  }
  assert.equal(languageUtils.translate("en", "allCities"), "All cities");
  assert.equal(languageUtils.translate("kk", "allCities"), "Барлық қалалар");
});
test("Kazakh month and weekday names are independent of browser locale support", () => {
  assert.equal(formatShortDate("2026-11-13T18:00:00", "kk-KZ"), "13 қараша");
  assert.equal(formatLongDate("2026-11-13", "kk-KZ"), "13 қараша 2026");
  assert.equal(weekdayShort(parseDate("2026-11-13"), "kk-KZ"), "Жм");
  assert.equal(formatPrice(5000.5, "kk-KZ"), "5\u00a0000,5 ₸");
});
test("page translations preserve substitutions, whitespace and unknown server messages", () => {
  assert.equal(pageLanguage.translateText("en", "Добавить билет {0}", ["VIP"]), "Add a VIP ticket");
  assert.equal(pageLanguage.translateText("kk", " Итого: "), " Барлығы: ");
  assert.equal(pageLanguage.translateText("en", "Вместимость события не может превышать вместимость площадки (100)."), "Event capacity cannot exceed venue capacity (100).");
  assert.equal(pageLanguage.translateText("kk", "Event capacity cannot exceed venue capacity (100)."), "Іс-шара сыйымдылығы өтетін орын сыйымдылығынан (100) аспауы керек.");
  assert.equal(pageLanguage.translateText("kk", "Unrecognized server message"), "Unrecognized server message");
  assert.equal(pageLanguage.translateStatus("en", "PUBLISHED"), "Published");
  assert.equal(pageLanguage.translateStatus("kk", "VALID"), "Жарамды");
});
test("separate venue city and street fields survive the current API round trip", async () => {
  const body = venueForms.prepareVenueRequest({ name: " New hall ", cityId: "astana", address: "  ул. Алматы, 10 ", capacity: "200" });
  assert.deepEqual(body, { name: "New hall", address: "Астана, ул. Алматы, 10", capacity: 200 });
  request("/api/venues", "POST", body, { id: 91, ...body }, 201);
  const saved = await events.createVenue(body);
  assert.equal(catalog.venueCity(saved), "astana");
  assert.equal(venueForms.venuesInCity([saved], "astana")[0].id, 91);
  assert.equal(venueForms.venuesInCity([saved], "almaty").length, 0);
});
test("venue creation requires a known city and rejects mismatched city prefixes", () => {
  const valid = { name: "Hall", cityId: "almaty", address: "Abay street 1", capacity: 100 };
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, cityId: "" }), /Выберите город площадки/);
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, cityId: "unknown" }), /Выберите город площадки/);
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, address: "Астана, Abay street 1" }), /не совпадает/);
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, address: " " }), /Укажите название/);
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, capacity: 0 }), /Укажите название/);
  assert.throws(() => venueForms.prepareVenueRequest({ ...valid, address: "x".repeat(300) }), /300 символов/);
  assert.equal(venueForms.prepareVenueRequest({ ...valid, address: "г. Алматы, Abay street 1" }).address, "г. Алматы, Abay street 1");
});
test("event venue validation blocks another city's venue but retains the current legacy venue", () => {
  const venue = { id: 1, name: "Hall", address: "Astana", capacity: 100 };
  assert.doesNotThrow(() => venueForms.validateEventVenue("astana", venue));
  assert.throws(() => venueForms.validateEventVenue("almaty", venue), /Выберите площадку/);
  assert.throws(() => venueForms.validateEventVenue("", venue), /Выберите город события/);
  assert.throws(() => venueForms.validateEventVenue("astana", undefined), /Выберите площадку/);
  const legacy = { ...venue, address: "Unknown street" };
  assert.doesNotThrow(() => venueForms.validateEventVenue("unknown", legacy, 1));
  assert.throws(() => venueForms.validateEventVenue("unknown", legacy, 2), /Выберите город события/);
  assert.throws(() => venueForms.validateEventVenue("unknown", undefined), /Выберите город события/);
});

test("assigned seating loads the seat map and orders picked seats by seatIds next to standing items", async () => {
  request("/api/events/10/seat-map", "GET", undefined, { eventId: 10, seatingMode: "ASSIGNED", sections: [{ id: 3, kind: "SEATED", ticketTypeId: 14 }, { id: 1, kind: "STANDING", ticketTypeId: 13 }] });
  assert.equal((await seating.getSeatMap(10)).sections[0].kind, "SEATED");
  request("/api/events/10/seat-map/sections/3", "GET", undefined, { section: { id: 3 }, seats: [{ id: 1001, row: "1", number: 1, status: "AVAILABLE" }] });
  assert.equal((await seating.getSectionSeats(10, 3)).seats[0].id, 1001);
  const standing = [{ ticketTypeId: 13, quantity: 1 }];
  request("/api/orders/quote", "POST", { eventId: 10, items: standing, seatIds: [1001, 1002] }, { subtotalAmount: 36000, discountAmount: 0, totalAmount: 36000 });
  assert.equal((await orders.quoteOrder(10, standing, undefined, [1001, 1002])).totalAmount, 36000);
  request("/api/orders", "POST", { eventId: 10, items: [], seatIds: [1001] }, { ...order, eventId: 10 }, 201);
  await orders.createOrder(10, [], { seatIds: [1001] });
  // No seats picked: the request body stays exactly as for general admission.
  request("/api/orders", "POST", { eventId: 10, items: standing }, { ...order, eventId: 10 }, 201);
  await orders.createOrder(10, standing, { seatIds: [] });
});
test("becoming an organizer sends contact information and returns the new organizer token", async () => {
  request("/api/organizers/profile", "POST", { contactInformation: "+7 700 000 00 00" }, { profile: { id: 9, userId: 4, contactInformation: "+7 700 000 00 00", verificationStatus: "UNVERIFIED" }, accessToken: "organizer-token" }, 201);
  const created = await events.createOrganizerProfile("+7 700 000 00 00");
  assert.equal(created.accessToken, "organizer-token");
  assert.equal(created.profile.verificationStatus, "UNVERIFIED");
});

test("check-in scans send the ticket code and undo returns the updated ticket", async () => {
  request("/api/check-in/events/7/scan", "POST", { code: "T-1" }, { result: "ALREADY_USED", message: "Already used", checkedInAt: "2026-11-22T00:47:00", ticket: { id: 5, status: "USED" } });
  const scanned = await checkIn.scanEventTicket(7, "T-1");
  assert.equal(scanned.result, "ALREADY_USED");
  assert.equal(scanned.ticket.id, 5);
  request("/api/check-in/events/7/tickets/5/undo", "POST", undefined, { id: 5, status: "VALID" });
  assert.equal((await checkIn.undoEventCheckIn(7, 5)).status, "VALID");
});

// ---- Review fixes (phase 1) ----
test("a stale stored promo that another event rejects never blocks checkout and is consumed", () => {
  const stored = { value: "CAMPAIGN-A", token: true, source: "stored" };
  const rejected = { data: undefined, error: new client.ApiError(400, "Promo code not found", "PROMO_CODE_INVALID"), isFetching: false };
  assert.equal(promo.promoAllowsCheckout(stored, rejected), true);
  assert.equal(promo.promoAllowsCheckout(stored, { data: undefined, error: null, isFetching: true }), true);
  assert.equal(promo.appliedPromoCode(stored, rejected), undefined);
  assert.equal(promo.shouldDropStoredPromo(stored, rejected.error), true);
  // A network failure says nothing about the promo itself: keep it, but still do not block.
  assert.equal(promo.shouldDropStoredPromo(stored, new client.ApiError(0, "offline")), false);
  assert.equal(promo.appliedPromoCode(stored, { data: { code: "SPRING" }, error: null, isFetching: false }), "SPRING");
});
test("a promo from the event link or typed by the attendee must be valid before checkout", () => {
  const rejected = { data: undefined, error: new client.ApiError(400, "Promo code not found"), isFetching: false };
  for (const source of ["url", "typed"]) {
    const chosen = { value: "BAD", token: source === "url", source };
    assert.equal(promo.promoAllowsCheckout(chosen, rejected), false);
    assert.equal(promo.shouldDropStoredPromo(chosen, rejected.error), false);
    assert.equal(promo.promoAllowsCheckout(chosen, { data: { code: "BAD" }, error: null, isFetching: false }), true);
  }
  assert.equal(promo.promoAllowsCheckout({ value: "", token: false, source: "typed" }, rejected), true);
});
test("a non-JSON success response becomes a friendly localized ApiError", async () => {
  globalThis.fetch = async (path, options = {}) => { assert.equal(options.headers.Authorization, "Bearer test-token"); return new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } }); };
  await assert.rejects(events.getEvent(7), e => e instanceof client.ApiError && e.code === "INVALID_RESPONSE" && /неожиданный ответ/.test(e.message)
    && pageLanguage.translateText("en", e.message).startsWith("The server sent an unexpected response")
    && pageLanguage.translateText("kk", e.message).startsWith("Сервер күтпеген"));
});
test("a 401 for a token another tab already replaced asks the app to re-read the saved token", async () => {
  let changes = 0, failures = 0;
  const stopChange = client.onStoredTokenChange(() => { changes++; });
  const stopFailure = client.onAuthFailure(() => { failures++; });
  try {
    globalThis.fetch = async () => { localStorage.setItem("bf_token", "other-tab-token"); return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }); };
    await assert.rejects(events.getEvent(7), e => e.status === 401);
    assert.equal(changes, 1);
    assert.equal(failures, 0);
    assert.equal(localStorage.getItem("bf_token"), "other-tab-token");
    // The same token still saved: this tab's own session ended, so it signs out.
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
    await assert.rejects(events.getEvent(7), e => e.status === 401);
    assert.equal(failures, 1);
    assert.equal(localStorage.getItem("bf_token"), null);
  } finally { stopChange(); stopFailure(); }
});
test("hold countdown formatting and screen-reader milestones", () => {
  assert.equal(formatCountdown(299_001), "05:00");
  assert.equal(formatCountdown(61_000), "01:01");
  assert.equal(formatCountdown(-5), "00:00");
  assert.equal(holdMilestone(600_000), null);
  assert.equal(holdMilestone(300_000), "5min");
  assert.equal(holdMilestone(59_000), "1min");
  assert.equal(holdMilestone(0), "expired");
});
test("events without an end time stay listed until the end of their Almaty start day; dates match the whole span", () => {
  assert.equal(eventVisibleUntil({ startTime: "2026-11-25T19:00:00" }), Date.parse("2026-11-25T23:59:59.999+05:00"));
  assert.equal(eventVisibleUntil({ startTime: "2026-11-25T19:00:00", endTime: "2026-11-25T21:00:00" }), Date.parse("2026-11-25T21:00:00+05:00"));
  const festival = { startTime: "2026-11-25T10:00:00", endTime: "2026-11-27T22:00:00" };
  assert.equal(eventCoversDay(festival, "2026-11-24"), false);
  assert.equal(eventCoversDay(festival, "2026-11-26"), true);
  assert.equal(eventCoversDay(festival, "2026-11-27"), true);
  assert.equal(eventCoversDay({ startTime: "2026-11-25T23:30:00" }, "2026-11-25"), true);
});
test("formatters use fixed UTC+5 so they agree with parseDate", () => {
  assert.equal(formatTime("2026-11-25T20:00:00"), "20:00");
  assert.equal(formatTime("2026-11-25T15:00:00Z"), "20:00");
  assert.equal(dayKey(parseDate("2026-11-25T23:30:00")), "2026-11-25");
});
test("the event page timer targets the next registration boundary instead of ticking every second", () => {
  const now = Date.parse("2026-11-25T12:00:00+05:00");
  const event = { startTime: "2026-12-01T19:00:00", registrationOpeningTime: "2026-11-26T09:00:00", registrationClosingTime: "2026-11-30T23:00:00" };
  assert.equal(nextRegistrationBoundary(event, now), Date.parse("2026-11-26T09:00:00+05:00"));
  assert.equal(nextRegistrationBoundary(event, Date.parse("2026-11-27T00:00:00+05:00")), Date.parse("2026-11-30T23:00:00+05:00") + 1);
  assert.equal(nextRegistrationBoundary(event, Date.parse("2026-12-01T00:00:00+05:00")), Date.parse("2026-12-01T19:00:00+05:00"));
  assert.equal(nextRegistrationBoundary(event, Date.parse("2026-12-02T00:00:00+05:00")), null);
});
test("the cheapest price counts only ticket types that can be bought now", () => {
  const now = Date.parse("2026-11-25T12:00:00+05:00");
  const base = { eventId: 7, quantity: 10, sold: 0, available: 10, hidden: false };
  const types = [
    { ...base, id: 1, price: 500, hidden: true },
    { ...base, id: 2, price: 1000, available: 0 },
    { ...base, id: 3, price: 1500, salesStart: "2026-11-26T00:00:00" },
    { ...base, id: 4, price: 2000, salesEnd: "2026-11-25T11:00:00" },
    { ...base, id: 5, price: 3000 },
  ];
  assert.equal(minPrice(types, true, now), 3000);
  assert.equal(minPrice(types, false, now), null);
  assert.equal(minPrice([...types, { ...base, id: 6, price: 0 }], false, now), 0);
  assert.equal(isBuyableNow(types[2], true, Date.parse("2026-11-26T00:00:01+05:00")), true);
  assert.equal(minPrice(undefined), null);
});

test("campaign links are never treated as ticket codes", () => {
  for (const value of ["https://biletflow.example/events/7?promo=abc", "HTTP://x.y/z", "  https://a.b"]) assert.equal(looksLikeUrl(value), true, value);
  for (const value of ["T-5", "8f14e45f-ceea-467f-a0e6-5d7a0b4d1c2e", "BF.7.123", "httpcode"]) assert.equal(looksLikeUrl(value), false, value);
});

test("date filters accept a day or a range, and the weekend is computed in Almaty", () => {
  assert.deepEqual(parseDateFilter("2027-12-11"), { from: "2027-12-11", to: "2027-12-11" });
  assert.deepEqual(parseDateFilter("2027-12-12_2027-12-11"), { from: "2027-12-11", to: "2027-12-12" });
  assert.equal(parseDateFilter("soon"), null);
  assert.equal(weekendRange(new Date("2026-11-25T12:00:00+05:00")), "2026-11-28_2026-11-29"); // Wednesday
  assert.equal(weekendRange(new Date("2026-11-28T23:30:00+05:00")), "2026-11-28_2026-11-29"); // Saturday night
  assert.equal(weekendRange(new Date("2026-11-29T10:00:00+05:00")), "2026-11-29_2026-11-29"); // Sunday
  assert.equal(weekendRange(new Date("2026-11-27T20:00:00Z")), "2026-11-28_2026-11-29"); // already Saturday in Almaty
  assert.equal(eventOverlapsDays({ startTime: "2027-12-10T18:00:00", endTime: "2027-12-11T02:00:00" }, "2027-12-11", "2027-12-12"), true);
  assert.equal(eventOverlapsDays({ startTime: "2027-12-10T18:00:00" }, "2027-12-11", "2027-12-12"), false);
  assert.deepEqual(dateBadge("2027-12-10T18:00:00", "kk-KZ"), { day: "10", month: "жел" });
  assert.equal(dateBadge("2027-12-10T18:00:00", "en-GB").month, "Dec");
});
