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
import { Button, buttonClass } from "../components/ui/Button";
import { Icon } from "../components/ui/Icons";
import { ShareButton } from "../components/events/EventExtras";
import { mapLinks } from "../lib/maps";
import { scrollBehavior } from "../lib/motion";
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
    document.getElementById("tickets")?.scrollIntoView({ behavior: scrollBehavior() });
  };
  const onContinue = (items: OrderItemInput[], details: CheckoutDetails) => {
    if (registrationState(event) !== "open") { setNow(Date.now()); return; }
    if (!isLoggedIn) return openLogin();
    orderMutation.mutate({ items, details });
  };

  const venueAddress = [event.venue?.name, event.venue?.address].filter(Boolean).join(", ");
  const maps = event.venue?.address ? mapLinks(event.venue.address) : null;
  const priceLabel = typesLoading
    ? "…"
    : ticketsNotRequired
      ? tx("Билеты не требуются")
      : price === null
        ? soldOut ? tx("Билеты закончились") : tx("Билеты пока недоступны")
        : price === 0
          ? tx("Бесплатно")
          : tx("от {0}", [formatPrice(price, locale)]);
  const salesOpen = !event.suspended && event.status !== "CANCELLED";
  const ctaDisabled = price === null || soldOut || registration !== "open" || preview;
  const sections = [
    event.description ? ["about", tx("О событии")] : null,
    event.venue ? ["venue", tx("Место проведения")] : null,
    event.refundPolicy ? ["refund", tx("Политика возврата")] : null,
    visibleTypes.length > 0 ? ["tickets", tx("Билеты")] : null,
  ].filter((item): item is [string, string] => item !== null);
  const cta = salesOpen && !ticketsNotRequired && (
    <Button onClick={onChooseTickets} disabled={ctaDisabled} className="inline-flex items-center justify-center gap-2 px-5 py-2.5">
      <Icon name="ticket" className="h-4 w-4" />
      {soldOut ? tx("Билеты закончились") : tx("Выбрать билеты")}
    </Button>
  );

  return (
    <article className="pb-24 lg:pb-0">
      {preview && <p role="status" className="mb-4 flex items-center gap-2 rounded-[var(--radius-card)] bg-warn-soft p-4 font-semibold text-warn-ink"><Icon name="alert" />{tx("Черновик — не опубликован. Событие не видно посетителям.")}</p>}
      <nav aria-label={tx("Навигация")} className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link to="/" className="hover:text-primary-dark hover:underline">{tx("Главная")}</Link></li>
          <li aria-hidden="true"><Icon name="chevronRight" className="h-3.5 w-3.5" /></li>
          <li><Link to={`/?category=${encodeURIComponent(event.category)}`} className="hover:text-primary-dark hover:underline">{categoryLabel(event.category, locale)}</Link></li>
          <li aria-hidden="true"><Icon name="chevronRight" className="h-3.5 w-3.5" /></li>
          <li aria-current="page" className="truncate text-brand">{event.title}</li>
        </ol>
      </nav>

      {/* Header: blurred poster backdrop with the sharp poster card and the key facts. */}
      <header className="relative isolate mt-4 overflow-hidden rounded-[var(--radius-card)] bg-ink text-white shadow-lifted">
        <EventPoster posterUrl={event.posterUrl} authenticated={posterNeedsAuth} category={event.category} alt="" className="absolute inset-0 -z-10 scale-110 blur-2xl" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/90 to-ink/60" />
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,260px)_1fr] md:p-8">
          <EventPoster
            posterUrl={event.posterUrl}
            authenticated={posterNeedsAuth}
            category={event.category}
            alt={event.title}
            className="aspect-[3/4] w-full max-w-64 rounded-xl text-2xl shadow-panel ring-1 ring-white/20"
          />
          <div className="flex flex-col">
            <p><span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">{categoryLabel(event.category, locale)}</span></p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-4xl">{event.title}</h1>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5"><Icon name="calendar" className="mt-0.5 h-5 w-5 text-white/80" />
                <span><span className="font-semibold">{formatLongDate(event.startTime, locale)}</span>
                  {event.endTime && <span className="block text-white/80">{tx("Окончание: {0}", [formatDateTime(event.endTime, locale)])}</span>}</span>
              </li>
              <li className="flex items-center gap-2.5"><Icon name="clock" className="h-5 w-5 text-white/80" /><span className="font-semibold">{formatTime(event.startTime)}</span></li>
              {event.venue && <li className="flex items-start gap-2.5"><Icon name="pin" className="mt-0.5 h-5 w-5 text-white/80" />
                <span>{venueAddress}
                  {maps && <span className="mt-1 flex flex-wrap gap-3">
                    <a href={maps.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-primary-soft"><Icon name="map" className="h-4 w-4" />{tx("Открыть на карте")}<span className="sr-only"> (Google Maps)</span></a>
                    <a href={maps.twoGis} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2 hover:text-primary-soft">2GIS</a>
                  </span>}
                </span>
              </li>}
            </ul>
            {(event.registrationOpeningTime || event.registrationClosingTime) && <div className="mt-4 space-y-1 text-sm text-white/85">
              {event.registrationOpeningTime && <p>{tx("Открытие регистрации: {0}", [formatDateTime(event.registrationOpeningTime, locale)])}</p>}
              {event.registrationClosingTime && <p>{tx("Закрытие регистрации: {0}", [formatDateTime(event.registrationClosingTime, locale)])}</p>}
            </div>}
            {registrationMessage && <p role="status" className="mt-4 flex items-center gap-2 self-start rounded-lg bg-warn-soft px-3 py-2 text-sm font-semibold text-warn-ink"><Icon name="alert" className="h-4 w-4" />{registrationMessage}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
              <ShareButton title={event.title} />
            </div>
          </div>
        </div>
      </header>

      {event.suspended && (
        <p className="mt-5 flex items-center gap-2 rounded-[var(--radius-card)] bg-warn-soft p-4 text-sm font-medium text-warn-ink"><Icon name="alert" />
          {tx("Продажа билетов на это мероприятие временно приостановлена.")}</p>
      )}
      {!event.suspended && event.status === "CANCELLED" && (
        <p className="mt-5 flex items-center gap-2 rounded-[var(--radius-card)] bg-danger-soft p-4 text-sm font-semibold text-danger-ink"><Icon name="x" />{tx("Событие отменено")}</p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {sections.length > 1 && (
            <nav aria-label={tx("Разделы страницы")} className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-1 mb-6 bg-white/95 py-2 backdrop-blur">
              <ul className="no-scrollbar flex gap-2 overflow-x-auto px-1">
                {sections.map(([anchor, label]) => <li key={anchor} className="shrink-0">
                  <a href={`#${anchor}`} onClick={e => { e.preventDefault(); document.getElementById(anchor)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" }); }}
                    className="inline-flex min-h-9 items-center rounded-full border border-gray-300 px-3.5 text-sm font-semibold hover:border-primary hover:bg-primary-soft hover:text-primary-dark">{label}</a>
                </li>)}
              </ul>
            </nav>
          )}

          {event.description && (
            <section id="about" className="scroll-mt-20">
              <h2 className="text-xl font-bold text-ink">{tx("О событии")}</h2>
              <div className="mt-3 whitespace-pre-line rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 text-sm leading-relaxed">{event.description}</div>
            </section>
          )}

          {event.venue && (
            <section id="venue" className="mt-8 scroll-mt-20">
              <h2 className="text-xl font-bold text-ink">{tx("Место проведения")}</h2>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 text-sm">
                <p className="flex items-start gap-2.5"><Icon name="pin" className="mt-0.5 h-5 w-5 text-primary" />
                  <span><span className="block font-semibold">{event.venue.name}</span>{event.venue.address && <span className="text-muted">{event.venue.address}</span>}</span>
                </p>
                {maps && <a href={maps.google} target="_blank" rel="noopener noreferrer" className={`${buttonClass("secondary")} inline-flex items-center gap-1.5`}><Icon name="map" className="h-4 w-4" />{tx("Открыть на карте")}</a>}
              </div>
            </section>
          )}

          {event.refundPolicy && (
            <section id="refund" className="mt-8 scroll-mt-20">
              <h2 className="text-xl font-bold text-ink">{tx("Политика возврата")}</h2>
              <div className="mt-3 whitespace-pre-line rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 text-sm leading-relaxed">{event.refundPolicy}</div>
            </section>
          )}

          {ticketsNotRequired && (
            <p className="mt-8 flex items-center gap-2 rounded-[var(--radius-card)] bg-success-soft p-4 text-sm font-medium text-success-ink"><Icon name="check" />
              {tx("Билеты не требуются для этого события.")}</p>
          )}

          {visibleTypes.length > 0 && (
            <section id="tickets" className="mt-8 scroll-mt-20">
              <h2 className="text-xl font-bold text-ink">{tx("Билеты")}</h2>
              {orderMutation.error && (
                <p role="alert" className="mt-3 rounded-md bg-danger-soft p-3 text-sm text-danger-ink">
                  {orderMutation.error instanceof Error ? tx(orderMutation.error.message) : tx("Не удалось создать заказ.")}
                </p>
              )}
              <TicketSelector key={`${id}:${initialPromo}`} eventId={id} types={visibleTypes} initialPromo={initialPromo} promoSource={urlPromo ? "url" : "stored"} paidSalesActive={event.paidSalesActive} seatingMode={event.seatingMode} blocked={event.suspended || event.status === "CANCELLED" || preview || registration !== "open"} onContinue={onContinue} busy={orderMutation.isPending} />
            </section>
          )}

          <div className="mt-8 flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-gray-200 pt-6">
            {!preview && <CalendarMenu eventId={id} cancelled={event.status === "CANCELLED"} />}
            <Link to={`/support/new?eventId=${id}`} className="my-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary-dark underline"><Icon name="help" className="h-4 w-4" />{tx("Задать вопрос о событии")}</Link>
          </div>
          {isLoggedIn && user?.id !== event.organizerId && <ReportEventForm eventId={id} />}
        </div>

        {/* Desktop: sticky price panel. */}
        {salesOpen && <aside aria-label={tx("Покупка билетов")} className="hidden lg:block">
          <div className="sticky top-4 rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 shadow-lifted">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tx("Стоимость")}</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{priceLabel}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Icon name="calendar" className="h-4 w-4" />{formatLongDate(event.startTime, locale)}, {formatTime(event.startTime)}</p>
            {cta && <div className="mt-4 grid">{cta}</div>}
          </div>
        </aside>}
      </div>

      {/* Mobile: sticky bottom bar with price and the same action. */}
      {salesOpen && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-panel backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{event.title}</p>
            <p className="font-bold text-ink">{priceLabel}</p>
          </div>
          {cta}
        </div>
      </div>}
    </article>
  );
}

function EventPageSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="shimmer mt-4 h-4 w-48 rounded" />
      <div className="mt-4 grid gap-6 rounded-[var(--radius-card)] border border-gray-200 p-6 md:grid-cols-[260px_1fr]">
        <div className="shimmer aspect-[3/4] rounded-xl" />
        <div className="space-y-3">
          <div className="shimmer h-5 w-24 rounded-full" />
          <div className="shimmer h-9 w-2/3 rounded" />
          <div className="shimmer h-4 w-48 rounded" />
          <div className="shimmer h-4 w-40 rounded" />
          <div className="shimmer h-4 w-56 rounded" />
        </div>
      </div>
    </div>
  );
}
