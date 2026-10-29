import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { minPrice, useEvent, useTicketTypes } from "../hooks/useEvents";
import { Button } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { categoryLabel, formatLongDate, formatPrice, formatTime } from "../lib/format";
import { TicketSelector } from "../components/events/TicketSelector";

// Event page = the "event info" wireframe.
export default function EventPage() {
  const id = Number(useParams().id);
  const { data: event, isLoading, error, refetch } = useEvent(id);
  const { data: types, isLoading: typesLoading } = useTicketTypes(id);
  const { isLoggedIn, openLogin } = useAuth();

  if (isLoading) return <EventPageSkeleton />;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-bold">Событие не найдено</h1>
        <Link to="/" className="mt-3 inline-block underline">
          На главную
        </Link>
      </div>
    );
  }
  if (error || !event) return <ErrorMessage error={error} onRetry={() => refetch()} />;

  const visibleTypes = (types ?? []).filter((t) => !t.hidden);
  const price = minPrice(types);
  const soldOut = visibleTypes.length > 0 && visibleTypes.every((t) => t.available <= 0);

  const onChooseTickets = () => {
    if (!isLoggedIn) return openLogin();
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" });
  };
    // Temporary: in Part 2 this will create a real order
  const onContinue = (items: { ticketTypeId: number; quantity: number }[]) => {
    if (!isLoggedIn) return openLogin();
    alert(`Выбрано билетов: ${items.reduce((s, i) => s + i.quantity, 0)}. Оформление заказа — следующий шаг.`);
  };

  return (
    <article>
      <nav aria-label="Навигация" className="text-xs text-muted">
        <Link to="/" className="hover:underline">Главная</Link>
        {" / "}
        <Link to={`/?category=${encodeURIComponent(event.category)}`} className="hover:underline">
          {categoryLabel(event.category)}
        </Link>
        {" / "}
        <span>{event.title}</span>
      </nav>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        {/* Poster placeholder: the backend has no images yet */}
        <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-surface text-2xl text-muted">
          Постер
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase text-muted">{categoryLabel(event.category)}</p>
          <h1 className="mt-1 text-3xl font-bold">{event.title}</h1>
          <p className="mt-2 text-sm">
            {formatLongDate(event.startTime)}, {formatTime(event.startTime)}
          </p>
          {event.venue && (
            <p className="mt-1 text-sm text-muted">
              {event.venue.name}
              {event.venue.address && `, ${event.venue.address}`}
            </p>
          )}

          {event.status === "CANCELLED" ? (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Событие отменено</p>
          ) : (
            <div className="mt-5 flex max-w-md items-center justify-between rounded-xl bg-surface p-4">
              <div>
                <p className="font-bold">{formatTime(event.startTime)}</p>
                <p className="text-xs text-muted">
                  {typesLoading ? "…" : price === null ? "Билетов пока нет" : price === 0 ? "Бесплатно" : `от ${formatPrice(price)}`}
                </p>
              </div>
              <Button onClick={onChooseTickets} disabled={price === null || soldOut}>
                {soldOut ? "Билеты закончились" : "Выбрать билеты"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {event.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold">О событии</h2>
          <div className="mt-2 whitespace-pre-line rounded-xl bg-surface p-4 text-sm">{event.description}</div>
        </section>
      )}

            {visibleTypes.length > 0 && (
        <section id="tickets" className="mt-10 max-w-3xl">
          <h2 className="text-lg font-bold">Билеты</h2>
          <TicketSelector types={visibleTypes} onContinue={onContinue} />
        </section>
      )}
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
