import { useLanguage } from "../../i18n/LanguageContext";
import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { MutationError } from "../ui/AsyncState";

interface Props {
  event: { id: number; title: string };
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function EventSuspensionDialog({ event, pending, error, onConfirm, onClose }: Props) {
  const { tx } = useLanguage();
  const [reason, setReason] = useState("");
  const close = () => { if (!pending) onClose(); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pending && reason.trim()) onConfirm(reason.trim());
  };

  return <Modal open onClose={close} title={tx("Приостановить мероприятие")}>
    <p className="mt-3 break-words text-sm font-semibold">{event.title}</p>
    <p className="mt-2 text-sm text-muted">{tx("Мероприятие будет скрыто от посетителей. Новые заказы и оплаты остановятся, неоплаченные заказы отменятся. Уже проданные билеты сохранятся.")}</p>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium">{tx("Причина приостановки")}<textarea autoFocus required maxLength={500} rows={4} value={reason} disabled={pending} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded-lg border bg-white p-3 text-sm" />
      </label>
      <p className="text-xs text-muted">{reason.length} / 500</p>
      <MutationError error={error} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !reason.trim()}>{pending ? tx("Приостанавливаем…") : tx("Подтвердить приостановку")}</Button>
        <Button variant="secondary" disabled={pending} onClick={close}>{tx("Отмена")}</Button>
      </div>
    </form>
  </Modal>;
}
