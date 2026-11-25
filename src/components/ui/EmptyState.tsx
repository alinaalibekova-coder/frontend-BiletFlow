import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icons";

// A small illustration, one line of explanation and (optionally) the action that helps.
export function EmptyState({ icon = "ticket", title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <div aria-hidden="true" className="relative mb-4 flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary-soft" />
        <span className="absolute -right-1 top-1 h-4 w-4 rounded-full bg-warn/70" />
        <span className="absolute -left-1 bottom-2 h-2.5 w-2.5 rounded-full bg-primary/40" />
        <Icon name={icon} className="relative h-9 w-9 text-primary" strokeWidth={1.6} />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
