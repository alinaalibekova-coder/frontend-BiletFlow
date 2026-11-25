import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { downloadCalendar, getCalendar, reportEvent, type ReportReason } from "../../api/platform";
import { downloadBlob } from "../../lib/download";
import { useLanguage } from "../../i18n/LanguageContext";
import { Button } from "../ui/Button";

export function RequestError({ error }: { error: unknown }) {
  const { tx } = useLanguage();
  return error ? <p role="alert" className="my-2 text-sm text-red-700">{typeof error === "string" ? tx(error) : error instanceof Error ? tx(error.message) : tx("Ошибка сервера. Попробуйте позже.")}</p> : null;
}
// resolveStatus asks the calendar endpoint up front whether the event was cancelled; pass
// `cancelled` instead when the event itself is already loaded.
export function CalendarMenu({ eventId, cancelled = false, resolveStatus = false }: { eventId: number; cancelled?: boolean; resolveStatus?: boolean }) {
  const { tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const links = useQuery({ queryKey: ["calendar", eventId], queryFn: () => getCalendar(eventId), enabled: !cancelled && (open || resolveStatus), retry: false });
  const download = useMutation({ mutationFn: async () => downloadBlob(await downloadCalendar(eventId), `event-${eventId}.ics`) });
  if (cancelled || links.data?.cancelled) return <div className="my-3"><Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>{tx("Скачать отмену события (.ics)")}</Button><RequestError error={download.error} /></div>;
  return <div className="my-3"><Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>{tx("Добавить в календарь")}</Button>{open && <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
    {links.isLoading && <p>{tx("Загрузка…")}</p>}
    <RequestError error={links.error || download.error} />
    {links.data && !links.data.cancelled && <>
      {[["Google Calendar", links.data.googleCalendarUrl], ["Outlook", links.data.outlookUrl], ["Office 365", links.data.office365Url]].map(([name, url]) => url && <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="underline">{name}</a>)}
      <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>{tx("Скачать .ics")}</Button>
    </>}
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
