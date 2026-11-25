import { useLanguage } from "../../i18n/LanguageContext";
import { Icon, type IconName } from "./Icons";

type Tone = "success" | "info" | "warn" | "danger" | "neutral";

// Every state has its own icon and translated text, so colour is never the only signal.
const STATUS: Record<string, [Tone, IconName]> = {
  VALID: ["success", "check"], PAID: ["success", "check"], PUBLISHED: ["success", "check"], ACTIVE: ["success", "check"],
  SUCCEEDED: ["success", "check"], RESOLVED: ["success", "check"], VERIFIED: ["success", "shield"], CHECKED_IN: ["success", "check"],
  USED: ["info", "scan"], DRAFT: ["neutral", "settings"], SCHEDULED: ["info", "calendar"], UPCOMING: ["info", "calendar"], COMPLETED: ["neutral", "flag"],
  PENDING: ["warn", "clock"], IN_PROGRESS: ["warn", "clock"], WAITING_FOR_CUSTOMER: ["warn", "clock"], OPEN: ["info", "help"], ON_HOLD: ["warn", "clock"], UNVERIFIED: ["warn", "alert"],
  CANCELLED: ["danger", "x"], EXPIRED: ["danger", "clock"], FAILED: ["danger", "x"], SUSPENDED: ["danger", "alert"], REJECTED: ["danger", "x"], DISMISSED: ["neutral", "x"],
  REFUNDED: ["warn", "undo"], ACTIONED: ["success", "check"],
};
// Text/background pairs, all >= 6:1.
const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success-ink",
  info: "bg-info-soft text-info-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  neutral: "bg-surface text-brand",
};

export function StatusBadge({ status, label, className = "" }: { status: string; label?: string; className?: string }) {
  const { statusLabel } = useLanguage();
  const [tone, icon] = STATUS[status.replace(/^ROLE_/, "")] ?? ["neutral", "help"];
  return (
    <span data-status={status} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}>
      <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2.2} />
      {label ?? statusLabel(status)}
    </span>
  );
}
