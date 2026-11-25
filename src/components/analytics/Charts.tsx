import { useId, useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import type { DailySales, TicketTypeSales } from "../../api/types";
import { formatLongDate, formatPrice, formatShortDate } from "../../lib/format";

// Hand-rolled SVG charts, no chart library. Mark specs follow the dataviz guidance: bars at most
// 24px thick with a 4px rounded data end and a square baseline, a 2px surface gap between
// touching segments, hairline recessive gridlines, one axis. Single series use the brand
// primary; the second colour (reserved tickets) is the validated orange (primary↔orange
// CVD ΔE 30). Text is always in text colours, never the series colour, and each chart has a
// table view as its text alternative.
export const SERIES_PRIMARY = "#534ab7";
export const SERIES_SECONDARY = "#f47230";
const TRACK = "#eeedfe";
const GRID = "#e5e7eb";

// A rounded data end at the top of a column, square at the baseline.
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// Clean ticks: 0 and up to 4 round steps covering the maximum.
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
const compact = (value: number, locale: string) =>
  new Intl.NumberFormat(locale.startsWith("kk") ? "ru-RU" : locale, value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(value);

// Chart + "show as table" toggle; the table is the accessible equivalent of the picture.
function ChartFrame({ title, summary, table, children }: { title: string; summary: string; table: ReactNode; children: ReactNode }) {
  const { tx } = useLanguage();
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();
  return (
    <figure className="mt-5 rounded-[var(--radius-card)] border border-gray-200 bg-white p-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={headingId} className="font-semibold text-ink">{title}</h4>
        <button type="button" aria-pressed={asTable} onClick={() => setAsTable(value => !value)} className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold hover:border-primary hover:bg-primary-soft">
          {asTable ? tx("Показать график") : tx("Показать таблицей")}
        </button>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="mt-3">{asTable ? table : children}</div>
    </figure>
  );
}

// Revenue per day as columns, with tickets sold in the tooltip and the table.
export function DailySalesChart({ days }: { days: DailySales[] }) {
  const { tx, locale } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const width = 640, height = 220, left = 48, right = 8, top = 12, bottom = 28;
  const max = Math.max(0, ...days.map(d => d.revenue));
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const plotW = width - left - right, plotH = height - top - bottom;
  const band = plotW / Math.max(days.length, 1);
  const barW = Math.min(24, Math.max(2, band - 2));
  const y = (value: number) => top + plotH - (value / scaleMax) * plotH;
  // Label at most ~8 dates so they never collide.
  const every = Math.max(1, Math.ceil(days.length / 8));
  const best = days.reduce<DailySales | null>((acc, d) => (!acc || d.revenue > acc.revenue ? d : acc), null);
  const summary = tx("Выручка по дням: {0} дней, максимум {1} ({2}).", [days.length, formatPrice(best?.revenue ?? 0, locale), best ? formatLongDate(best.date, locale) : "—"]);
  const active = hover === null ? null : days[hover];

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="border-b text-xs text-muted"><tr><th className="py-2 pr-3">{tx("Дата")}</th><th className="py-2 pr-3">{tx("Выручка")}</th><th className="py-2">{tx("Продано билетов")}</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date} className="border-b last:border-0"><td className="py-2 pr-3">{formatLongDate(day.date, locale)}</td><td className="py-2 pr-3">{formatPrice(day.revenue, locale)}</td><td className="py-2">{day.ticketsSold}</td></tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <ChartFrame title={tx("Продажи по дням")} summary={summary} table={table}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={summary} onMouseLeave={() => setHover(null)}>
          {ticks.map(tick => <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
            <text x={left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b6b6b">{compact(tick, locale)}</text>
          </g>)}
          {days.map((day, i) => {
            const x = left + i * band + (band - barW) / 2;
            const h = Math.max(day.revenue > 0 ? 2 : 0, top + plotH - y(day.revenue));
            return <g key={day.date}>
              {/* Hit target: the whole band, taller than the bar. */}
              <rect x={left + i * band} y={top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              {h > 0 && <path d={columnPath(x, top + plotH - h, barW, h)} fill={SERIES_PRIMARY} opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />}
              {i % every === 0 && <text x={left + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#6b6b6b">{formatShortDate(day.date, locale)}</text>}
            </g>;
          })}
          <line x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} stroke="#9ca3af" strokeWidth={1} />
        </svg>
        {active && hover !== null && (
          <div role="presentation" className="pointer-events-none absolute top-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lifted"
            style={{ left: `${Math.min(80, ((left + hover * band + band / 2) / width) * 100)}%` }}>
            <p className="font-semibold text-ink">{formatLongDate(active.date, locale)}</p>
            <p className="mt-0.5 flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_PRIMARY }} />{formatPrice(active.revenue, locale)}</p>
            <p className="text-muted">{tx("Продано билетов")}: {active.ticketsSold}</p>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

// Sold / reserved / remaining per ticket type as horizontal stacked bars.
export function TicketTypeSalesChart({ types }: { types: TicketTypeSales[] }) {
  const { tx, locale } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...types.map(t => t.sold + t.reserved + Math.max(0, t.available)));
  const summary = tx("Продажи по типам билетов: {0}.", [types.map(t => `${t.name} — ${t.sold}`).join(", ")]);
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b text-xs text-muted"><tr><th className="py-2 pr-3">{tx("Тип билета")}</th><th className="py-2 pr-3">{tx("Продано")}</th><th className="py-2 pr-3">{tx("Резерв")}</th><th className="py-2 pr-3">{tx("Остаток")}</th><th className="py-2">{tx("Выручка")}</th></tr></thead>
        <tbody>{types.map(t => <tr key={t.ticketTypeId} className="border-b last:border-0"><td className="py-2 pr-3">{t.name}</td><td className="py-2 pr-3">{t.sold}</td><td className="py-2 pr-3">{t.reserved}</td><td className="py-2 pr-3">{t.available}</td><td className="py-2">{formatPrice(t.revenue, locale)}</td></tr>)}</tbody>
      </table>
    </div>
  );
  return (
    <ChartFrame title={tx("Продажи по типам билетов")} summary={summary} table={table}>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: SERIES_PRIMARY }} />{tx("Продано")}</li>
        <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: SERIES_SECONDARY }} />{tx("Резерв")}</li>
        <li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: TRACK }} />{tx("Остаток")}</li>
      </ul>
      <ul className="space-y-3" role="img" aria-label={summary}>
        {types.map((t, i) => {
          const parts = [[t.sold, SERIES_PRIMARY], [t.reserved, SERIES_SECONDARY], [Math.max(0, t.available), TRACK]] as const;
          const total = parts.reduce((sum, [value]) => sum + value, 0);
          return (
            <li key={t.ticketTypeId} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="relative">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{t.name}</span>
                {/* Direct label: the value the chart is about. */}
                <span className="text-xs text-muted">{tx("Продано: {0}", [t.sold])}{total > 0 ? ` · ${Math.round((t.sold / total) * 100)}%` : ""}</span>
              </div>
              <div className="mt-1 flex h-4 gap-[2px]" style={{ width: `${Math.max(8, (total / max) * 100)}%` }}>
                {parts.filter(([value]) => value > 0).map(([value, color], index, shown) => (
                  <span key={color} className={`h-full ${index === 0 ? "rounded-l" : ""} ${index === shown.length - 1 ? "rounded-r" : ""}`} style={{ flexGrow: value, background: color }} />
                ))}
              </div>
              {hover === i && <div role="presentation" className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lifted">
                <p className="font-semibold text-ink">{t.name}</p>
                <p>{tx("Продано")}: {t.sold} · {tx("Резерв")}: {t.reserved} · {tx("Остаток")}: {t.available}</p>
                <p className="text-muted">{formatPrice(t.revenue, locale)}</p>
              </div>}
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

// Check-in share as a donut. The percentage and counts are printed in and beside it.
export function CheckInDonut({ checkedIn, total, rate, absentLabel }: { checkedIn: number; total: number; rate: number; absentLabel: string }) {
  const { tx, locale } = useLanguage();
  const share = Math.max(0, Math.min(100, rate));
  const label = tx("Прошли check-in: {0} из {1} ({2}%)", [checkedIn.toLocaleString(locale), total.toLocaleString(locale), share]);
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={label}>
        <circle cx="60" cy="60" r="48" fill="none" stroke={TRACK} strokeWidth="16" />
        {share > 0 && <circle cx="60" cy="60" r="48" fill="none" stroke={SERIES_PRIMARY} strokeWidth="16" pathLength={100}
          strokeDasharray={`${share} 100`} strokeLinecap={share < 100 ? "butt" : undefined} transform="rotate(-90 60 60)" />}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="#14122b">{share}%</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: SERIES_PRIMARY }} />{tx("Прошли check-in")}: <strong>{checkedIn.toLocaleString(locale)}</strong></li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border border-primary/30" style={{ background: TRACK }} />{absentLabel}: <strong>{Math.max(0, total - checkedIn).toLocaleString(locale)}</strong></li>
      </ul>
    </div>
  );
}
