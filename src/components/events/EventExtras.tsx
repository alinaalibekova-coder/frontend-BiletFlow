import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { downloadCalendar, getCalendar, reportEvent, type ReportReason } from "../../api/platform";
import { downloadBlob } from "../../lib/download";
import { useLanguage } from "../../i18n/LanguageContext";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icons";

export function RequestError({ error }: { error: unknown }) {
  const { tx } = useLanguage();
  return error ? <p role="alert" className="my-2 text-sm text-red-700">{typeof error === "string" ? tx(error) : error instanceof Error ? tx(error.message) : tx("Ошибка сервера. Попробуйте позже.")}</p> : null;
}
// resolveStatus asks the calendar endpoint up front whether the event was cancelled; pass
// `cancelled` instead when the event itself is already loaded.
export function CalendarMenu({ eventId, cancelled = false, resolveStatus = false, className = "my-3" }: { eventId: number; cancelled?: boolean; resolveStatus?: boolean; className?: string }) {
  const { tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const links = useQuery({ queryKey: ["calendar", eventId], queryFn: () => getCalendar(eventId), enabled: !cancelled && (open || resolveStatus), retry: false });
  const download = useMutation({ mutationFn: async () => downloadBlob(await downloadCalendar(eventId), `event-${eventId}.ics`) });
  if (cancelled || links.data?.cancelled) return <div className={className}><Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()} className="inline-flex items-center gap-2"><Icon name="download" className="h-4 w-4" />{tx("Скачать отмену события (.ics)")}</Button><RequestError error={download.error} /></div>;
  const chip = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold hover:border-primary hover:bg-primary-soft hover:text-primary-dark";
  return <div className={className}><Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-2"><Icon name="calendar" className="h-4 w-4" />{tx("Добавить в календарь")}<Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></Button>{open && <div className="mt-2 text-sm">
    {links.isLoading && <p>{tx("Загрузка…")}</p>}
    <RequestError error={links.error || download.error} />
    {links.data && !links.data.cancelled && <div role="group" aria-label={tx("Добавить в календарь")} className="flex flex-wrap gap-2">
      {[["Google Calendar", links.data.googleCalendarUrl], ["Outlook", links.data.outlookUrl], ["Office 365", links.data.office365Url]].map(([name, url]) => url && <a key={name} href={url} target="_blank" rel="noopener noreferrer" className={chip}>{name}</a>)}
      <button type="button" disabled={download.isPending} onClick={() => download.mutate()} className={`${chip} disabled:opacity-50`}><Icon name="download" className="h-4 w-4" />{tx("Скачать .ics")}</button>
    </div>}
    {links.error && <Button variant="secondary" onClick={() => void links.refetch()}>{tx("Повторить")}</Button>}
  </div>}</div>;
}
export function ReportEventForm({ eventId }: { eventId: number }) {
  const { tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const report = useMutation({ mutationFn: (data: { reason: ReportReason; message: string }) => reportEvent(eventId, data.reason, data.message) });
  return <section className="mt-5"><Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>{tx("Пожаловаться на событие")}</Button>{open && <form className="mt-3 space-y-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); report.mutate({ reason: data.get("reason") as ReportReason, message: String(data.get("message") ?? "") }); }}>
    <label className="block">{tx("Причина")}<select name="reason" className="ml-3 rounded border p-2">{([['FRAUD','Мошенничество'],['MISLEADING','Недостоверная информация'],['INAPPROPRIATE','Неприемлемый контент'],['SPAM','Спам'],['OTHER','Другое']] as const).map(([v,l]) => <option key={v} value={v}>{tx(l)}</option>)}</select></label>
    <label className="block">{tx("Сообщение")}<textarea name="message" maxLength={1000} className="mt-1 block w-full rounded border p-2" /></label>
    <RequestError error={report.error} />
    {report.isSuccess ? <p role="status">{tx("Жалоба отправлена")}</p> : <Button disabled={report.isPending} type="submit">{tx("Отправить")}</Button>}
  </form>}</section>;
}

// Shares the event with the system share sheet where there is one, otherwise copies the link.
export function ShareButton({ title }: { title: string }) {
  const { tx } = useLanguage();
  const [status, setStatus] = useState("");
  const share = async () => {
    const url = window.location.href.replace(/[?&]promo=[^&#]*/, "");
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus(tx("Ссылка скопирована"));
    } catch (error) {
      // Closing the share sheet is not an error worth showing.
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus(tx("Не удалось скопировать ссылку"));
    }
  };
  return <>
    <button type="button" onClick={() => void share()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25">
      <Icon name="share" className="h-4 w-4" />{tx("Поделиться")}
    </button>
    <span role="status" className="text-sm text-white/90">{status}</span>
  </>;
}
