import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignEventStaff,
  getEventStaff,
  removeEventStaff,
} from "../api/checkIn";
import { getOrganizerEvents, getOrganizerProfile, getTicketTypes } from "../api/events";
import { Button, buttonClass } from "../components/ui/Button";
import { formatPrice, formatShortDate } from "../lib/format";
import type { Event, EventStaff, TicketType } from "../api/types";

interface EventSales {
  event: Event;
  ticketTypes: TicketType[];
}

export function OrganizerSalesPage() {
  const profile = useQuery({ queryKey: ["organizer-profile"], queryFn: getOrganizerProfile });
  const events = useQuery({
    queryKey: ["organizer-events", profile.data?.userId],
    queryFn: () => getOrganizerEvents(profile.data!.userId),
    enabled: !!profile.data?.userId,
  });
  const sales = useQuery({
    queryKey: ["organizer-sales", profile.data?.userId],
    enabled: !!profile.data?.userId && !!events.data,
    queryFn: async () => {
      const eventList = events.data?.content ?? [];
      return Promise.all(eventList.map(async (event) => ({
        event,
        ticketTypes: await getTicketTypes(event.id),
      })));
    },
  });
  const retry = () => {
    void profile.refetch();
    void events.refetch();
    void sales.refetch();
  };

  if (profile.isLoading || events.isLoading || sales.isLoading) return <LoadingState />;
  if (profile.error || events.error || sales.error) {
    return <ErrorState error={profile.error ?? events.error ?? sales.error} onRetry={retry} />;
  }

  const rows = sales.data ?? [];
  const totals = rows.reduce((acc, row) => {
    for (const ticket of row.ticketTypes) {
      acc.sold += ticket.sold;
      acc.available += ticket.available;
      acc.estimatedGross += ticket.sold * ticket.price;
    }
    return acc;
  }, { sold: 0, available: 0, estimatedGross: 0 });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Продажи мероприятий</h2>
        <p className="mt-1 text-sm text-muted">
          Сводка рассчитана по счётчикам типов билетов. Сумма — оценка по цене билета, не бухгалтерская выручка.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted">У вас пока нет мероприятий.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Продано билетов" value={totals.sold.toLocaleString("ru-RU")} />
            <Metric label="Осталось билетов" value={totals.available.toLocaleString("ru-RU")} />
            <Metric label="Оценка суммы продаж" value={formatPrice(totals.estimatedGross)} />
          </div>
          {rows.map((row) => <EventSalesCard key={row.event.id} row={row} />)}
        </>
      )}
    </div>
  );
}

function EventSalesCard({ row }: { row: EventSales }) {
  const sold = row.ticketTypes.reduce((sum, ticket) => sum + ticket.sold, 0);
  const available = row.ticketTypes.reduce((sum, ticket) => sum + ticket.available, 0);
  const gross = row.ticketTypes.reduce((sum, ticket) => sum + ticket.sold * ticket.price, 0);

  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.event.title}</h3>
          <p className="mt-1 text-sm text-muted">{formatShortDate(row.event.startTime)}</p>
        </div>
        <Link to={`/organizer/events/${row.event.id}/staff`} className={buttonClass("secondary")}>
          Сотрудники события
        </Link>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <p>Продано: <strong>{sold}</strong></p>
        <p>Осталось: <strong>{available}</strong></p>
        <p>Оценка суммы: <strong>{formatPrice(gross)}</strong></p>
      </div>
      {row.ticketTypes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Типы билетов не добавлены.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b text-xs text-muted">
              <tr><th className="py-2 pr-3">Тип билета</th><th className="py-2 pr-3">Цена</th><th className="py-2 pr-3">Продано</th><th className="py-2 pr-3">Остаток</th><th className="py-2">Сумма по счётчику</th></tr>
            </thead>
            <tbody>
              {row.ticketTypes.map((ticket) => (
                <tr key={ticket.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{ticket.name}</td>
                  <td className="py-2 pr-3">{ticket.price === 0 ? "Бесплатно" : formatPrice(ticket.price)}</td>
                  <td className="py-2 pr-3">{ticket.sold}</td>
                  <td className="py-2 pr-3">{ticket.available}</td>
                  <td className="py-2">{formatPrice(ticket.sold * ticket.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function OrganizerEventStaffPage() {
  const eventId = Number(useParams().eventId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const staff = useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: () => getEventStaff(eventId),
    enabled: Number.isSafeInteger(eventId) && eventId > 0,
  });
  const addStaff = useMutation({
    mutationFn: (staffEmail: string) => assignEventStaff(eventId, staffEmail),
    onSuccess: async () => {
      setEmail("");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["event-staff", eventId] });
    },
  });
  const removeStaffMutation = useMutation({
    mutationFn: (userId: number) => removeEventStaff(eventId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-staff", eventId] });
    },
  });

  if (!Number.isSafeInteger(eventId) || eventId <= 0) return <p role="alert">Некорректный ID мероприятия.</p>;
  if (staff.isLoading) return <LoadingState />;
  if (staff.error) return <ErrorState error={staff.error} onRetry={() => { void staff.refetch(); }} />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFormError("Введите корректный email сотрудника.");
      return;
    }
    setFormError("");
    addStaff.mutate(normalizedEmail);
  };

  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <Link to="/organizer/sales" className="text-sm underline">К продажам</Link>
        <h2 className="mt-2 text-xl font-bold">Сотрудники мероприятия</h2>
        <p className="mt-1 text-sm text-muted">Назначайте сотрудников, которым backend разрешает работу с check-in.</p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email сотрудника"
          className="min-w-60 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={addStaff.isPending}>{addStaff.isPending ? "Назначаем…" : "Назначить"}</Button>
      </form>
      {(formError || addStaff.error) && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {formError || (addStaff.error instanceof Error ? addStaff.error.message : "Не удалось назначить сотрудника.")}
        </p>
      )}
      {removeStaffMutation.error && <ApiErrorMessage error={removeStaffMutation.error} />}
      {(staff.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface p-5 text-sm text-muted">Сотрудники ещё не назначены.</p>
      ) : (
        <div className="space-y-2">
          {(staff.data ?? []).map((person) => (
            <StaffRow key={person.userId} person={person} pending={removeStaffMutation.isPending} onRemove={() => removeStaffMutation.mutate(person.userId)} />
          ))}
        </div>
      )}
    </section>
  );
}

function StaffRow({ person, pending, onRemove }: { person: EventStaff; pending: boolean; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div><p className="font-medium">{person.email}</p><p className="text-xs text-muted">Назначен: {new Date(person.assignedAt).toLocaleDateString("ru-RU")}</p></div>
      <Button variant="secondary" disabled={pending} onClick={onRemove}>Убрать доступ</Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function LoadingState() {
  return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загрузка…</p>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-xl bg-red-50 p-5 text-sm text-red-800">
      <p>{error instanceof Error ? error.message : "Не удалось загрузить данные."}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>Повторить</Button>
    </div>
  );
}

function ApiErrorMessage({ error }: { error: unknown }) {
  return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error instanceof Error ? error.message : "Не удалось изменить список сотрудников."}</p>;
}
