import { scrollBehavior } from "../../lib/motion";
import { useLanguage } from "../../i18n/LanguageContext";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TicketType } from "../../api/types";
import { quoteOrder, type CheckoutDetails, type OrderItemInput } from "../../api/orders";
import { previewPromo } from "../../api/commerce";
import { getSeatMap, type SeatingMode } from "../../api/seating";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { formatPrice, parseDate } from "../../lib/format";
import { appliedPromoCode, clearStoredPromo, promoAllowsCheckout, shouldDropStoredPromo, type PromoSource, type PromoState } from "../../lib/promo";
import { Button } from "../ui/Button";
import { MutationError } from "../ui/AsyncState";
import type { SelectedSeat } from "./SeatMapPicker";

// Only assigned-seating events need the seat map, so other event pages don't download it.
const SeatMapPicker = lazy(() => import("./SeatMapPicker").then((module) => ({ default: module.SeatMapPicker })));

interface Props {
  eventId: number;
  types: TicketType[];
  onContinue: (items: OrderItemInput[], details: CheckoutDetails) => void;
  busy?: boolean;
  blocked?: boolean;
  paidSalesActive?: boolean;
  initialPromo?: string;
  // Where initialPromo came from: an event link (?promo=) or the tab's stored campaign token.
  promoSource?: Exclude<PromoSource, "typed">;
  seatingMode?: SeatingMode;
}

// Backend limit on seatIds in one order (CreateOrderRequest).
const MAX_SEATS_PER_ORDER = 50;

// How a ticket type is bought. With assigned seating, a type sold in a standing section is still
// bought by quantity; a type sold only in seated sections is bought by picking seats on the map.
type BuyMode = "count" | "seats" | "none";

export function TicketSelector({ eventId, types, onContinue, busy = false, blocked, paidSalesActive, initialPromo = "", promoSource = "url", seatingMode }: Props) {
  const { tx, locale } = useLanguage();
  const { isLoggedIn } = useAuth();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [attendeeName, setAttendeeName] = useState("");
  const [promoInput, setPromoInput] = useState(initialPromo);
  const [promo, setPromo] = useState<PromoState>({ value: initialPromo, token: !!initialPromo, source: promoSource });
  const assigned = seatingMode === "ASSIGNED";
  const [selectedSeats, setSelectedSeats] = useState<Record<number, SelectedSeat>>({});
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [seatNotice, setSeatNotice] = useState("");
  const seatMap = useQuery({
    queryKey: ["seat-map", eventId],
    queryFn: () => getSeatMap(eventId),
    enabled: assigned,
    refetchInterval: 30_000,
  });
  const preview = useQuery({
    queryKey: ["promo-preview", eventId, promo.value, promo.token],
    queryFn: async () => {
      try { return await previewPromo(eventId, promo.value, promo.token); }
      catch (error) {
        if (promo.token && error instanceof ApiError && error.status === 400) return previewPromo(eventId, promo.value);
        throw error;
      }
    },
    enabled: !!promo.value,
    retry: false,
  });
  // A stored campaign token this event rejects is consumed: forget it here and in the tab.
  useEffect(() => {
    if (!shouldDropStoredPromo(promo, preview.error)) return;
    clearStoredPromo();
    setPromo({ value: "", token: false, source: "typed" });
    setPromoInput("");
  }, [promo, preview.error]);
  const sections = seatMap.data?.sections ?? [];
  const buyMode = (t: TicketType): BuyMode => {
    if (!assigned) return "count";
    const own = sections.filter(s => s.ticketTypeId === t.id);
    if (own.some(s => s.kind === "STANDING")) return "count";
    if (own.some(s => s.kind === "SEATED")) return "seats";
    return "none"; // not on the seat map (or the map is still loading)
  };
  const maxFor = (t: TicketType) => {
    const now = Date.now();
    if (blocked || buyMode(t) === "none" || (t.price > 0 && paidSalesActive === false) || (t.salesStart && parseDate(t.salesStart).getTime() > now) || (t.salesEnd && parseDate(t.salesEnd).getTime() <= now)) return 0;
    return Math.min(t.available, t.maxPerOrder && t.maxPerOrder > 0 ? t.maxPerOrder : 10);
  };
  const seatList = Object.values(selectedSeats);
  const seatsOfType = (typeId: number) => seatList.filter(s => s.ticketTypeId === typeId).length;
  const seatIds = seatList.map(s => s.id).sort((a, b) => a - b);
  const items = types.filter(t => buyMode(t) === "count" && Math.min(counts[t.id] ?? 0, maxFor(t)) > 0)
    .map(t => ({ ticketTypeId: t.id, quantity: Math.min(counts[t.id], maxFor(t)) }));
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0) + seatIds.length;
  const promoCode = appliedPromoCode(promo, preview);
  const quote = useQuery({
    queryKey: ["order-quote", eventId, items, promoCode, seatIds],
    queryFn: () => quoteOrder(eventId, items, promoCode, seatIds),
    enabled: isLoggedIn && totalCount > 0 && (!promo.value || promo.source === "stored" || !!preview.data),
    retry: false,
    staleTime: 0,
  });
  const promoUnapplied = promoInput.trim() !== promo.value;
  const seatsValid = seatList.every(seat => {
    const type = types.find(type => type.id === seat.ticketTypeId);
    const section = sections.find(section => section.id === seat.sectionId);
    return type && section?.onSale && section.ticketTypeId === type.id && seatsOfType(type.id) + (items.find(item => item.ticketTypeId === type.id)?.quantity ?? 0) <= maxFor(type);
  });
  const canCheckout = seatsValid && totalCount > 0 && !busy && !blocked && !promoUnapplied && promoAllowsCheckout(promo, preview) && (!isLoggedIn || (!!quote.data && !quote.isFetching && !quote.error));

  const toggleSeat = (seat: SelectedSeat) => {
    setSeatNotice("");
    if (selectedSeats[seat.id]) {
      setSelectedSeats(prev => { const next = { ...prev }; delete next[seat.id]; return next; });
      return;
    }
    const type = types.find(t => t.id === seat.ticketTypeId);
    if (!type || maxFor(type) === 0) return setSeatNotice(tx("Этот тип билета сейчас недоступен."));
    if (seatsOfType(type.id) >= maxFor(type)) return setSeatNotice(tx("Для «{0}» можно выбрать не больше {1} мест в одном заказе.", [type.name, maxFor(type)]));
    if (seatList.length >= MAX_SEATS_PER_ORDER) return setSeatNotice(tx("В одном заказе можно выбрать не больше {0} мест.", [MAX_SEATS_PER_ORDER]));
    setSelectedSeats(prev => ({ ...prev, [seat.id]: seat }));
  };
  const dropSeats = (ids: number[]) => {
    setSelectedSeats(prev => { const next = { ...prev }; for (const id of ids) delete next[id]; return next; });
    setSeatNotice(tx("Некоторые выбранные места уже заняты и убраны из заказа."));
  };
  const openSeatsFor = (t: TicketType) => {
    const section = sections.find(s => s.ticketTypeId === t.id && s.kind === "SEATED" && s.onSale && s.available > 0);
    if (section) setActiveSectionId(section.id);
    document.getElementById(`seat-map-${eventId}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  };

  return <div className="mt-2 overflow-hidden rounded-xl border">
    {paidSalesActive === false && <p className="bg-amber-50 p-4 text-sm text-amber-900">{tx("Платные продажи ещё не активированы или приостановлены. Бесплатные билеты доступны в пределах сроков продажи.")}</p>}
    <ul className="divide-y">
      {types.map(t => {
        const mode = buyMode(t);
        const count = mode === "seats" ? seatsOfType(t.id) : Math.min(counts[t.id] ?? 0, maxFor(t));
        return <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div><p className="font-semibold">{t.name}</p>{t.description && <p className="text-xs text-muted">{t.description}</p>}<p className="text-xs text-muted">{assigned && seatMap.isLoading ? tx("Загружаем схему зала…") : maxFor(t) === 0 ? tx("Сейчас недоступен") : tx("Осталось: {0}", [t.available])}</p></div>
          <div className="flex items-center gap-4">
            <p className="whitespace-nowrap font-semibold">{t.price === 0 ? tx("Бесплатно") : formatPrice(t.price, locale)}</p>
            {mode === "seats" ? (
              <div className="flex items-center gap-3">
                <span className="text-sm" aria-live="polite">{tx("Мест: {0}", [count])}</span>
                <Button variant="secondary" disabled={maxFor(t) === 0 || busy} onClick={() => openSeatsFor(t)}>{tx("Выбрать места")}</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" disabled={count === 0 || busy} onClick={() => setCounts(prev => ({ ...prev, [t.id]: Math.max(0, count - 1) }))} aria-label={tx("Убрать билет {0}", [t.name])} className="h-8 w-8 rounded-full bg-surface text-lg disabled:opacity-40">−</button>
                <span className="w-5 text-center font-semibold" aria-live="polite">{count}</span>
                <button type="button" disabled={count >= maxFor(t) || busy} onClick={() => setCounts(prev => ({ ...prev, [t.id]: count + 1 }))} aria-label={tx("Добавить билет {0}", [t.name])} className="h-8 w-8 rounded-full bg-surface text-lg disabled:opacity-40">+</button>
              </div>
            )}
          </div>
        </li>;
      })}
    </ul>
    {assigned && <div id={`seat-map-${eventId}`} className="scroll-mt-4 border-t p-4">
      {seatMap.isLoading && <p role="status" className="text-sm text-muted">{tx("Загружаем схему зала…")}</p>}
      <MutationError error={seatMap.error} />
      {seatMap.error && <Button variant="secondary" onClick={() => void seatMap.refetch()}>{tx("Повторить")}</Button>}
      {seatMap.data && <Suspense fallback={<p role="status" className="text-sm text-muted">{tx("Загружаем схему зала…")}</p>}>
        <SeatMapPicker
          eventId={eventId}
          map={seatMap.data}
          selected={selectedSeats}
          activeSectionId={activeSectionId}
          onSelectSection={setActiveSectionId}
          onToggle={toggleSeat}
          onSeatsGone={dropSeats}
          disabled={busy || blocked}
        />
      </Suspense>}
      {seatNotice && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{seatNotice}</p>}
    </div>}
    <div className="space-y-3 border-t p-4">
      <label className="block text-sm">{tx("Имя посетителя (необязательно)")}<input value={attendeeName} onChange={e => setAttendeeName(e.target.value)} maxLength={200} autoComplete="name" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder={tx("Если не указано, используем имя или email аккаунта")} /></label>
      <form onSubmit={e => { e.preventDefault(); setPromo({ value: promoInput.trim(), token: false, source: "typed" }); }} className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">{tx("Промокод")}<input value={promoInput} onChange={e => setPromoInput(e.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <Button type="submit" variant="secondary" disabled={preview.isFetching || busy}>{tx("Применить")}</Button>
        {promo.value && <Button variant="secondary" onClick={() => { setPromoInput(""); setPromo({ value: "", token: false, source: "typed" }); clearStoredPromo(); }}>{tx("Убрать")}</Button>}
      </form>
      {preview.isFetching && <p role="status" className="text-sm">{tx("Проверяем промокод…")}</p>}
      {promo.value && promo.source !== "stored" && <MutationError error={preview.error} />}
      {promo.value && preview.data && !preview.error && <p className="text-sm text-green-800">{tx("Промокод ")}{preview.data.code} {tx(" применён. Скидка: ")}{preview.data.discountValue}{preview.data.discountType === "PERCENT" ? "%" : " ₸"}.</p>}
      {promoUnapplied && <p className="text-xs text-muted">{tx("Примените изменённый промокод перед оформлением.")}</p>}
      {isLoggedIn && totalCount > 0 && <MutationError error={quote.error} />}
      {quote.error && <Button variant="secondary" onClick={() => void quote.refetch()}>{tx("Повторить расчёт")}</Button>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-surface p-4">
      <div aria-live="polite"><p className="text-xs text-muted">{tx("Билетов: ")}{totalCount}</p>
        {isLoggedIn && quote.data && totalCount > 0 && <><p className="text-sm">{tx("До скидки: ")}{formatPrice(quote.data.subtotalAmount, locale)}</p><p className="text-sm">{tx("Скидка: ")}{formatPrice(quote.data.discountAmount, locale)}</p></>}
        <p className="text-lg font-bold">{tx("Итого: ")}{totalCount === 0 ? formatPrice(0, locale) : isLoggedIn ? quote.isFetching ? tx("Считаем…") : quote.data && !quote.error ? formatPrice(quote.data.totalAmount, locale) : tx("Расчёт недоступен") : tx("Войдите для расчёта")}</p>
      </div>
      <Button onClick={() => onContinue(items, { attendeeName: attendeeName.trim() || undefined, promoCode, seatIds })} disabled={!canCheckout}>{busy ? tx("Создаём заказ…") : isLoggedIn ? tx("Оформить заказ") : tx("Войти для оформления")}</Button>
      <p className="w-full text-xs text-muted">{tx("Предварительный расчёт не резервирует билеты. Окончательная стоимость подтверждается при создании заказа.")}</p>
    </div>
  </div>;
}
