import { formatDateTime } from "../lib/format";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useLanguage } from "../i18n/LanguageContext";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignCase, escalateCase, getSupportCase, getSupportCases, openSupportCase, replyToCase, setCaseStatus, type SupportCategory, type SupportDetail, type SupportInput, type SupportStatus } from "../api/support";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { MutationError, Pagination } from "../components/ui/AsyncState";
import { RefundOrderButton } from "../components/orders/RefundOrderButton";
import { getEventOrders } from "../api/sales";
import { formatPrice } from "../lib/format";

const statuses: Record<SupportStatus, string> = { OPEN: "Открыто", IN_PROGRESS: "В работе", WAITING_FOR_CUSTOMER: "Ожидает ответа посетителя", RESOLVED: "Решено" };
const categories: Record<SupportCategory, string> = { TICKET_DELIVERY: "Получение билета", PAYMENT: "Оплата", REFUND: "Вопрос о возврате", SEATING: "Места", EVENT_INFORMATION: "Информация о событии", CHECK_IN: "Проход на событие", ACCOUNT: "Аккаунт", ACTIVATION: "Активация продаж", TECHNICAL: "Техническая проблема", OTHER: "Другое" };
const normalizeRole = (role?: string) => role?.trim().toUpperCase().replace(/^ROLE_/, "");

export function SupportListPage({ escalatedOnly = false }: { escalatedOnly?: boolean }) {
  const { tx, locale } = useLanguage();
  const { user, isLoggedIn, openLogin } = useAuth();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ["support-cases", user?.id, status, escalatedOnly, page], queryFn: () => getSupportCases(status, escalatedOnly, page), enabled: isLoggedIn, refetchInterval: 15000 });
  if (!isLoggedIn) return <Button onClick={openLogin}>{tx("Войти в поддержку")}</Button>;
  return <section className="mx-auto max-w-3xl space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">{escalatedOnly ? tx("Эскалированные обращения") : tx("Поддержка")}</h1><Link to="/support/new" className={buttonClass()}>{tx("Создать обращение")}</Link></div>
    <label className="block text-sm">{tx("Статус")}<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className="ml-3 rounded-lg border p-2"><option value="">{tx("Все")}</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{tx(value)}</option>)}</select></label>
    {list.isLoading && <p>{tx("Загрузка…")}</p>}
    {list.error && <ErrorMessage error={list.error} onRetry={() => void list.refetch()} />}
    {list.data?.content.length === 0 && <p className="rounded-xl bg-surface p-5 text-sm">{tx("Обращений нет.")}</p>}
    {list.data?.content.map(item => <Link to={`/support/${item.id}`} key={item.id} className="block space-y-1 rounded-xl border p-4 hover:bg-surface">
      <h2 className="break-words font-semibold">№{item.id} · {item.subject}</h2><p className="text-sm">{tx(statuses[item.status])}{item.escalated ? tx(" · Передано платформе") : ""}</p><p className="text-xs text-muted">{item.eventTitle ?? tx("Поддержка платформы")} · {formatDateTime(item.updatedAt, locale)}</p>
    </Link>)}
    <Pagination page={page} totalPages={list.data?.totalPages ?? 0} onChange={setPage} />
  </section>;
}

export function NewSupportCasePage() {
  const { tx } = useLanguage();
  const { user, isLoggedIn, openLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [type, setType] = useState<"ATTENDEE" | "PLATFORM">("ATTENDEE");
  const [category, setCategory] = useState<SupportCategory>("OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState(params.get("eventId") ?? "");
  const [orderId, setOrderId] = useState(params.get("orderId") ?? "");
  const [ticketId, setTicketId] = useState(params.get("ticketId") ?? "");
  const [validation, setValidation] = useState("");
  const create = useMutation({ mutationFn: (body: SupportInput) => openSupportCase(body), onSuccess: async detail => { await client.invalidateQueries({ queryKey: ["support-cases"] }); navigate(`/support/${detail.supportCase.id}`); } });
  if (!isLoggedIn) return <Button onClick={openLogin}>{tx("Войти для создания обращения")}</Button>;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setValidation("");
    if (!subject.trim() || !message.trim()) { setValidation(tx("Заполните тему и сообщение.")); return; }
    if (type === "ATTENDEE" && !eventId && !orderId && !ticketId) { setValidation(tx("Укажите событие, заказ или билет, по которому нужна помощь.")); return; }
    create.mutate({ type, category, subject: subject.trim(), message: message.trim(), eventId: eventId ? Number(eventId) : undefined, ...(type === "ATTENDEE" ? { orderId: orderId ? Number(orderId) : undefined, ticketId: ticketId ? Number(ticketId) : undefined } : {}) });
  };
  return <section className="mx-auto max-w-2xl space-y-4">
    <Link to="/support" className="text-sm underline">{tx("← Обращения")}</Link><h1 className="text-2xl font-bold">{tx("Новое обращение")}</h1>
    <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
      {normalizeRole(user?.role) === "ORGANIZER" && <label className="block text-sm">{tx("Кому")}<select value={type} onChange={e => setType(e.target.value as typeof type)} className="mt-1 w-full rounded-lg border p-2"><option value="ATTENDEE">{tx("Организатору события")}</option><option value="PLATFORM">{tx("Поддержке платформы")}</option></select></label>}
      <label className="block text-sm">{tx("Категория")}<select value={category} onChange={e => setCategory(e.target.value as SupportCategory)} className="mt-1 w-full rounded-lg border p-2">{Object.entries(categories).map(([key, value]) => <option key={key} value={key}>{tx(value)}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-3">{[{ label: tx("ID события"), value: eventId, set: setEventId }, ...(type === "ATTENDEE" ? [{ label: tx("Номер заказа"), value: orderId, set: setOrderId }, { label: tx("Номер билета"), value: ticketId, set: setTicketId }] : [])].map(field => <label key={field.label} className="block text-sm">{field.label}<input type="number" min={1} step={1} value={field.value} onChange={e => field.set(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>)}</div>
      <p className="text-xs text-muted">{tx("Откройте поддержку со страницы события, заказа или билета — номер заполнится автоматически.")}</p>
      <label className="block text-sm">{tx("Тема")}<input required maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="block text-sm">{tx("Сообщение")}<textarea required maxLength={4000} rows={5} value={message} onChange={e => setMessage(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      {validation && <p role="alert" className="text-sm text-red-700">{tx(validation)}</p>}<MutationError error={create.error} />
      <Button type="submit" disabled={create.isPending}>{create.isPending ? tx("Отправляем…") : tx("Отправить")}</Button>
    </form>
  </section>;
}

export function SupportCasePage() {
  const { tx, locale } = useLanguage();
  const id = Number(useParams().caseId);
  const { user, isLoggedIn, openLogin } = useAuth();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const detail = useQuery({ queryKey: ["support-case", user?.id, id], queryFn: () => getSupportCase(id), enabled: isLoggedIn && Number.isSafeInteger(id) && id > 0, refetchInterval: 10000, retry: false });
  const action = useMutation({
    mutationFn: (work: () => Promise<SupportDetail>) => work(),
    onSuccess: async updated => { client.setQueryData(["support-case", user?.id, id], updated); await client.invalidateQueries({ queryKey: ["support-cases"] }); },
  });
  const reply = useMutation({ mutationFn: () => replyToCase(id, body.trim()), onSuccess: async updated => { setBody(""); client.setQueryData(["support-case", user?.id, id], updated); await client.invalidateQueries({ queryKey: ["support-cases"] }); } });
  if (!Number.isSafeInteger(id) || id <= 0) return <p role="alert">{tx("Некорректный номер обращения.")}</p>;
  if (!isLoggedIn) return <Button onClick={openLogin}>{tx("Войти для просмотра обращения")}</Button>;
  if (detail.isLoading) return <p>{tx("Загрузка…")}</p>;
  if (detail.error || !detail.data) return <ErrorMessage error={detail.error ?? new Error(tx("Обращение недоступно."))} onRetry={() => void detail.refetch()} />;
  const item = detail.data.supportCase;
  const role = normalizeRole(user?.role);
  const isRequester = user?.id === item.requesterId;
  const platformAdmin = role === "PLATFORM_ADMIN" || role === "ADMIN";
  const handler = !isRequester && (platformAdmin || (item.type === "ATTENDEE" && (role === "ORGANIZER" || role === "EVENT_ADMIN")));
  const busy = action.isPending || reply.isPending;
  return <section className="mx-auto max-w-3xl space-y-4">
    <Link to="/support" className="text-sm underline">{tx("← Обращения")}</Link>
    <h1 className="break-words text-2xl font-bold">№{item.id} · {item.subject}</h1>
    <p className="text-sm">{tx(statuses[item.status])} · {tx(categories[item.category])}{item.escalated ? tx(" · Передано платформе") : ""}</p>
    {item.eventTitle && <p className="text-sm text-muted">{item.eventTitle}</p>}
    {handler && <section className="space-y-3 rounded-xl bg-surface p-4">
      <p className="text-sm">{tx("Исполнитель: ")}{item.assigneeEmail ?? tx("Не назначен")}</p>
      <form onSubmit={e => { e.preventDefault(); action.mutate(() => assignCase(id, assignee.trim())); }} className="flex flex-wrap gap-2">
        <label className="min-w-40 flex-1 text-sm">{tx("Email исполнителя")}<input type="email" required value={assignee} onChange={e => setAssignee(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label><Button type="submit" disabled={busy}>{tx("Назначить")}</Button>
      </form>
      <label className="block text-sm">{tx("Изменить статус")}<select value={item.status} disabled={busy} onChange={e => { const status = e.target.value as SupportStatus; action.mutate(() => setCaseStatus(id, status)); }} className="ml-3 rounded-lg border bg-white p-2">{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{tx(label)}</option>)}</select></label>
      {!item.escalated && (platformAdmin || role === "ORGANIZER") && <Button variant="secondary" disabled={busy} onClick={() => action.mutate(() => escalateCase(id))}>{tx("Передать платформе")}</Button>}
    </section>}
    {!isRequester && item.type === "ATTENDEE" && item.eventId != null && !!item.requesterEmail && (role === "ORGANIZER" || platformAdmin) && (
      <CaseOrdersPanel eventId={item.eventId} requesterEmail={item.requesterEmail} orderId={item.orderId} />
    )}
    <MutationError error={action.error} />
    <div className="space-y-3" aria-label={tx("Переписка")}>{detail.data.messages.map(message => <article key={message.id} className={`rounded-xl border p-4 ${message.fromStaff ? "bg-indigo-50" : "bg-surface"}`}><p className="text-sm font-semibold">{message.authorName}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p><p className="mt-2 text-xs text-muted">{formatDateTime(message.createdAt, locale)}</p></article>)}</div>
    {item.status === "RESOLVED" && !isRequester ? <p className="text-sm">{tx("Чтобы ответить, сначала измените статус обращения.")}</p> : <form onSubmit={e => { e.preventDefault(); if (body.trim()) reply.mutate(); }} className="space-y-3">
      <label className="block text-sm">{tx("Ваш ответ")}<textarea required rows={4} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      {item.status === "RESOLVED" && <p className="text-xs text-muted">{tx("Ваш ответ снова откроет обращение.")}</p>}
      <MutationError error={reply.error} /><Button type="submit" disabled={busy || !body.trim()}>{tx("Отправить ответ")}</Button>
    </form>}
  </section>;
}

// The requester's orders for the case's event, so the organizer can refund right from the case.
// The query key starts with "organizer-event-orders", so RefundOrderButton refreshes it after a refund.
function CaseOrdersPanel({ eventId, requesterEmail, orderId }: { eventId: number; requesterEmail: string; orderId?: number }) {
  const { tx, locale, statusLabel } = useLanguage();
  const orders = useQuery({
    queryKey: ["organizer-event-orders", "support-case", eventId, requesterEmail],
    queryFn: () => getEventOrders(eventId, { query: requesterEmail, size: 50 }),
  });
  const email = requesterEmail.trim().toLowerCase();
  const rows = (orders.data?.content ?? [])
    .filter(order => order.buyerEmail.trim().toLowerCase() === email)
    .filter(order => orderId == null || order.id === orderId);
  return <section className="space-y-2 rounded-xl border p-4">
    <h2 className="font-semibold">{orderId != null ? tx("Заказ посетителя") : tx("Заказы посетителя")}</h2>
    {orders.isLoading && <p className="text-sm">{tx("Загрузка…")}</p>}
    {orders.error && <ErrorMessage error={orders.error} onRetry={() => void orders.refetch()} />}
    {orders.data && rows.length === 0 && <p className="text-sm text-muted">{tx("У посетителя нет заказов на это мероприятие.")}</p>}
    {rows.map(order => <article key={order.id} className="rounded-lg bg-surface p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <strong>{tx("Заказ №")}{order.id}</strong>
        <span className="flex items-center gap-2">{formatPrice(order.totalAmount, locale)} <StatusBadge status={order.status} /></span>
      </div>
      <p className="mt-1 text-xs text-muted">{formatDateTime(order.createdAt, locale)}</p>
      <ul className="mt-2 text-xs">{order.items.map(i => <li key={i.ticketTypeId}>{i.ticketTypeName} × {i.quantity}</li>)}</ul>
      {order.status === "PAID" && <RefundOrderButton orderId={order.id} totalAmount={order.totalAmount} />}
    </article>)}
  </section>;
}
