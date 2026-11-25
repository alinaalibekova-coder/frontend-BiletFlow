import { useLanguage } from "../../i18n/LanguageContext";
import { Icon } from "../ui/Icons";

// Tickets → Details → Payment → Done. `current` is 0-based; finished steps get a check icon and
// "done" text for screen readers, the current one aria-current="step" and a filled circle.
export function CheckoutSteps({ current, failed = false }: { current: number; failed?: boolean }) {
  const { tx } = useLanguage();
  const steps = [tx("Билеты"), tx("Данные"), tx("Оплата"), tx("Готово")];
  return (
    <nav aria-label={tx("Шаги оформления")} className="mb-6">
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((label, index) => {
          const done = index < current || (index === current && current === steps.length - 1 && !failed);
          const active = index === current && !done;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="flex flex-1 items-center gap-1 sm:gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${done ? "border-primary bg-primary text-white" : active ? failed ? "border-danger bg-danger-soft text-danger-ink" : "border-primary bg-primary-soft text-primary-dark" : "border-gray-300 text-muted"}`}>
                {done ? <Icon name="check" className="h-4 w-4" strokeWidth={2.6} /> : active && failed ? <Icon name="x" className="h-4 w-4" strokeWidth={2.6} /> : index + 1}
              </span>
              <span className={`text-xs font-semibold sm:text-sm ${active ? "text-ink" : done ? "text-primary-dark" : "text-muted"}`}>
                {label}
                {done && <span className="sr-only"> ({tx("выполнено")})</span>}
                {active && failed && <span className="sr-only"> ({tx("не завершено")})</span>}
              </span>
              {index < steps.length - 1 && <span aria-hidden="true" className={`mx-1 hidden h-0.5 flex-1 rounded sm:block ${index < current ? "bg-primary" : "bg-gray-200"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
