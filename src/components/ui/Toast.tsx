import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Icon } from "./Icons";

type Tone = "success" | "error" | "info";
interface Toast { id: number; message: string; tone: Tone }
type ShowToast = (message: string, tone?: Tone) => void;

// Outside a provider (isolated component renders) toasts are simply dropped.
const ToastContext = createContext<ShowToast>(() => {});
export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 5000;

// Short success/error feedback. One polite live region announces each message; toasts can be
// dismissed and disappear after 5 seconds (paused while hovered or focused).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const show = useCallback<ShowToast>((message, tone = "success") => {
    const id = nextId.current++;
    setToasts(current => [...current.slice(-2), { id, message, tone }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6">
        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

const TONE = {
  success: ["border-success/30 bg-white text-success-ink", "check"],
  error: ["border-danger/40 bg-white text-danger-ink", "alert"],
  info: ["border-primary/30 bg-white text-primary-dark", "help"],
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { t } = useLanguage();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);
  const [look, icon] = TONE[toast.tone];
  return (
    <div data-toast={toast.tone} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm animate-page-in items-start gap-3 rounded-[var(--radius-card)] border p-3 pr-2 text-sm font-medium shadow-panel ${look}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5" />
      <p className="flex-1 text-brand">{toast.message}</p>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label={t("close")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-black">
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
}
