import { useState, type ReactNode } from "react";
import { KpiCard } from "../ui/KpiCard";
import { useQuery } from "@tanstack/react-query";
import { getCampaigns } from "../../api/commerce";
import { getTicketTypes } from "../../api/events";
import { getEventSales, type SalesFilter } from "../../api/sales";
import type { EventSales } from "../../api/types";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatPrice } from "../../lib/format";
import { RequestError } from "../events/EventExtras";
import { Button } from "../ui/Button";

export function InventoryMetrics({ capacity, ticketsRemaining, percentSold }: { capacity?: number | null; ticketsRemaining?: number | null; percentSold?: number | null }) {
  const { tx, locale } = useLanguage();
  const number = (value?: number | null) => value == null ? tx("Нет данных") : value.toLocaleString(locale);
  return <section className="my-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {([[tx("Вместимость"), capacity == null ? tx("Не задана") : number(capacity), "users"], [tx("Остаток вместимости"), number(ticketsRemaining), "ticket"], [tx("Продано мест, %"), percentSold == null ? tx("Нет данных") : `${percentSold.toLocaleString(locale, { maximumFractionDigits: 1 })}%`, "chart"]] as const).map(([label, value, icon]) => <KpiCard key={label} icon={icon} label={label} value={value} />)}
    </div>
    <p className="mt-2 text-xs text-muted">{tx("Резерв учтён. Ограничения секторов могут уменьшать доступность билетов.")}</p>
  </section>;
}

export function EventCampaignStats({ eventId }: { eventId: number }) {
  const { tx, locale } = useLanguage();
  const campaigns = useQuery({ queryKey: ["campaigns", eventId], queryFn: () => getCampaigns(eventId) });
  return <section className="mt-6 border-t pt-4">
    <h4 className="font-semibold">{tx("Промокампании — за всё время")}</h4>
    {campaigns.isLoading && <p>{tx("Загрузка…")}</p>}
    <RequestError error={campaigns.error} />
    {campaigns.error && <Button variant="secondary" onClick={() => void campaigns.refetch()}>{tx("Повторить")}</Button>}
    {campaigns.data?.length === 0 && <p className="mt-2 text-sm text-muted">{tx("Промокампаний пока нет")}</p>}
    {campaigns.data && campaigns.data.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
      <thead><tr>{[tx("Кампания"),tx("Применения"),tx("Билеты"),tx("Выручка"),tx("Скидки"),tx("После скидок")].map(label => <th key={label} className="border-b p-2">{label}</th>)}</tr></thead>
      <tbody>{campaigns.data.map(campaign => <tr key={campaign.id}><td className="border-b p-2">{campaign.name} · {campaign.code}</td><td className="border-b p-2">{campaign.redemptions}</td><td className="border-b p-2">{campaign.ticketsSold}</td><td className="border-b p-2">{formatPrice(campaign.grossRevenue,locale)}</td><td className="border-b p-2">{formatPrice(campaign.discountAmount,locale)}</td><td className="border-b p-2">{formatPrice(campaign.netRevenue,locale)}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}

export function EventSalesAnalytics({ eventId, children }: { eventId: number; children: (sales: EventSales) => ReactNode }) {
  const { tx } = useLanguage();
  const [filter,setFilter] = useState<SalesFilter>({});
  const [validation,setValidation] = useState("");
  const filtered = Object.keys(filter).length > 0;
  const sales = useQuery({ queryKey: filtered ? ["organizer-sales-detail",eventId,filter] : ["organizer-sales-detail",eventId], queryFn: () => getEventSales(eventId,filter) });
  const types = useQuery({ queryKey: ["ticket-types",eventId], queryFn: () => getTicketTypes(eventId) });
  return <div className="space-y-3">
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      const from = String(data.get("from") ?? ""); const to = String(data.get("to") ?? "");
      if (from && to && from > to) { setValidation(tx("Начальная дата не должна быть позже конечной")); return; }
      const ticketTypeId = Number(data.get("ticketTypeId"));
      setValidation(""); setFilter({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(ticketTypeId ? { ticketTypeId } : {}) });
    }} onReset={() => { setValidation(""); setFilter({}); }}>
      <label className="text-sm">{tx("С даты")}<input name="from" type="date" className="mt-1 block rounded-lg border p-2" /></label>
      <label className="text-sm">{tx("По дату")}<input name="to" type="date" className="mt-1 block rounded-lg border p-2" /></label>
      <label className="text-sm">{tx("Тип билета")}<select name="ticketTypeId" className="mt-1 block rounded-lg border p-2" disabled={types.isLoading || !!types.error}><option value="">{tx("Все типы билетов")}</option>{types.data?.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
      <Button type="submit">{tx("Применить")}</Button><Button type="reset" variant="secondary">{tx("Сбросить")}</Button>
    </form>
    <p className="text-xs text-muted">{tx("Фильтры применяются к продажам по дням. Итоги и остатки показаны за всё время.")}</p>
    <RequestError error={validation || types.error || sales.error} />
    {types.error && <Button variant="secondary" onClick={() => void types.refetch()}>{tx("Повторить загрузку типов билетов")}</Button>}
    {sales.error && <Button variant="secondary" onClick={() => void sales.refetch()}>{tx("Повторить")}</Button>}
    {sales.isLoading && <p role="status">{tx("Загрузка…")}</p>}
    {sales.data && !sales.error && children(sales.data)}
    <EventCampaignStats eventId={eventId} />
  </div>;
}
