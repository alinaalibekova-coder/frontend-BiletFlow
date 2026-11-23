import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Bundle the actual TypeScript modules; tests need no browser or live backend.
const bundle = await build({ stdin: { contents: `
  export * as orders from './src/api/orders';
  export * as seating from './src/api/seating';
  export * as platform from './src/api/platform';
  export * as users from './src/api/users';
  export * as auth from './src/api/auth';
  export * as commerce from './src/api/commerce';
  export * as support from './src/api/support';
  export * as notifications from './src/api/notifications';
  export * as events from './src/api/events';
  export * as catalog from './src/lib/cities';
  export * as venueForms from './src/lib/venues';
  export * as languageUtils from './src/lib/language';
  export * as pageLanguage from './src/i18n/translateText';
  export * as client from './src/api/client';
  export { startOrderPayment } from './src/lib/checkout';
  export { formatPrice, parseDate, formatLongDate, formatShortDate, weekdayShort } from './src/lib/format';
`, resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", write: false });
const { orders, seating, platform, users, auth, commerce, support, notifications, events, catalog, venueForms, languageUtils, pageLanguage, client, startOrderPayment, formatPrice, parseDate, formatLongDate, formatShortDate, weekdayShort } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

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
test("a 403 for a suspended account signs out globally and preserves the suspension reason, including blob calls", async () => {
  const messages = [];
  const unsubscribe = client.onAuthFailure(message => messages.push(message));
  try {
    request("/api/events/7", "GET", undefined, { message: "Account suspended: review" }, 403);
    await assert.rejects(events.getEvent(7), e => e.status === 403);
    assert.equal(client.getToken(), null);
    assert.deepEqual(messages, ["Account suspended: review"]);
    client.saveToken("test-token");
    request("/api/events/7/calendar.ics", "GET", undefined, { message: "Account suspended" }, 403);
    await assert.rejects(platform.downloadCalendar(7));
    assert.equal(client.getToken(), null);
    assert.equal(messages.length, 2);
  } finally { unsubscribe(); }
});
test("a plain 403 (not allowed) keeps the user signed in; 401 still signs out", async () => {
  const messages = [];
  const unsubscribe = client.onAuthFailure(message => messages.push(message));
  try {
    client.saveToken("test-token");
    request("/api/events/7", "GET", undefined, { message: "Нет доступа к этому событию" }, 403);
    await assert.rejects(events.getEvent(7), e => e.status === 403);
    assert.equal(client.getToken(), "test-token");
    assert.deepEqual(messages, []);
    request("/api/events/7", "GET", undefined, { code: "ACCOUNT_SUSPENDED", message: "Blocked" }, 403);
    await assert.rejects(events.getEvent(7));
    assert.equal(client.getToken(), null);
    client.saveToken("test-token");
    request("/api/events/7", "GET", undefined, {}, 401);
    await assert.rejects(events.getEvent(7), e => e.status === 401);
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
test("daily sales dates and event timestamps both use Kazakhstan time", () => {
  assert.equal(parseDate("2026-11-13").toISOString(), "2026-11-12T19:00:00.000Z");
  assert.match(formatLongDate("2026-11-13"), /13 ноября 2026/);
  assert.equal(parseDate("2026-11-13T12:30:00").toISOString(), "2026-11-13T07:30:00.000Z");
  assert.equal(parseDate("2026-11-13T12:30:00Z").toISOString(), "2026-11-13T12:30:00.000Z");
  assert.equal(parseDate("2026-11-13T12:30:00+05:00").toISOString(), "2026-11-13T07:30:00.000Z");
});

test("Halyk checkout launches the bank script without calling /pay", async () => {
  const session = { provider: "HALYK", simulated: true, scriptUrl: "https://bank.example/payment-test.js", payment: { invoiceId: "invoice-42" } };
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
  const session = { provider: "HALYK", scriptUrl: "https://bank.example/retry.js", payment: {} };
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
  assert.equal(client.getToken(), null);
  // Retry only after signing in again: authenticated 403 now invalidates the session.
  client.saveToken("test-token");
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
