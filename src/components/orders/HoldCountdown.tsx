import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatCountdown, formatDateTime, holdMilestone, parseDate } from "../../lib/format";
import { Icon } from "../ui/Icons";

// Under this many milliseconds the hold is shown as a warning.
export const HOLD_WARNING_MS = 120_000;

// Live mm:ss until a PENDING order's reservation runs out. Only this component re-renders
// every second. Screen readers are told at 5 minutes, 1 minute and expiry, never every second.
// Used for the ring when the order's creation time is unknown.
const DEFAULT_HOLD_MS = 15 * 60_000;

export function HoldCountdown({ expiresAt, createdAt, onExpire }: { expiresAt: string; createdAt?: string; onExpire: () => void }) {
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

  const total = createdAt ? Math.max(deadline - parseDate(createdAt).getTime(), 1) : DEFAULT_HOLD_MS;
  const fraction = Math.max(0, Math.min(1, remaining / total));
  const milestone = holdMilestone(remaining);
  const warning = remaining > 0 && remaining < HOLD_WARNING_MS;
  const announcement = milestone === "expired"
    ? tx("Время резерва истекло.")
    : milestone === "1min"
      ? tx("До конца резерва осталась 1 минута.")
      : milestone === "5min" ? tx("До конца резерва осталось меньше 5 минут.") : "";
  return (
    <div data-hold-warning={warning || undefined} className={`mt-4 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] p-4 text-sm ${warning ? "bg-warn-soft text-warn-ink ring-1 ring-warn" : remaining <= 0 ? "bg-surface text-muted" : "bg-primary-soft text-primary-dark"}`}>
      {/* Ring: the share of the hold that is left. The mm:ss text next to it carries the value. */}
      <svg aria-hidden="true" viewBox="0 0 44 44" className="h-14 w-14 shrink-0 -rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="stroke-white" />
        <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray={`${fraction * 100} 100`}
          className={warning ? "stroke-warn" : "stroke-primary"} />
      </svg>
      <span>
        {remaining > 0 ? tx("Билеты зарезервированы ещё ") : tx("Резерв истёк ")}
        {remaining > 0 && <time dateTime={new Date(deadline).toISOString()} className="font-mono text-xl font-bold tabular-nums text-ink">{formatCountdown(remaining)}</time>}
        <span className="block text-xs text-muted">{tx("Резерв до ")}{formatDateTime(expiresAt, locale)}</span>
      </span>
      {warning && <strong className="flex w-full items-center gap-1.5 font-semibold sm:w-auto"><Icon name="alert" className="h-4 w-4" />{tx("Осталось меньше 2 минут — завершите оплату.")}</strong>}
      <span role="status" className="sr-only">{announcement}</span>
    </div>
  );
}
