import { CalendarMenu, ReportEventForm } from "../components/events/EventExtras";
import { useLanguage } from "../i18n/LanguageContext";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCalendar } from "../api/platform";
import { ApiError } from "../api/client";
import { createOrder, type CheckoutDetails, type OrderItemInput } from "../api/orders";
import { useAuth } from "../auth/AuthContext";
import { minPrice, useEvent, useTicketTypes } from "../hooks/useEvents";
import { Button } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { categoryLabel, formatDateTime, formatLongDate, formatPrice, formatTime } from "../lib/format";
import { nextRegistrationBoundary, registrationState } from "../lib/registration";
import { clearStoredPromo, readStoredPromo } from "../lib/promo";
import { TicketSelector } from "../components/events/TicketSelector";
import { EventPoster } from "../components/events/EventPoster";

// Event page = the "event info" wireframe.
export default function EventPage() {
  const { tx, locale } = useLanguage();
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlPromo = params.get("promo") ?? "";
  // A campaign token kept by the home page is read for each event the attendee opens. It is
  // remembered together with the event id, so going straight from one event to another (same
  // page component, new :id) never shows the previous event's token before it is read again.
  const [stored, setStored] = useState<{ eventId: number; value: string } | null>(null);
  useEffect(() => {
    const value = urlPromo ? "" : readStoredPromo();
    setStored(value ? { eventId: id, value } : null);
  }, [id, urlPromo]);
  const storedPromo = stored?.eventId === id ? stored.value : "";
  const initialPromo = urlPromo || storedPromo;
  const { data: event, isLoading, error, refetch } = useEvent(id);
  const { data: types, isLoading: typesLoading } = useTicketTypes(id);
  const { user, isLoggedIn, openLogin } = useAuth();
  const queryClient = useQueryClient();
  // Cancelled events disappear from public event details, but ticket holders retain calendar access.
  const cancelledCalendar = useQuery({ queryKey: ["calendar", id], queryFn: () => getCalendar(id), enabled: isLoggedIn && error instanceof ApiError && error.status === 404, retry: false });
  const [now, setNow] = useState(Date.now);
  // Re-render only when registration can change state, then schedule the following boundary.
  const startTime = event?.startTime;
  const openingTime = event?.registrationOpeningTime;
  const closingTime = event?.registrationClosingTime;
  useEffect(() => {
    if (!startTime) return;
    const next = nextRegistrationBoundary({ startTime, registrationOpeningTime: openingTime, registrationClosingTime: closingTime }, now);
    if (next === null) return;
    // Browsers fire timeouts longer than ~24.8 days immediately; such a wait just re-schedules.
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(next - now, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [startTime, openingTime, closingTime, now]);
  const orderMutation = useMutation({
    mutationFn: ({ items, details }: { items: OrderItemInput[]; details: CheckoutDetails }) => createOrder(id, items, details),
    onSuccess: (order, { details }) => {
      // A carried-over campaign token is used up once an order applied it.
      if (details.promoCode) clearStoredPromo();
      navigate(`/orders/${order.id}`);
    },
    // A picked seat may have been taken meanwhile: show the current seat map.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["seat-map", id] });
      void queryClient.invalidateQueries({ queryKey: ["seat-section", id] });
    },
  });

  if (isLoading) return <EventPageSkeleton />;

  if (error instanceof ApiError && error.status === 404) {
    if (cancelledCalendar.data?.cancelled) return <section className="py-8"><h1 className="text-xl font-bold">{tx("Событие отменено")}</h1><CalendarMenu eventId={id} cancelled /><Link to="/account" className="underline">{tx("Мои билеты")}</Link></section>;
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">{tx("Событие не найдено")}</h1>
        <Link to="/" className="mt-3 inline-block underline">
          {tx("На главную")}</Link>
      </div>
    );
  }
  if (error || !event) return <ErrorMessage error={error} onRetry={() => refetch()} />;

  const visibleTypes = (types ?? []).filter((t) => !t.hidden);
  const ticketsNotRequired = event.status === "PUBLISHED" && !typesLoading && types?.length === 0;
  const posterNeedsAuth = event.status !== "PUBLISHED" || event.visibilityStatus === "PRIVATE";
  // Cheapest ticket that can be bought now; when none can, soldOut tells "sold out" from "not on sale yet".
  const price = minPrice(types, event.paidSalesActive, now);
  const soldOut = visibleTypes.length > 0 && visibleTypes.every((t) => t.available <= 0);
  const registration = registrationState(event, now);
  const registrationMessage = registration === "not-open" ? tx("Регистрация ещё не открыта") : registration === "closed" ? tx("Регистрация закрыта") : registration === "started" ? tx("Событие уже началось") : "";
  const preview = event.status === "DRAFT";

  const onChooseTickets = () => {
    if (registrationState(event) !== "open") { setNow(Date.now()); return; }
    if (!isLoggedIn) return openLogin();
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" });
  };
  const onContinue = (items: OrderItemInput[], details: CheckoutDetails) => {
    if (registrationState(event) !== "open") { setNow(Date.now()); return; }
    if (!isLoggedIn) return openLogin();
    orderMutation.mutate({ items, details });
  };

  return (
    <article>
      {preview && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{tx("Черновик — не опубликован. Событие не видно посетителям.")}</p>}
      <nav aria-label={tx("Навигация")} className="text-xs text-muted">
        <Link to="/" className="hover:underline">{tx("Главная")}</Link>
        {" / "}
        <Link to={`/?category=${encodeURIComponent(event.category)}`} className="hover:underline">
          {categoryLabel(event.category, locale)}
        </Link>
        {" / "}
        <span>{event.title}</span>
      </nav>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <EventPoster
          posterUrl={event.posterUrl}
          authenticated={posterNeedsAuth}
          className="aspect-[3/4] rounded-xl text-2xl"
        />

        <div>
          <p className="text-xs font-semibold uppercase text-muted">{categoryLabel(event.category, locale)}</p>
          <h1 className="mt-1 text-3xl font-bold">{event.title}</h1>
          <p className="mt-2 text-sm">
            {formatLongDate(event.startTime, locale)}, {formatTime(event.startTime)}
          </p>
          {event.endTime && <p className="mt-2 text-sm">{tx("Окончание: {0}", [formatDateTime(event.endTime, locale)])}</p>}
          {(event.registrationOpeningTime || event.registrationClosingTime) && <div className="mt-3 space-y-1 text-sm">
            {event.registrationOpeningTime && <p>{tx("Открытие регистрации: {0}", [formatDateTime(event.registrationOpeningTime, locale)])}</p>}
            {event.registrationClosingTime && <p>{tx("Закрытие регистрации: {0}", [formatDateTime(event.registrationClosingTime, locale)])}</p>}
          </div>}
          {registrationMessage && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{registrationMessage}</p>}
          {event.venue && (
            <p className="mt-1 text-sm text-muted">
              {event.venue.name}
              {event.venue.address && `, ${event.venue.address}`}
            </p>
          )}

          {event.suspended ? (
            <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              {tx("Продажа билетов на это мероприятие временно приостановлена.")}</p>
          ) : event.status === "CANCELLED" ? (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{tx("Событие отменено")}</p>
          ) : (
            <div className="mt-5 flex max-w-md items-center justify-between rounded-xl bg-surface p-4">
              <div>
                <p className="font-bold">{formatTime(event.startTime)}</p>
                <p className="text-xs text-muted">
                  {typesLoading
                    ? "…"
                    : ticketsNotRequired
                      ? tx("Билеты не требуются")
                      : price === null
                        ? soldOut ? tx("Билеты закончились") : tx("Билеты пока недоступны")
                        : price === 0
                          ? tx("Бесплатно")
                          : tx("от {0}", [formatPrice(price, locale)])}
                </p>
              </div>
              {!ticketsNotRequired && (
                <Button onClick={onChooseTickets} disabled={price === null || soldOut || registration !== "open" || preview}>
                  {soldOut ? tx("Билеты закончились") : tx("Выбрать билеты")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {event.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold">{tx("О событии")}</h2>
          <div className="mt-2 whitespace-pre-line rounded-xl bg-surface p-4 text-sm">{event.description}</div>
        </section>
      )}

      {event.refundPolicy && (
        <section className="mt-6 max-w-3xl">
          <h2 className="text-lg font-bold">{tx("Политика возврата")}</h2>
          <div className="mt-2 whitespace-pre-line rounded-xl bg-surface p-4 text-sm">{event.refundPolicy}</div>
        </section>
      )}

      {ticketsNotRequired && (
        <p className="mt-10 max-w-3xl rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">
          {tx("Билеты не требуются для этого события.")}</p>
      )}

      {visibleTypes.length > 0 && (
        <section id="tickets" className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold">{tx("Билеты")}</h2>
          {orderMutation.error && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {orderMutation.error instanceof Error ? tx(orderMutation.error.message) : tx("Не удалось создать заказ.")}
            </p>
          )}
          <TicketSelector key={`${id}:${initialPromo}`} eventId={id} types={visibleTypes} initialPromo={initialPromo} promoSource={urlPromo ? "url" : "stored"} paidSalesActive={event.paidSalesActive} seatingMode={event.seatingMode} blocked={event.suspended || event.status === "CANCELLED" || preview || registration !== "open"} onContinue={onContinue} busy={orderMutation.isPending} />
        </section>
      )}
      {!preview && <CalendarMenu eventId={id} cancelled={event.status === "CANCELLED"} />}
      {isLoggedIn && user?.id !== event.organizerId && <ReportEventForm eventId={id} />}
      <Link to={`/support/new?eventId=${id}`} className="mt-6 inline-block text-sm underline">{tx("Задать вопрос о событии")}</Link>
    </article>
  );
}

function EventPageSkeleton() {

  return (
    <div className="mt-8 grid animate-pulse gap-6 md:grid-cols-[320px_1fr]" aria-hidden="true">
      <div className="aspect-[3/4] rounded-xl bg-surface" />
      <div className="space-y-3">
        <div className="h-3 w-20 rounded bg-surface" />
        <div className="h-8 w-2/3 rounded bg-surface" />
        <div className="h-4 w-40 rounded bg-surface" />
        <div className="h-20 max-w-md rounded-xl bg-surface" />
      </div>
    </div>
  );
}
