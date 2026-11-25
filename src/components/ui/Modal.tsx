import { useEffect, useId, useRef, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

interface Props {
  open: boolean;
  onClose: () => void;
  // Shown as the dialog's visible heading and used as its accessible name.
  title: string;
  titleClassName?: string;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
}

const FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dark overlay + white window in the middle. Closes on ×, Escape, or a click outside.
// Focus moves into the dialog when it opens, Tab/Shift+Tab stay inside it, and focus
// returns to the element that opened it when it closes.
export function Modal({ open, onClose, title, titleClassName = "pr-6 text-xl font-bold", role = "dialog", children }: Props) {
  const { t } = useLanguage();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; a ref keeps a new handler from re-running the open/close effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => dialog ? [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement) : [];
    // A child with autoFocus has already taken focus; otherwise focus the first control after ×.
    if (dialog && !dialog.contains(document.activeElement)) {
      const [first, second] = focusables();
      (second ?? first ?? dialog).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !dialog.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={dialogRef} role={role} aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-muted hover:bg-surface hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ×
        </button>
        <h2 id={titleId} className={titleClassName}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
