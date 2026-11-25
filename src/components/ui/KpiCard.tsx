import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

// One headline number: an icon, a sentence-case label and the value (plus an optional hint).
export function KpiCard({ label, value, icon = "chart", hint }: { label: string; value: ReactNode; icon?: IconName; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-gray-200 bg-white p-4 shadow-soft">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon name={icon} /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
