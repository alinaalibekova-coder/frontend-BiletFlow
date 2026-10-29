import { useState } from "react";
import type { TicketType } from "../../api/types";
import type { OrderItemInput } from "../../api/orders";
import { formatPrice } from "../../lib/format";
import { Button } from "../ui/Button";

interface Props {
  types: TicketType[];
  onContinue: (items: OrderItemInput[]) => void;
  busy?: boolean;
}

// List of ticket types with − / + buttons and a total at the bottom.
export function TicketSelector({ types, onContinue, busy = false }: Props) {
  // How many of each ticket type is chosen: { 4: 2, 5: 1 } means 2 of type 4 and 1 of type 5
  const [counts, setCounts] = useState<Record<number, number>>({});

  // Can't pick more than what's left, or more than the per-order limit (10 if none is set)
  const maxFor = (t: TicketType) =>
    Math.min(t.available, t.maxPerOrder && t.maxPerOrder > 0 ? t.maxPerOrder : 10);

  const change = (t: TicketType, delta: number) =>
    setCounts((prev) => {
      const next = Math.max(0, Math.min(maxFor(t), (prev[t.id] ?? 0) + delta));
      return { ...prev, [t.id]: next };
    });

  const items = types
    .filter((t) => (counts[t.id] ?? 0) > 0)
    .map((t) => ({ ticketTypeId: t.id, quantity: counts[t.id] }));
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = types.reduce((sum, t) => sum + (counts[t.id] ?? 0) * t.price, 0);

  return (
    <div className="mt-2 rounded-xl border">
      <ul className="divide-y">
        {types.map((t) => {
          const count = counts[t.id] ?? 0;
          const soldOut = t.available <= 0;
          return (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-semibold">{t.name}</p>
                {t.description && <p className="text-xs text-muted">{t.description}</p>}
                <p className="text-xs text-muted">{soldOut ? "Нет в наличии" : `Осталось: ${t.available}`}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="whitespace-nowrap font-semibold">{t.price === 0 ? "Бесплатно" : formatPrice(t.price)}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => change(t, -1)}
                    disabled={count === 0}
                    aria-label={`Убрать билет ${t.name}`}
                    className="h-8 w-8 rounded-full bg-surface text-lg disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold" aria-live="polite">{count}</span>
                  <button
                    type="button"
                    onClick={() => change(t, +1)}
                    disabled={soldOut || count >= maxFor(t)}
                    aria-label={`Добавить билет ${t.name}`}
                    className="h-8 w-8 rounded-full bg-surface text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-4 border-t bg-surface p-4">
        <div>
          <p className="text-xs text-muted">Билетов: {totalCount}</p>
          <p className="text-lg font-bold">Итого: {formatPrice(total)}</p>
        </div>
        <Button onClick={() => onContinue(items)} disabled={totalCount === 0 || busy}>
          {busy ? "Подождите…" : "Перейти к оплате"}
        </Button>
      </div>
    </div>
  );
}