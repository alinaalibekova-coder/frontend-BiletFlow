import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatCountdown, formatDateTime, holdMilestone, parseDate } from "../../lib/format";

// Under this many milliseconds the hold is shown as a warning.
export const HOLD_WARNING_MS = 120_000;

// Live mm:ss until a PENDING order's reservation runs out. Only this component re-renders
// every second. Screen readers are told at 5 minutes, 1 minute and expiry, never every second.
export function HoldCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const { tx, locale } = useLanguage();
  const deadline = parseDate(expiresAt).getTime();
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, deadline - now);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(1000, remaining));
    return () => window.clearTimeout(timer);
  }, [now, remaining]);
  // Called once when the hold reaches zero; the ref keeps a new callback from firing it again.
  const expired = remaining <= 0;
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; });
  useEffect(() => { if (expired) onExpireRef.current(); }, [expired]);

  const milestone = holdMilestone(remaining);
  const warning = remaining > 0 && remaining < HOLD_WARNING_MS;
  const announcement = milestone === "expired"
    ? tx("Время резерва истекло.")
    : milestone === "1min"
      ? tx("До конца резерва осталась 1 минута.")
      : milestone === "5min" ? tx("До конца резерва осталось меньше 5 минут.") : "";
  return (
    <div data-hold-warning={warning || undefined} className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm ${warning ? "bg-amber-50 text-amber-900 ring-1 ring-amber-400" : remaining <= 0 ? "bg-surface text-muted" : "bg-surface"}`}>
      <span aria-hidden="true" className="text-base">{warning ? "⚠" : "⏱"}</span>
      <span>
        {remaining > 0 ? tx("Билеты зарезервированы ещё ") : tx("Резерв истёк ")}
        {remaining > 0 && <time dateTime={new Date(deadline).toISOString()} className="font-mono text-base font-bold tabular-nums">{formatCountdown(remaining)}</time>}
        <span className="block text-xs text-muted">{tx("Резерв до ")}{formatDateTime(expiresAt, locale)}</span>
      </span>
      {warning && <strong className="w-full font-semibold sm:w-auto">{tx("Осталось меньше 2 минут — завершите оплату.")}</strong>}
      <span role="status" className="sr-only">{announcement}</span>
    </div>
  );
}
