import { useState } from "react";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { getEvent, setEventSuspended } from "../api/events";
import { changePayout, downloadCsv, getEventPayout, getOverview, getPayout, getPayouts, getReport, getReports, getSettings, reviewReport, searchAdmin, updateSettings, type AdminResource, type Filters, type Payout } from "../api/platform";
import { EventSuspensionDialog } from "../components/events/EventSuspensionDialog";
import { RequestError } from "../components/events/EventExtras";
import { Button } from "../components/ui/Button";
import { useLanguage } from "../i18n/LanguageContext";
import { downloadBlob } from "../lib/download";
import { formatPrice } from "../lib/format";

const field = "rounded-lg border p-2";
function Pager({ page, total = 0, setPage }: { page: number; total?: number; setPage: (page: number) => void }) {
  const { tx } = useLanguage();
  return total > 1 && <div className="my-4 flex items-center gap-3"><Button disabled={!page} onClick={() => setPage(page - 1)}>{tx("Назад")}</Button><span>{page + 1} / {total}</span><Button disabled={page + 1 >= total} onClick={() => setPage(page + 1)}>{tx("Далее")}</Button></div>;
}
export function AdminOverviewPage() {
  const { tx } = useLanguage();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: getOverview });
  const labels: Record<string, string> = { users: "Пользователи", suspendedUsers: "Приостановленные аккаунты", pendingOrganizerVerifications: "Заявки организаторов", publishedEvents: "Опубликованные события", suspendedEvents: "Приостановленные события", openEventReports: "Открытые жалобы", suspendedPaidSales: "Приостановленные платные продажи", scheduledPayouts: "Запланированные выплаты", payoutsOnHold: "Задержанные выплаты", failedPaymentsLast24Hours: "Ошибки оплаты за сутки", failedPaymentsLast7Days: "Ошибки оплаты за неделю", pendingRefunds: "Ожидающие возвраты", failedRefundsLast7Days: "Ошибки возврата за неделю", escalatedSupportCases: "Эскалации" };
  return <section><h2 className="text-xl font-bold">{tx("Обзор платформы")}</h2><RequestError error={overview.error} /><Button variant="secondary" onClick={() => void overview.refetch()}>{tx("Обновить")}</Button><div className="my-4 grid gap-3 sm:grid-cols-3">{Object.entries(overview.data ?? {}).filter(([,v]) => typeof v === "number").map(([key,value]) => <article key={key} className="rounded-xl border p-4"><p>{tx(labels[key] ?? key)}</p><strong className="text-2xl">{value}</strong></article>)}</div></section>;
}
export function AdminSearchPage({ resource }: { resource: AdminResource }) {
  const { tx, statusLabel, locale } = useLanguage();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(0);
  const rows = useQuery({ queryKey: ["admin-search", resource, filters, page], queryFn: () => searchAdmin(resource, { ...filters, page, size: 20 }) });
  const titles = { events: "Все мероприятия платформы", orders: "Заказы", payments: "Платежи", refunds: "Возвраты", campaigns: "Промокампании" };
  const statuses = { events: ["DRAFT", "PUBLISHED", "CANCELLED"], orders: ["PENDING", "PAID", "CANCELLED", "EXPIRED", "REFUNDED"], payments: ["SUCCEEDED", "FAILED"], refunds: ["PENDING", "SUCCEEDED", "FAILED"], campaigns: [] };
  return <section><h2 className="text-xl font-bold">{tx(titles[resource])}</h2><form className="my-4 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); setFilters(Object.fromEntries(Array.from(data.entries()).map(([k,v]) => [k,String(v)]))); setPage(0); }}>
    {resource !== "campaigns" && <input name="q" aria-label={tx("Поиск")} placeholder={tx("Поиск по имени или ID")} className={field} />}
    {resource !== "campaigns" && <select name="status" aria-label={tx("Статус")} className={field}><option value="">{tx("Все статусы")}</option>{statuses[resource].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>}
    {resource === "events" ? <><input name="organizerId" type="number" min="1" placeholder={tx("ID организатора")} className={field} /><select name="suspended" aria-label={tx("Приостановлено")} className={field}><option value="">{tx("Все")}</option><option value="true">{tx("Приостановлено")}</option><option value="false">{tx("Активен")}</option></select></> : <input name="eventId" type="number" min="1" placeholder={tx("ID события")} className={field} />}
    {resource === "campaigns" && <select name="enabled" aria-label={tx("Статус")} className={field}><option value="">{tx("Все")}</option><option value="true">{tx("Активен")}</option><option value="false">{tx("Отключено")}</option></select>}
    {resource === "payments" && <><input name="provider" placeholder={tx("Провайдер")} className={field} /><label>{tx("С даты")}<input name="from" type="date" className={field} /></label><label>{tx("По дату")}<input name="to" type="date" className={field} /></label></>}
    <Button type="submit">{tx("Найти")}</Button>
  </form><RequestError error={rows.error} />{rows.isLoading && <p>{tx("Загрузка…")}</p>}{rows.data?.content.length === 0 && <p>{tx("Ничего не найдено")}</p>}
    <div className="space-y-3">{rows.data?.content.map(row => <article key={row.id} className="rounded-xl border p-4"><p className="font-semibold">#{row.id} · {row.title ?? row.eventTitle ?? row.name ?? row.code ?? row.buyerEmail}</p><p className="flex flex-wrap items-center gap-2">{row.buyerEmail} {row.status && <StatusBadge status={row.status} />} {row.suspended && <StatusBadge status="SUSPENDED" />}</p>{(row.amount ?? row.totalAmount) !== undefined && <p>{formatPrice((row.amount ?? row.totalAmount)!, locale)}</p>}{row.provider && <p>{row.provider}</p>}{row.failureReason && <p role="status">{row.failureReason}</p>}{resource === "campaigns" && <p>{row.code} · {row.discountValue} · {row.usageCount} · {tx(row.enabled ? "Активен" : "Отключено")}</p>}{(row.eventId || resource === "events") && <Link to={`/events/${row.eventId ?? row.id}`} className="underline">{tx("Открыть событие")}</Link>}{resource === "events" && <><Link to={`/admin/dashboard/events/${row.id}/staff`} className="ml-4 underline">{tx("Сотрудники")}</Link><Link to={`/admin/dashboard/events/${row.id}/history`} className="ml-4 underline">{tx("История")}</Link><Link to="/admin/dashboard/manage" className="ml-4 underline">{tx("Модерация")}</Link></>}{resource === "orders" && <Link to={`/orders/${row.id}`} className="ml-4 underline">{tx("Открыть заказ")}</Link>}</article>)}</div><Pager page={page} total={rows.data?.totalPages} setPage={setPage} />
  </section>;
}
export function CsvDownloads({ payoutsOnly = false }: { payoutsOnly?: boolean }) {
  const { tx } = useLanguage();
  const [validation, setValidation] = useState("");
  const download = useMutation({ mutationFn: async (data: { resource: "events" | "payments" | "payouts"; from: string; to: string }) => downloadBlob(await downloadCsv(data.resource, { from: data.from, to: data.to }), `${data.resource}.csv`) });
  return <form className="my-5 flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const from = String(data.get("from")); const to = String(data.get("to")); const days = (Date.parse(to) - Date.parse(from)) / 86400000; if ((from && to && (days < 0 || days > 365)) || (!!from !== !!to)) { setValidation(tx("Укажите период не более 366 дней")); return; } setValidation(""); download.mutate({ resource: data.get("resource") as "events" | "payments" | "payouts", from, to }); }}>
    <label>{tx("Отчёт CSV")}<select name="resource" className={field}>{!payoutsOnly && <><option value="events">{tx("События")}</option><option value="payments">{tx("Платежи")}</option></>}<option value="payouts">{tx("Выплаты")}</option></select></label><label>{tx("С даты")}<input name="from" type="date" className={field} /></label><label>{tx("По дату")}<input name="to" type="date" className={field} /></label><Button type="submit" disabled={download.isPending}>{tx("Скачать CSV")}</Button><RequestError error={download.error || validation} />
  </form>;
}
export function AdminSettingsPage() {
  const { tx } = useLanguage();
  const cache = useQueryClient();
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: getSettings });
  const update = useMutation({ mutationFn: updateSettings, onSuccess: data => cache.setQueryData(["platform-settings"], data) });
  return <section><h2 className="text-xl font-bold">{tx("Настройки платформы")}</h2><p className="my-2">{tx("Изменения применяются только к будущим платежам")}</p><RequestError error={settings.error || update.error} />{settings.data && <form key={JSON.stringify(settings.data)} className="my-4 space-y-4" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); update.mutate({ activationFeeKzt: Number(data.get("activationFeeKzt")), processingFeePercent: Number(data.get("processingFeePercent")) }); }}><label className="block">{tx("Плата за активацию, ₸")}<input name="activationFeeKzt" type="number" required min="0" max="1000000" step="0.01" defaultValue={settings.data.activationFeeKzt} className={field} /></label><label className="block">{tx("Комиссия обработки, %")}<input name="processingFeePercent" type="number" required min="0" max="50" step="0.01" defaultValue={settings.data.processingFeePercent} className={field} /></label><Button disabled={update.isPending} type="submit">{tx("Сохранить")}</Button>{update.isSuccess && <p role="status">{tx("Сохранено")}</p>}</form>}<CsvDownloads /></section>;
}
export function AdminReportsPage() {
  const { tx, statusLabel } = useLanguage();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(0);
  const reports = useQuery({ queryKey: ["reports", status, page], queryFn: () => getReports({ status, page, size: 20 }) });
  return <section><h2 className="text-xl font-bold">{tx("Жалобы на события")}</h2><select aria-label={tx("Статус")} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }} className={`${field} my-4`}><option value="">{tx("Все статусы")}</option>{["OPEN", "DISMISSED", "ACTIONED"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><RequestError error={reports.error} />{reports.isLoading && <p>{tx("Загрузка…")}</p>}{reports.data?.content.length === 0 && <p>{tx("Ничего не найдено")}</p>}{reports.data?.content.map(report => <article key={report.id} className="my-3 rounded-xl border p-4"><Link className="underline" to={`/admin/dashboard/reports/${report.id}`}>#{report.id} · {report.eventTitle}</Link><p className="flex flex-wrap items-center gap-2">{report.reporterEmail} · {statusLabel(report.reason)} <StatusBadge status={report.status} /></p><p>{report.message}</p></article>)}<Pager page={page} total={reports.data?.totalPages} setPage={setPage} /></section>;
}
export function AdminReportPage() {
  const { tx, statusLabel } = useLanguage();
  const id = Number(useParams().reportId);
  const cache = useQueryClient();
  const [suspend, setSuspend] = useState(false);
  const report = useQuery({ queryKey: ["report", id], queryFn: () => getReport(id) });
  const event = useQuery({ queryKey: ["reported-event", report.data?.eventId], queryFn: () => getEvent(report.data!.eventId), enabled: !!report.data });
  const review = useMutation({ mutationFn: ({ outcome, note }: { outcome: "DISMISSED" | "ACTIONED"; note: string }) => reviewReport(id, outcome, note), onSuccess: async () => { await Promise.all([cache.invalidateQueries({ queryKey: ["report", id] }), cache.invalidateQueries({ queryKey: ["reports"] }), cache.invalidateQueries({ queryKey: ["admin-overview"] })]); } });
  const moderation = useMutation({ mutationFn: (reason: string) => setEventSuspended(report.data!.eventId, true, reason), onSuccess: async () => { setSuspend(false); await event.refetch(); await Promise.all([cache.invalidateQueries({ queryKey: ["reports"] }), cache.invalidateQueries({ queryKey: ["admin-overview"] }), cache.invalidateQueries({ queryKey: ["admin-search"] }), cache.invalidateQueries({ queryKey: ["organizer-events"] })]); } });
  return <section><RequestError error={report.error || review.error || event.error} />{report.data && <><h2 className="text-xl font-bold">{report.data.eventTitle}</h2><p>{report.data.reporterEmail} · {statusLabel(report.data.reason)} · {statusLabel(report.data.status)}</p><p className="my-3 whitespace-pre-wrap">{report.data.message}</p><p>{report.data.resolutionNote}</p><Link className="underline" to={`/events/${report.data.eventId}`}>{tx("Открыть событие")}</Link>{event.data && <Button variant="secondary" disabled={event.data.suspended || event.data.status === "CANCELLED"} onClick={() => { moderation.reset(); setSuspend(true); }}>{tx("Приостановить")}</Button>}{report.data.status === "OPEN" && <form className="my-4 space-y-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); review.mutate({ outcome: data.get("outcome") as "DISMISSED" | "ACTIONED", note: String(data.get("note") ?? "") }); }}><label className="block">{tx("Решение")}<select name="outcome" className={field}><option value="DISMISSED">{tx("Отклонить жалобу")}</option><option value="ACTIONED">{tx("Меры приняты")}</option></select></label><textarea aria-label={tx("Комментарий")} name="note" maxLength={500} className={`${field} block w-full`} /><Button type="submit" disabled={review.isPending}>{tx("Завершить рассмотрение")}</Button></form>}</>}{suspend && event.data && <EventSuspensionDialog event={event.data} pending={moderation.isPending} error={moderation.error} onClose={() => setSuspend(false)} onConfirm={reason => moderation.mutate(reason)} />}</section>;
}
function PayoutDetails({ payout }: { payout: Payout }) {
  const { tx, statusLabel, locale } = useLanguage();
  return <><h3 className="font-bold">{payout.eventTitle} · #{payout.id}</h3><p className="my-2 flex flex-wrap items-center gap-2">{tx("Симуляция выплаты")} <StatusBadge status={payout.status} /></p><p>{payout.organizerEmail}</p>{payout.statusReason && <p>{payout.statusReason}</p>}<dl className="my-3 grid grid-cols-2 gap-2">{([["Выручка",payout.grossRevenue],["Скидки",payout.discounts],["Возвраты",payout.refunds],["Комиссия",payout.processingFees],["К выплате",payout.amount]] as const).map(([label,value]) => <div key={label}><dt>{tx(label)}</dt><dd>{formatPrice(value,locale)}</dd></div>)}</dl>{payout.scheduledFor && <p>{payout.scheduledFor}</p>}{payout.reference && <p>{payout.reference} · {payout.bankName} · ****{payout.ibanLast4}</p>}</>;
}
export function PayoutsPage({ admin = false }: { admin?: boolean }) {
  const { tx, statusLabel } = useLanguage();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(0);
  const payouts = useQuery({ queryKey: ["payouts", admin, filters, page], queryFn: () => getPayouts(admin, { ...filters, page, size: 20 }) });
  return <section><h2 className="text-xl font-bold">{tx("Выплаты")}</h2><p>{tx("Симуляция: деньги не переводятся")}</p><form className="my-4 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); setFilters(Object.fromEntries(Array.from(data.entries()).map(([k,v]) => [k,String(v)]))); setPage(0); }}>{admin && <><input name="q" aria-label={tx("Поиск")} className={field} placeholder={tx("Поиск по имени или ID")} /><input name="eventId" type="number" min="1" className={field} placeholder={tx("ID события")} /><input name="organizerId" type="number" min="1" className={field} placeholder={tx("ID организатора")} /></>}<select name="status" aria-label={tx("Статус")} className={field}><option value="">{tx("Все статусы")}</option>{["SCHEDULED", "ON_HOLD", "PAID", "CANCELLED"].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><Button type="submit">{tx("Найти")}</Button></form><RequestError error={payouts.error} />{payouts.isLoading && <p>{tx("Загрузка…")}</p>}{payouts.data?.content.length === 0 && <p>{tx("Ничего не найдено")}</p>}{payouts.data?.content.map(payout => <article key={payout.id} className="my-3 rounded-xl border p-4"><PayoutDetails payout={payout} />{admin && <Link className="underline" to={`/admin/dashboard/payouts/${payout.id}`}>{tx("Управление")}</Link>}</article>)}<Pager page={page} total={payouts.data?.totalPages} setPage={setPage} />{admin && <CsvDownloads payoutsOnly />}</section>;
}
export function AdminPayoutPage() {
  const { tx } = useLanguage();
  const id = Number(useParams().payoutId);
  const cache = useQueryClient();
  const payout = useQuery({ queryKey: ["payout", id], queryFn: () => getPayout(id) });
  const action = useMutation({ mutationFn: (data: { action: "hold" | "release" | "pay-now"; reason?: string }) => changePayout(id, data.action, data.reason), onSuccess: async data => { cache.setQueryData(["payout", id], data); await cache.invalidateQueries({ queryKey: ["payouts"] }); await cache.invalidateQueries({ queryKey: ["admin-overview"] }); } });
  return <section><RequestError error={payout.error || action.error} />{payout.data && <><PayoutDetails payout={payout.data} />{!["PAID", "CANCELLED"].includes(payout.data.status) && <><form className="my-3 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); action.mutate({ action: "hold", reason: String(new FormData(e.currentTarget).get("reason")) }); }}><input name="reason" required maxLength={500} className={field} aria-label={tx("Причина задержки")} placeholder={tx("Причина задержки")} /><Button type="submit" disabled={action.isPending}>{tx("Задержать выплату")}</Button></form>{payout.data.status === "ON_HOLD" && <Button disabled={action.isPending} onClick={() => action.mutate({ action: "release" })}>{tx("Снять задержку")}</Button>}<Button disabled={action.isPending} onClick={() => action.mutate({ action: "pay-now" })}>{tx("Выплатить сейчас (симуляция)")}</Button></>}</>}</section>;
}
export function EventPayoutPage() {
  const { tx } = useLanguage();
  const id = Number(useParams().eventId);
  const payout = useQuery({ queryKey: ["event-payout", id], queryFn: () => getEventPayout(id), retry: false });
  return <section><h2 className="text-xl font-bold">{tx("Выплата за событие")}</h2>{payout.error instanceof ApiError && payout.error.status === 404 ? <p>{tx("Выплата ещё не запланирована")}</p> : <RequestError error={payout.error} />}{payout.data && <PayoutDetails payout={payout.data} />}</section>;
}
