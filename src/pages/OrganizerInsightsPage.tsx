import { getAdminEvents } from "../api/platform";
import { useLanguage } from "../i18n/LanguageContext";
import { Fragment, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignEventStaff,
  getEventStaff,
  removeEventStaff,
} from "../api/checkIn";
import { getEventOrders, getOrganizerSales } from "../api/sales";
import { RefundOrderButton } from "../components/orders/RefundOrderButton";
import { EventAttendancePanel } from "../components/analytics/EventAttendancePanel";
import { OrderItemsList } from "../components/orders/OrderItemsList";
import { EventSalesAnalytics, InventoryMetrics } from "../components/analytics/SalesInsights";
import { summarizeInventory } from "../lib/salesInventory";
import { Button, buttonClass } from "../components/ui/Button";
import { formatLongDate, formatPrice, formatShortDate, formatDateTime } from "../lib/format";
import type { EventSales, EventStaff } from "../api/types";
import { useAuth } from "../auth/AuthContext";

function useDashboardBase() {
  const { user } = useAuth();
  const role = user?.role.trim().toUpperCase().replace(/^ROLE_/, "");
  return role === "PLATFORM_ADMIN" || role === "ADMIN" ? "/admin/dashboard" : "/organizer";
}

export function OrganizerSalesPage() {
  const { tx, locale, statusLabel } = useLanguage();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [orderPage, setOrderPage] = useState(0);
  const [orderStatus, setOrderStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const sales = useQuery({
    queryKey: ["organizer-sales-summary"],
    queryFn: () => getOrganizerSales(),
  });
  const eventOrders = useQuery({
    queryKey: ["organizer-event-orders", selectedEventId, orderPage, orderStatus, orderQuery],
    queryFn: () => getEventOrders(selectedEventId!, {
      page: orderPage,
      size: 20,
      status: orderStatus || undefined,
      query: orderQuery,
    }),
    enabled: selectedEventId !== null,
  });
  const retry = () => {
    void sales.refetch();
    if (selectedEventId !== null) {
      void eventOrders.refetch();
    }
  };

  if (sales.isLoading) return <LoadingState />;
  if (sales.error) return <ErrorState error={sales.error} onRetry={retry} />;
  if (!sales.data) return <ErrorState error={new Error(tx("Backend не вернул сводку продаж."))} onRetry={retry} />;

  const summary = sales.data;
  const rows = summary?.events ?? [];
  const submitOrderSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrderPage(0);
    setOrderQuery(searchInput.trim());
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{tx("Продажи мероприятий")}</h2>
        <p className="mt-1 text-sm text-muted">{tx("Статистика и выручка загружены из backend.")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted">{tx("У вас пока нет мероприятий.")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label={tx("Оплачено заказов")} value={summary.totals.paidOrders.toLocaleString(locale)} />
            <Metric label={tx("Продано билетов")} value={summary.totals.ticketsSold.toLocaleString(locale)} />
            <Metric label={tx("Выручка")} value={formatPrice(summary.totals.revenue, locale)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Metric label={tx("Ожидают оплаты")} value={summary.totals.pendingOrders.toLocaleString(locale)} />
            <Metric label={tx("Зарезервировано билетов")} value={summary.totals.ticketsReserved.toLocaleString(locale)} />
          </div>
          <InventoryMetrics {...summarizeInventory(rows)} />
          <div className="grid gap-2 sm:grid-cols-4">
            <Metric label={tx("Скидки")} value={formatPrice(summary.totals.discounts, locale)} />
            <Metric label={tx("Возвраты")} value={formatPrice(summary.totals.refunds ?? 0, locale)} />
            <Metric label={tx("Возвращено билетов")} value={String(summary.totals.ticketsRefunded ?? 0)} />
            <Metric label={tx("Возвращено заказов")} value={String(summary.totals.refundedOrders ?? 0)} />
            <Metric label={tx("После скидок и возвратов")} value={formatPrice(summary.totals.netRevenue, locale)} />
            <Metric label={tx("Комиссии")} value={formatPrice(summary.totals.processingFees, locale)} />
            <Metric label={tx("Ожидаемая выплата (симуляция)")} value={formatPrice(summary.totals.estimatedPayout, locale)} />
          </div>
          <p className="text-sm text-muted">{tx("Комиссия обработки удерживается из дохода организатора и уже учтена в ожидаемой выплате.")}</p>
          {rows.map((row) => (
            <Fragment key={row.eventId}>
            <EventSalesCard
              row={row}
              expanded={selectedEventId === row.eventId}
              onToggle={() => {
                setSelectedEventId((current) => current === row.eventId ? null : row.eventId);
                setOrderPage(0);
                setOrderStatus("");
                setOrderQuery("");
                setSearchInput("");
              }}
            />
          {/* Details open right under the event they belong to, not after the whole list */}
          {selectedEventId === row.eventId && (
            <section className="rounded-xl border p-4">
              <h3 className="text-lg font-semibold">{tx("Динамика и заказы")}</h3>
              <EventSalesAnalytics key={selectedEventId} eventId={selectedEventId}>{data => <EventSalesDetail sales={data} />}</EventSalesAnalytics>
              <EventAttendancePanel key={selectedEventId} eventId={selectedEventId} />
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold">{tx("Заказы мероприятия")}</h4>
                <form onSubmit={submitOrderSearch} className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={tx("Поиск по email или номеру заказа")} className="rounded-lg border px-3 py-2 text-sm" />
                  <select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setOrderPage(0); }} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">{tx("Все статусы")}</option>
                    <option value="PENDING">{tx("Ожидает оплаты")}</option>
                    <option value="PAID">{tx("Оплачен")}</option>
                    <option value="CANCELLED">{tx("Отменён")}</option>
                    <option value="EXPIRED">{tx("Истёк")}</option>
                    <option value="REFUNDED">{tx("Возвращён")}</option>
                  </select>
                  <Button type="submit">{tx("Найти")}</Button>
                </form>
                {eventOrders.isLoading ? <LoadingState /> : eventOrders.error ? (
                  <ErrorState error={eventOrders.error} onRetry={() => { void eventOrders.refetch(); }} />
                ) : (eventOrders.data?.content ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{tx("Заказы не найдены.")}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(eventOrders.data?.content ?? []).map((order) => (
                      <article key={order.id} className="rounded-lg bg-surface p-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <strong>{tx("Заказ №")}{order.id} · {order.buyerEmail}</strong>
                          <span>{formatPrice(order.totalAmount, locale)} · {statusLabel(order.status)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {order.ticketCount} {tx(" бил. · Создан ")}{formatDateTime(order.createdAt, locale)}
                          {order.paidAt ? tx(" · Оплачен {0}", [formatDateTime(order.paidAt, locale)]) : ""}
                        </p>
                        {order.attendeeName && <p className="mt-1 text-xs">{tx("Посетитель: ")}{order.attendeeName}</p>}
                        <OrderItemsList items={order.items} className="mt-2 text-xs" />
                          {order.status === "PAID" && <RefundOrderButton orderId={order.id} totalAmount={order.totalAmount} />}
                      </article>
                    ))}
                    <OrdersPagination
                      page={orderPage}
                      totalPages={eventOrders.data?.totalPages ?? 0}
                      onChange={setOrderPage}
                    />
                  </div>
                )}
              </div>
            </section>
          )}
            </Fragment>
          ))}
        </>
      )}
    </div>
  );
}

function EventSalesCard({ row, expanded, onToggle, toggleLabel }: { row: EventSales; expanded: boolean; onToggle: () => void; toggleLabel?: string }) {
  const { tx, locale, statusLabel } = useLanguage();
  const base = useDashboardBase();
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.eventTitle}</h3>
          <p className="mt-1 text-sm text-muted">{formatShortDate(row.startTime, locale)} · {statusLabel(row.status)}{row.suspended ? tx(" · Приостановлено") : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`${base}/events/${row.eventId}/staff`} className={buttonClass("secondary")}>{tx("Сотрудники")}</Link>
          <Button variant="secondary" onClick={onToggle}>{toggleLabel ?? (expanded ? tx("Скрыть детали") : tx("Заказы и детали"))}</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <p>{tx("Оплаченные заказы: ")}<strong>{row.paidOrders}</strong></p>
        <p>{tx("Ожидают оплаты: ")}<strong>{row.pendingOrders}</strong></p>
        <p>{tx("Отменены / истекли: ")}<strong>{row.cancelledOrders + row.expiredOrders}</strong></p>
        <p>{tx("Продано билетов: ")}<strong>{row.ticketsSold}</strong></p>
        <p>{tx("Зарезервировано: ")}<strong>{row.ticketsReserved}</strong></p>
        <p>{tx("Выручка: ")}<strong>{formatPrice(row.revenue, locale)}</strong></p>
      </div>
      <InventoryMetrics capacity={row.capacity} ticketsRemaining={row.ticketsRemaining} percentSold={row.percentSold} />
      {row.ticketTypes.length === 0 ? <p className="mt-3 text-sm text-muted">{tx("Типы билетов не добавлены.")}</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b text-xs text-muted">
              <tr><th className="py-2 pr-3">{tx("Тип билета")}</th><th className="py-2 pr-3">{tx("Цена")}</th><th className="py-2 pr-3">{tx("Продано")}</th><th className="py-2 pr-3">{tx("Возвращено")}</th><th className="py-2 pr-3">{tx("Резерв")}</th><th className="py-2 pr-3">{tx("Остаток")}</th><th className="py-2">{tx("Выручка")}</th></tr>
            </thead>
            <tbody>
              {row.ticketTypes.map((ticket) => (
                <tr key={ticket.ticketTypeId} className="border-b last:border-0">
                  <td className="py-2 pr-3">{ticket.name}</td>
                  <td className="py-2 pr-3">{ticket.price === 0 ? tx("Бесплатно") : formatPrice(ticket.price, locale)}</td>
                  <td className="py-2 pr-3">{ticket.sold}</td>
                  <td className="py-2 pr-3">{ticket.refunded ?? 0}</td><td className="py-2 pr-3">{ticket.reserved}</td>
                  <td className="py-2 pr-3">{ticket.available}</td>
                  <td className="py-2">{formatPrice(ticket.revenue, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function EventSalesDetail({ sales }: { sales: EventSales }) {
  const { tx, locale } = useLanguage();
  const maxDailyRevenue = Math.max(0, ...sales.salesByDay.map((day) => day.revenue));
  return (
    <div className="mt-4">
      <InventoryMetrics capacity={sales.capacity} ticketsRemaining={sales.ticketsRemaining} percentSold={sales.percentSold} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Metric label={tx("Выручка")} value={formatPrice(sales.revenue, locale)} />
        <Metric label={tx("Оплачено заказов")} value={String(sales.paidOrders)} />
        <Metric label={tx("Отменено заказов")} value={String(sales.cancelledOrders)} />
        <Metric label={tx("Истекло заказов")} value={String(sales.expiredOrders)} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label={tx("Скидки")} value={formatPrice(sales.discounts, locale)} />
        <Metric label={tx("После скидок и возвратов")} value={formatPrice(sales.netRevenue, locale)} />
        <Metric label={tx("Комиссии")} value={formatPrice(sales.processingFees, locale)} />
        <Metric label={tx("Ожидаемая выплата (симуляция)")} value={formatPrice(sales.estimatedPayout, locale)} />
      </div>
      <p className="mt-3 text-sm text-muted">{tx("Комиссия обработки удерживается из дохода организатора и уже учтена в ожидаемой выплате.")}</p>
      <h4 className="mt-5 font-semibold">{tx("Продажи по дням")}</h4>
      {sales.salesByDay.length === 0 ? <p className="mt-2 text-sm text-muted">{tx("Данных о продажах пока нет.")}</p> : (
        <div className="mt-2 space-y-2">
          {sales.salesByDay.map((day) => (
            <div key={day.date} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-xs">
              <span>{formatLongDate(day.date, locale)}</span>
              <div className="h-3 overflow-hidden rounded bg-surface">
                <div className="h-full rounded bg-black" style={{ width: `${maxDailyRevenue > 0 ? Math.max(day.revenue / maxDailyRevenue * 100, day.revenue > 0 ? 2 : 0) : 0}%` }} />
              </div>
              <span className="whitespace-nowrap">{formatPrice(day.revenue, locale)} · {day.ticketsSold} {tx(" бил.")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const { tx } = useLanguage();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>{tx("Назад")}</Button>
      <span className="text-sm">{page + 1} / {totalPages}</span>
      <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>{tx("Далее")}</Button>
    </div>
  );
}

export function AdminEventSalesPage() {
  const { tx, locale, statusLabel } = useLanguage();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [orderPage, setOrderPage] = useState(0);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const events = useQuery({ queryKey: ["admin-sales-events", page], queryFn: () => getAdminEvents({ page, size: 20 }) });
  const orders = useQuery({ queryKey: ["organizer-event-orders", selected, orderPage, status, search], queryFn: () => getEventOrders(selected!, { page: orderPage, status: status || undefined, query: search }), enabled: selected !== null });
  return <section className="space-y-5">
    <h2 className="text-xl font-bold">{tx("Продажи и заказы по событию")}</h2>
    <p className="text-sm text-muted">{tx("Выберите мероприятие для просмотра его статистики.")}</p>
    {events.isLoading && <LoadingState />}{events.error && <ErrorState error={events.error} onRetry={() => void events.refetch()} />}
    <div className="flex flex-wrap gap-2">{events.data?.content.map(event => <Button key={event.id} variant={event.id === selected ? "primary" : "secondary"} onClick={() => { setSelected(event.id); setOrderPage(0); setSearch(""); setQuery(""); setStatus(""); }}>{event.title}</Button>)}</div>
    {events.data?.content.length === 0 && <p className="text-sm">{tx("Мероприятий нет.")}</p>}
    <OrdersPagination page={page} totalPages={events.data?.totalPages ?? 0} onChange={setPage} />
    {selected !== null && <>
      <EventSalesAnalytics key={selected} eventId={selected}>{data => <EventSalesDetail sales={data} />}</EventSalesAnalytics>
      <EventAttendancePanel key={selected} eventId={selected} />
      <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{tx("Заказы события")}</h3>
        <form onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setOrderPage(0); }} className="flex flex-wrap gap-2">
          <input aria-label={tx("Поиск заказов по email")} value={query} onChange={e => setQuery(e.target.value)} placeholder={tx("Email покупателя")} className="min-w-40 flex-1 rounded-lg border p-2 text-sm" />
          <select aria-label={tx("Статус заказа")} value={status} onChange={e => { setStatus(e.target.value); setOrderPage(0); }} className="rounded-lg border p-2 text-sm"><option value="">{tx("Все статусы")}</option><option value="PAID">{tx("Оплачен")}</option><option value="PENDING">{tx("Ожидает оплаты")}</option><option value="EXPIRED">{tx("Истёк")}</option><option value="CANCELLED">{tx("Отменён")}</option><option value="REFUNDED">{tx("Возвращён")}</option></select><Button type="submit">{tx("Найти")}</Button>
        </form>
        {orders.isLoading && <LoadingState />}{orders.error && <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />}
        {orders.data?.content.length === 0 && <p className="text-sm">{tx("Заказов нет.")}</p>}
        {orders.data?.content.map(order => <article key={order.id} className="rounded-lg bg-surface p-3 text-sm"><p className="font-semibold">№{order.id} · {order.buyerEmail}</p>{order.attendeeName && <p>{tx("Посетитель: ")}{order.attendeeName}</p>}<p>{statusLabel(order.status)} · {formatPrice(order.totalAmount, locale)} {tx(" · Билетов: ")}{order.ticketCount}</p><OrderItemsList items={order.items} className="mt-1 text-xs" /> {order.status === "PAID" && <RefundOrderButton orderId={order.id} totalAmount={order.totalAmount} />}</article>)}
        <OrdersPagination page={orderPage} totalPages={orders.data?.totalPages ?? 0} onChange={setOrderPage} />
      </section>
    </>}
  </section>;
}

export function OrganizerEventStaffPage() {
  const { tx } = useLanguage();
  const base = useDashboardBase();
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

  if (!Number.isSafeInteger(eventId) || eventId <= 0) return <p role="alert">{tx("Некорректный ID мероприятия.")}</p>;
  if (staff.isLoading) return <LoadingState />;
  if (staff.error) return <ErrorState error={staff.error} onRetry={() => { void staff.refetch(); }} />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFormError(tx("Введите корректный email сотрудника."));
      return;
    }
    setFormError("");
    addStaff.mutate(normalizedEmail);
  };

  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <Link to={`${base}/sales`} className="text-sm underline">{tx("К продажам")}</Link>
        <h2 className="mt-2 text-xl font-bold">{tx("Сотрудники мероприятия")}</h2>
        <p className="mt-1 text-sm text-muted">{tx("Назначайте сотрудников, которым backend разрешает работу с check-in.")}</p>
      </div>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={tx("email сотрудника")}
          className="min-w-60 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={addStaff.isPending}>{addStaff.isPending ? tx("Назначаем…") : tx("Назначить")}</Button>
      </form>
      {(formError || addStaff.error) && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {formError || (addStaff.error instanceof Error ? tx(addStaff.error.message) : tx("Не удалось назначить сотрудника."))}
        </p>
      )}
      {removeStaffMutation.error && <ApiErrorMessage error={removeStaffMutation.error} />}
      {(staff.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface p-5 text-sm text-muted">{tx("Сотрудники ещё не назначены.")}</p>
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
  const { tx, locale } = useLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div><p className="font-medium">{person.email}</p><p className="text-xs text-muted">{tx("Назначен: ")}{formatLongDate(person.assignedAt, locale)}</p></div>
      <Button variant="secondary" disabled={pending} onClick={onRemove}>{tx("Убрать доступ")}</Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { tx } = useLanguage();
  return <div className="rounded-xl bg-surface p-4"><p className="text-xs text-muted">{tx(label)}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function LoadingState() {
  const { tx } = useLanguage();
  return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загрузка…")}</p>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { tx } = useLanguage();
  return (
    <div className="rounded-xl bg-red-50 p-5 text-sm text-red-800">
      <p>{error instanceof Error ? tx(error.message) : tx("Не удалось загрузить данные.")}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>{tx("Повторить")}</Button>
    </div>
  );
}

function ApiErrorMessage({ error }: { error: unknown }) {
  const { tx } = useLanguage();
  return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error instanceof Error ? tx(error.message) : tx("Не удалось изменить список сотрудников.")}</p>;
}
