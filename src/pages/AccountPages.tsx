import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAssignedEvents,
  getEventAttendees,
  getEventCheckInStats,
  scanEventTicket,
  undoEventCheckIn,
} from "../api/checkIn";
import { cancelOrder, getMyOrders, getMyTickets, getTicketQr } from "../api/orders";
import { deleteUser, getUsers, updateUser, type UpdateUserRequest } from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { formatPrice } from "../lib/format";
import type { Order, Ticket, User } from "../api/types";

const PAGE_SIZE = 20;

export function MyAccountPage() {
  const { isLoggedIn, openLogin } = useAuth();
  const queryClient = useQueryClient();
  const [ordersPage, setOrdersPage] = useState(0);
  const [ticketsPage, setTicketsPage] = useState(0);
  const orders = useQuery({
    queryKey: ["my-orders", ordersPage],
    queryFn: () => getMyOrders(ordersPage, PAGE_SIZE),
    enabled: isLoggedIn,
  });
  const tickets = useQuery({
    queryKey: ["my-tickets", ticketsPage],
    queryFn: () => getMyTickets(ticketsPage, PAGE_SIZE),
    enabled: isLoggedIn,
  });
  const cancel = useMutation({
    mutationFn: (orderId: number) => cancelOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    },
  });

  if (!isLoggedIn) {
    return <AccessPanel title="Войдите в аккаунт" detail="Для просмотра заказов и билетов нужно войти." action={<Button onClick={openLogin}>Войти</Button>} />;
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Мои заказы</h1>
        {orders.error ? <ErrorPanel error={orders.error} retry={() => { void orders.refetch(); }} /> : orders.isLoading ? <Loading /> : (
          <>
            {(orders.data?.content ?? []).length === 0 ? <Empty text="У вас пока нет заказов." /> : (
              <div className="mt-4 space-y-3">
                {(orders.data?.content ?? []).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    pending={cancel.isPending}
                    error={cancel.variables === order.id ? cancel.error : null}
                    onCancel={() => {
                      if (window.confirm(`Отменить заказ №${order.id}?`)) cancel.mutate(order.id);
                    }}
                  />
                ))}
              </div>
            )}
            <Pagination page={ordersPage} totalPages={orders.data?.totalPages ?? 0} onChange={setOrdersPage} />
          </>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">Мои билеты</h2>
        {tickets.error ? <ErrorPanel error={tickets.error} retry={() => { void tickets.refetch(); }} /> : tickets.isLoading ? <Loading /> : (
          <>
            {(tickets.data?.content ?? []).length === 0 ? <Empty text="Билеты не найдены." /> : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(tickets.data?.content ?? []).map((ticket) => <MyTicketCard key={ticket.id} ticket={ticket} />)}
              </div>
            )}
            <Pagination page={ticketsPage} totalPages={tickets.data?.totalPages ?? 0} onChange={setTicketsPage} />
          </>
        )}
      </section>
    </div>
  );
}

function OrderCard({ order, pending, error, onCancel }: { order: Order; pending: boolean; error: unknown; onCancel: () => void }) {
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{order.eventTitle}</h3>
          <p className="mt-1 text-xs text-muted">Заказ №{order.id} · {new Date(order.createdAt).toLocaleString("ru-RU")}</p>
        </div>
        <strong>{formatPrice(order.totalAmount)}</strong>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {order.items.map((item) => <li key={item.ticketTypeId}>{item.ticketTypeName} × {item.quantity}</li>)}
      </ul>
      <p className="mt-3 text-sm">Статус: {order.status}</p>
      <Link to={`/orders/${order.id}`} className="mt-3 inline-block text-sm font-semibold underline">Открыть заказ</Link>
      {order.status === "PENDING" && <Button variant="secondary" className="ml-3" disabled={pending} onClick={onCancel}>Отменить заказ</Button>}
      {error != null && <ApiErrorMessage error={error} />}
    </article>
  );
}

function MyTicketCard({ ticket }: { ticket: Ticket }) {
  const [showQr, setShowQr] = useState(false);
  const qr = useQuery({
    queryKey: ["ticket-qr", ticket.id],
    queryFn: async () => {
      const blob = await getTicketQr(ticket.id);
      if (blob.type.startsWith("image/")) return blob;
      const raw = (await blob.text()).trim();
      let encoded = raw;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "string") encoded = parsed;
      } catch {
        // The API may return a raw base64 string instead of JSON.
      }
      const data = encoded.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new Blob([bytes], { type: "image/png" });
    },
    enabled: showQr,
    staleTime: 5 * 60 * 1000,
  });
  const qrUrl = useObjectUrl(qr.data);

  return (
    <article className="rounded-xl border p-4">
      <p className="text-xs text-muted">{ticket.eventTitle}</p>
      <h3 className="mt-1 font-semibold">{ticket.ticketTypeName}</h3>
      <p className="mt-2 text-sm">Статус: {ticket.status}</p>
      <p className="mt-1 text-xs text-muted">Билет №{ticket.id} · Заказ №{ticket.orderId}</p>
      <Button variant="secondary" className="mt-3" onClick={() => setShowQr((value) => !value)}>
        {showQr ? "Скрыть QR-код" : "Показать QR-код"}
      </Button>
      {showQr && qr.isLoading && <p className="mt-3 text-sm text-muted">Загружаем QR-код…</p>}
      {showQr && qr.error && <ApiErrorMessage error={qr.error} />}
      {showQr && qrUrl && <img src={qrUrl} alt={`QR-код билета ${ticket.id}`} className="mt-3 h-48 w-48 rounded border bg-white p-2" />}
    </article>
  );
}

export function EventCheckInPage() {
  const assignedEvents = useQuery({
    queryKey: ["assigned-events"],
    queryFn: () => getAssignedEvents(),
  });
  const events = assignedEvents.data?.content ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const eventId = events.some((event) => event.id === selectedId) ? selectedId! : events[0]?.id ?? 0;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const queryClient = useQueryClient();
  const stats = useQuery({
    queryKey: ["check-in-stats", eventId],
    queryFn: () => getEventCheckInStats(eventId),
    enabled: eventId > 0,
  });
  const attendees = useQuery({
    queryKey: ["event-attendees", eventId, search, page],
    queryFn: () => getEventAttendees(eventId, search, page, PAGE_SIZE),
    enabled: eventId > 0,
  });
  const scan = useMutation({
    mutationFn: (ticketCode: string) => scanEventTicket(eventId, ticketCode),
    onSuccess: async (result) => {
      setScanMessage(result.message || `Проверка завершена: ${result.result}`);
      setCode("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["check-in-stats", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] }),
      ]);
    },
    onError: (error) => setScanMessage(error instanceof Error ? error.message : "Не удалось проверить билет."),
  });
  const undo = useMutation({
    mutationFn: (ticketId: number) => undoEventCheckIn(eventId, ticketId),
    onSuccess: async (result) => {
      setScanMessage(result.message || "Отметка о проходе отменена.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["check-in-stats", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] }),
      ]);
    },
  });

  if (assignedEvents.isLoading) return <Loading />;
  if (assignedEvents.error) return <ErrorPanel error={assignedEvents.error} retry={() => { void assignedEvents.refetch(); }} />;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  };
  const submitScan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticketCode = code.trim();
    if (!ticketCode || !eventId) return;
    setScanMessage("");
    scan.mutate(ticketCode);
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Check-in мероприятия</h1>
        <p className="mt-1 text-sm text-muted">Доступны только назначенные вам мероприятия.</p>
      </div>
      {events.length === 0 ? <Empty text="Вам пока не назначили мероприятия." /> : (
        <>
          <label className="block max-w-xl text-sm font-medium">
            Мероприятие
            <select value={eventId} onChange={(event) => { setSelectedId(Number(event.target.value)); setPage(0); }} className="mt-1 block w-full rounded-lg border px-3 py-2">
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </label>

          {stats.error ? <ErrorPanel error={stats.error} retry={() => { void stats.refetch(); }} /> : stats.data && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Зарегистрировано" value={stats.data.registered} />
              <Metric label="Прошли check-in" value={stats.data.checkedIn} />
              <Metric label="Ещё не прошли" value={stats.data.notCheckedIn} />
            </div>
          )}

          <form onSubmit={submitScan} className="rounded-xl border p-4">
            <h2 className="font-semibold">Проверить билет</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Код билета" className="min-w-60 flex-1 rounded-lg border px-3 py-2 text-sm" />
              <Button type="submit" disabled={!code.trim() || scan.isPending}>{scan.isPending ? "Проверяем…" : "Проверить"}</Button>
            </div>
            {scanMessage && <p role="status" className="mt-3 rounded-md bg-surface p-3 text-sm">{scanMessage}</p>}
            {undo.error && <ApiErrorMessage error={undo.error} />}
          </form>

          <div>
            <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Email, код или билет" className="min-w-60 flex-1 rounded-lg border px-3 py-2 text-sm" />
              <Button type="submit">Найти участника</Button>
            </form>
            {attendees.error ? <ErrorPanel error={attendees.error} retry={() => { void attendees.refetch(); }} /> : attendees.isLoading ? <Loading /> : (
              <>
                {(attendees.data?.content ?? []).length === 0 ? <Empty text="Участники не найдены." /> : (
                  <div className="mt-3 space-y-2">
                    {(attendees.data?.content ?? []).map((ticket) => (
                      <AttendeeRow key={ticket.id} ticket={ticket} pending={undo.isPending} onUndo={() => undo.mutate(ticket.id)} />
                    ))}
                  </div>
                )}
                <Pagination page={page} totalPages={attendees.data?.totalPages ?? 0} onChange={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AttendeeRow({ ticket, pending, onUndo }: { ticket: Ticket; pending: boolean; onUndo: () => void }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div>
        <p className="font-medium">{ticket.attendeeEmail}</p>
        <p className="text-sm text-muted">{ticket.ticketTypeName} · Билет №{ticket.id} · {ticket.status}</p>
        {ticket.usedAt && <p className="text-xs text-muted">Отмечен: {new Date(ticket.usedAt).toLocaleString("ru-RU")}</p>}
      </div>
      {ticket.status === "USED" && <Button variant="secondary" disabled={pending} onClick={onUndo}>Отменить check-in</Button>}
    </article>
  );
}

export function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const users = useQuery({ queryKey: ["admin-users", page], queryFn: () => getUsers(page, PAGE_SIZE) });
  const remove = useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  if (users.isLoading) return <Loading />;
  if (users.error) return <ErrorPanel error={users.error} retry={() => { void users.refetch(); }} />;

  return (
    <section>
      <h1 className="text-2xl font-bold">Пользователи платформы</h1>
      <p className="mt-1 text-sm text-muted">Можно просматривать пользователей, менять email/пароль и удалять аккаунты. Управления ролями API не предоставляет.</p>
      {(users.data?.content ?? []).length === 0 ? <Empty text="Пользователи не найдены." /> : (
        <div className="mt-4 space-y-3">
          {(users.data?.content ?? []).map((user) => (
            <AdminUserCard
              key={user.id}
              user={user}
              pending={remove.isPending}
              onDelete={() => {
                if (window.confirm(`Удалить пользователя ${user.email}?`)) remove.mutate(user.id);
              }}
            />
          ))}
        </div>
      )}
      {remove.error && <ApiErrorMessage error={remove.error} />}
      <Pagination page={page} totalPages={users.data?.totalPages ?? 0} onChange={setPage} />
    </section>
  );
}

function AdminUserCard({ user, pending, onDelete }: { user: User; pending: boolean; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const update = useMutation({
    mutationFn: (request: UpdateUserRequest) => updateUser(user.id, request),
    onSuccess: async () => {
      setEditing(false);
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Введите корректный email.");
      return;
    }
    if (password && password.length < 6) {
      setFormError("Пароль должен содержать не менее 6 символов.");
      return;
    }
    const request: UpdateUserRequest = {};
    if (email.trim() !== user.email) request.email = email.trim();
    if (password) request.password = password;
    if (!request.email && !request.password) {
      setFormError("Изменений нет.");
      return;
    }
    setFormError("");
    update.mutate(request);
  };

  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-medium">{user.email}</p><p className="text-xs text-muted">ID {user.id} · Роль: {user.role}</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Закрыть" : "Изменить"}</Button>
          <Button variant="secondary" disabled={pending} onClick={onDelete}>Удалить</Button>
        </div>
      </div>
      {editing && (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t pt-4">
          <label className="block text-sm">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm">Новый пароль (необязательно)<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          {(formError || update.error) && <ApiErrorMessage error={formError || update.error} />}
          <Button type="submit" disabled={update.isPending}>{update.isPending ? "Сохраняем…" : "Сохранить изменения"}</Button>
        </form>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-surface p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-bold">{value.toLocaleString("ru-RU")}</p></div>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Страницы" className="mt-4 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={page <= 0} onClick={() => onChange(page - 1)}>Назад</Button>
      <span className="text-sm">{page + 1} / {totalPages}</span>
      <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Далее</Button>
    </nav>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl bg-surface p-5 text-center text-sm text-muted">{text}</p>;
}

function Loading() {
  return <p className="mt-4 rounded-xl bg-surface p-5 text-center text-sm">Загрузка…</p>;
}

function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
      <p>{error instanceof Error ? error.message : "Не удалось загрузить данные."}</p>
      <Button variant="secondary" className="mt-3" onClick={retry}>Повторить</Button>
    </div>
  );
}

function ApiErrorMessage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Запрос не выполнен.";
  return <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>;
}

function AccessPanel({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return <div className="mx-auto max-w-xl rounded-xl border p-8 text-center"><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-muted">{detail}</p><div className="mt-4">{action}</div></div>;
}

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);
  return url;
}
