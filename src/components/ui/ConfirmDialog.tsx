import type { ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { MutationError } from "./AsyncState";

interface Props {
  open: boolean;
  title: string;
  message?: ReactNode;
  // Verb-first labels, e.g. "Отменить заказ" / "Оставить заказ".
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}

// In-page replacement for window.confirm: keyboard and screen-reader friendly, translated,
// and destructive actions are red with the safe choice focused first.
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, destructive = false, pending = false, error, onConfirm, onCancel }: Props) {
  const { tx } = useLanguage();
  return (
    <Modal open={open} onClose={() => { if (!pending) onCancel(); }} title={title} role="alertdialog">
      {message && <div className="mt-3 text-sm text-muted">{message}</div>}
      <MutationError error={error} />
      <div className="mt-5 flex flex-wrap-reverse justify-end gap-3">
        <Button variant="secondary" disabled={pending} onClick={onCancel} autoFocus={destructive}>{cancelLabel ?? tx("Отмена")}</Button>
        <Button variant={destructive ? "danger" : "primary"} disabled={pending} onClick={onConfirm} autoFocus={!destructive}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
