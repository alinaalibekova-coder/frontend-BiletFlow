import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useLanguage } from "../../i18n/LanguageContext";
import { getSectionSeats, type Seat, type SeatMap, type SeatSection } from "../../api/seating";
import { formatPrice } from "../../lib/format";
import { MutationError } from "../ui/AsyncState";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icons";

// A seat the attendee picked. Lives in the browser until checkout sends its id in seatIds.
export interface SelectedSeat {
  id: number;
  sectionId: number;
  sectionName: string;
  row: string;
  number: number;
  ticketTypeId: number;
  ticketTypeName: string;
  price: number;
}

interface Props {
  eventId: number;
  map: SeatMap;
  selected: Record<number, SelectedSeat>;
  activeSectionId: number | null;
  onSelectSection: (sectionId: number | null) => void;
  onToggle: (seat: SelectedSeat) => void;
  // Selected seats that someone else took meanwhile (seen when the section refreshes).
  onSeatsGone: (seatIds: number[]) => void;
  disabled?: boolean;
}

const SEATS_REFRESH_MS = 15_000;

// Seat fill and the colour of the symbol drawn on it. Symbol contrast on each fill:
// selected primary + white 6.9:1, free emerald-500 + black 8.3:1 (hover emerald-400 10.9:1),
// held amber-300 + black 14.6:1, yours blue-300 + black 11.7:1, sold gray-600 + white 7.6:1,
// unavailable gray-200 + black 17:1.
export function seatLook(status: Seat["status"], isSelected: boolean): { fill: string; text: string } {
  if (isSelected) return { fill: "fill-primary", text: "fill-white" };
  switch (status) {
    case "AVAILABLE": return { fill: "fill-emerald-500 hover:fill-emerald-400 cursor-pointer", text: "fill-black" };
    case "HELD": return { fill: "fill-amber-300", text: "fill-black" };
    case "YOURS": return { fill: "fill-blue-300", text: "fill-black" };
    case "SOLD": return { fill: "fill-gray-600", text: "fill-white" };
    default: return { fill: "fill-gray-200", text: "fill-black" };
  }
}

// The status symbol is always shown, so no state relies on colour alone (SRS 4.3.1).
// Accessibility is a separate badge on the seat, never a replacement for the status.
export const seatSymbol = (seat: Pick<Seat, "status" | "number">, isSelected: boolean) =>
  isSelected ? "✓" : ({ AVAILABLE: String(seat.number), HELD: "…", YOURS: "Y", SOLD: "×", UNAVAILABLE: "—" })[seat.status];

// Price categories: the dataviz reference categorical slots, in their validated order (adjacent
// CVD ΔE >= 11.8). Every section also prints its price and the legend lists them, so colour is
// never the only cue. A 7th price and beyond fold into neutral grey.
const PRICE_COLORS = ["#257de0", "#f47230", "#00b894", "#f2a600", "#ee7fac", "#008a17"];
const OTHER_PRICE_COLOR = "#9ca3af";
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// White or near-black label, whichever contrasts more with the fill.
export const labelOn = (hex: string) => (1.05 / (luminance(hex) + 0.05) >= (luminance(hex) + 0.05) / 0.05 ? "#ffffff" : "#111111");
export function priceColors(sections: SeatSection[]): Map<number, string> {
  const prices = [...new Set(sections.map(s => s.price).filter((p): p is number => p !== null))].sort((a, b) => a - b);
  return new Map(prices.map((price, i) => [price, PRICE_COLORS[i] ?? OTHER_PRICE_COLOR]));
}

const pickable = (section: SeatSection) =>
  section.kind === "SEATED" && section.onSale && section.ticketTypeId !== null && section.available > 0;

// Assigned seating: an overview of the venue's sections, then the seats of the chosen section.
export function SeatMapPicker({ eventId, map, selected, activeSectionId, onSelectSection, onToggle, onSeatsGone, disabled }: Props) {
  const { tx, locale } = useLanguage();
  const sections = map.sections;
  const active = sections.find((s) => s.id === activeSectionId) ?? null;
  const selectedList = Object.values(selected);

  // Map size: the layout's own, or the sections' bounding box if the layout has none.
  const width = map.width ?? Math.max(...sections.map((s) => s.x + s.width), 1);
  const height = map.height ?? Math.max(...sections.map((s) => s.y + s.height), 1);
  const font = Math.max(width, height) / 55;
  const colors = useMemo(() => priceColors(sections), [sections]);
  const selectedTotal = selectedList.reduce((sum, seat) => sum + seat.price, 0);

  const seats = useQuery({
    queryKey: ["seat-section", eventId, activeSectionId],
    queryFn: () => getSectionSeats(eventId, activeSectionId as number),
    enabled: activeSectionId !== null,
    refetchInterval: SEATS_REFRESH_MS,
  });

  // Keep picked seats in other sections current while another section is open.
  const pickedSectionIds = [...new Set(selectedList.map(seat => seat.sectionId))].filter(id => id !== activeSectionId);
  const pickedSections = useQueries({ queries: pickedSectionIds.map(sectionId => ({ queryKey: ["seat-section", eventId, sectionId], queryFn: () => getSectionSeats(eventId, sectionId), refetchInterval: SEATS_REFRESH_MS })) });
  const pickedVersion = pickedSections.map(query => query.dataUpdatedAt).join(",");
  // A seat picked here but no longer AVAILABLE was taken by someone else: drop it from the order.
  useEffect(() => {
    const snapshots = [seats.data, ...pickedSections.map(query => query.data)].filter(data => data !== undefined);
    const gone = snapshots.flatMap(data => {
      const status = new Map(data.seats.map(seat => [seat.id, seat.status]));
      return Object.values(selected).filter(seat => seat.sectionId === data.section.id && status.get(seat.id) !== "AVAILABLE").map(seat => seat.id);
    });
    if (gone.length > 0) onSeatsGone(gone);
  }, [seats.data, pickedVersion, selected]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-check when fresh seat data arrives

  const chooseSection = (section: SeatSection) => {
    if (!disabled && pickable(section)) onSelectSection(section.id === activeSectionId ? null : section.id);
  };
  const sectionKey = (section: SeatSection) => (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseSection(section); }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">{tx("Схема зала")}{map.layoutName && <span className="font-normal text-muted"> · {map.layoutName}</span>}</p>
        <p className="text-xs text-muted">{tx("Выберите сектор, затем места. Стоячие зоны покупаются количеством в списке выше.")}</p>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto max-h-[22rem] w-full rounded-lg bg-surface" role="group" aria-label={tx("Схема зала")}>
        {map.stage && (
          <g aria-hidden="true">
            <rect x={map.stage.x} y={map.stage.y} width={map.stage.width} height={map.stage.height} rx={font / 2} className="fill-gray-700" />
            <text x={map.stage.x + map.stage.width / 2} y={map.stage.y + map.stage.height / 2} fontSize={font} textAnchor="middle" dominantBaseline="middle" className="fill-white font-semibold">{map.stage.label}</text>
          </g>
        )}
        {sections.map((section) => {
          const canPick = !disabled && pickable(section);
          const isActive = section.id === activeSectionId;
          const picked = selectedList.filter((seat) => seat.sectionId === section.id).length;
          const tone = section.price !== null ? colors.get(section.price) : undefined;
          // Active: primary; on sale: its price colour; sold out or not on sale: grey with a muted label.
          const fill = isActive ? undefined : (section.kind === "STANDING" || canPick) && tone ? tone : undefined;
          const look = isActive
            ? "fill-primary stroke-primary-dark"
            : fill
              ? `stroke-white ${canPick ? "cursor-pointer hover:opacity-85" : ""}`
              : section.kind === "STANDING" ? "fill-white stroke-gray-400" : "fill-gray-200 stroke-gray-300";
          const textColor = isActive ? "#ffffff" : fill ? labelOn(fill) : section.kind === "SEATED" && !canPick ? "#4b5563" : "#111111";
          const label = section.kind === "STANDING"
            ? tx("{0}: стоячая зона, {1}", [section.name, section.price === null ? tx("не продаётся") : formatPrice(section.price, locale)])
            : canPick
              ? tx("{0}: {1}, свободно мест: {2}", [section.name, formatPrice(section.price ?? 0, locale), section.available])
              : tx("{0}: нет доступных мест", [section.name]);
          return (
            <g
              key={section.id}
              role={section.kind === "SEATED" ? "button" : "img"}
              tabIndex={canPick ? 0 : undefined}
              aria-label={label}
              aria-pressed={section.kind === "SEATED" ? isActive : undefined}
              aria-disabled={section.kind === "SEATED" && !canPick ? true : undefined}
              onClick={() => chooseSection(section)}
              onKeyDown={sectionKey(section)}
              className="outline-none focus-visible:[&>rect]:stroke-[6]"
            >
              <title>{label}</title>
              <rect
                x={section.x} y={section.y} width={section.width} height={section.height} rx={font / 3}
                strokeWidth={3} strokeDasharray={section.kind === "STANDING" ? `${font / 2} ${font / 3}` : undefined}
                className={`transition-colors ${look}`}
                style={fill ? { fill } : undefined}
              />
              <text x={section.x + section.width / 2} y={section.y + section.height / 2 - font * 0.4} fontSize={font} textAnchor="middle" fill={textColor} className="pointer-events-none font-semibold">
                {section.key}{picked > 0 ? ` · ${picked}` : ""}
              </text>
              <text x={section.x + section.width / 2} y={section.y + section.height / 2 + font * 0.8} fontSize={font * 0.75} textAnchor="middle" fill={textColor} className="pointer-events-none">
                {section.price === null ? "—" : formatPrice(section.price, locale)}
              </text>
            </g>
          );
        })}
      </svg>
      {colors.size > 0 && <ul aria-label={tx("Цены по секторам")} className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {[...colors.entries()].map(([price, color]) => <li key={price} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3.5 w-5 rounded" style={{ background: color }} />{formatPrice(price, locale)}
        </li>)}
      </ul>}

      {active && (
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {active.name}
              <span className="font-normal text-muted"> · {active.ticketTypeName} · {formatPrice(active.price ?? 0, locale)}</span>
            </p>
            <Button variant="secondary" onClick={() => onSelectSection(null)}>{tx("Закрыть сектор")}</Button>
          </div>
          {seats.isLoading && <p role="status" className="mt-3 text-sm text-muted">{tx("Загружаем места…")}</p>}
          <MutationError error={seats.error} />
          {seats.data && (
            <SectionSeats
              key={seats.data.section.id}
              section={seats.data.section}
              seats={seats.data.seats}
              selected={selected}
              disabled={disabled}
              onToggle={(seat) => onToggle({
                id: seat.id,
                sectionId: active.id,
                sectionName: active.name,
                row: seat.row,
                number: seat.number,
                ticketTypeId: active.ticketTypeId as number,
                ticketTypeName: active.ticketTypeName ?? "",
                price: active.price ?? 0,
              })}
            />
          )}
          <SeatLegend />
        </div>
      )}

      {selectedList.length > 0 && (
        <div className="rounded-lg bg-primary-soft p-3">
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-primary-dark">
            <span>{tx("Выбранные места")} · {selectedList.length}</span>
            <span aria-live="polite">{tx("Сумма за места: {0}", [formatPrice(selectedTotal, locale)])}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {selectedList.map((seat) => (
              <li key={seat.id} className="flex items-center gap-2 rounded-full bg-white py-1 pl-3 pr-1 text-xs shadow-soft">
                <span>{seat.sectionName} · {tx("ряд {0}, место {1}", [seat.row, seat.number])} · {formatPrice(seat.price, locale)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(seat)}
                  aria-label={tx("Убрать место: ряд {0}, место {1}", [seat.row, seat.number])}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-primary-soft disabled:opacity-40"
                >×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectionSeats({ section, seats, selected, disabled, onToggle }: {
  section: SeatSection;
  seats: Seat[];
  selected: Record<number, SelectedSeat>;
  disabled?: boolean;
  onToggle: (seat: Seat) => void;
}) {
  const { tx } = useLanguage();
  const byId = useMemo(() => new Map(seats.map((seat) => [seat.id, seat])), [seats]);
  // Zoom 1–4×; pan is the view centre's offset from the middle, as a share of the full size.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });

  // Seat size from the closest neighbours in a row, so any layout's spacing works.
  const { radius, rows, box } = useMemo(() => {
    const rowMap = new Map<string, Seat[]>();
    for (const seat of seats) rowMap.set(seat.row, [...(rowMap.get(seat.row) ?? []), seat]);
    const sortedRows = [...rowMap.entries()].map(([label, row]) => [label, [...row].sort((a, b) => a.number - b.number)] as const);
    let gap = Infinity;
    for (const [, sorted] of sortedRows) {
      for (let i = 1; i < sorted.length; i++) {
        const d = Math.hypot(sorted[i].x - sorted[i - 1].x, sorted[i].y - sorted[i - 1].y);
        if (d > 0) gap = Math.min(gap, d);
      }
    }
    const spacing = Number.isFinite(gap) ? gap : 10;
    // The row number goes just before seat 1, in the direction the row runs: left of a row in the
    // end stands, above it in the side stands, where rows run from top to bottom.
    const rows = sortedRows.map(([label, sorted]) => {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const length = Math.hypot(last.x - first.x, last.y - first.y);
      const [dx, dy] = length > 0 ? [(last.x - first.x) / length, (last.y - first.y) / length] : [1, 0];
      return { label, x: first.x - dx * spacing * 1.3, y: first.y - dy * spacing * 1.3 };
    });
    // Frame the seats and their row numbers, whatever the section's shape.
    const xs = [...seats.map((seat) => seat.x), ...rows.map((row) => row.x)];
    const ys = [...seats.map((seat) => seat.y), ...rows.map((row) => row.y)];
    const minX = Math.min(...xs) - spacing;
    const minY = Math.min(...ys) - spacing;
    const box = { x: minX, y: minY, w: Math.max(...xs) + spacing - minX, h: Math.max(...ys) + spacing - minY };
    return { radius: spacing * 0.4, rows, box };
  }, [seats]);

  if (seats.length === 0) return <p className="mt-3 text-sm text-muted">{tx("В этом секторе нет мест для выбора.")}</p>;

  const limit = (zoom: number) => (1 - 1 / zoom) / 2;
  const clampView = (next: { zoom: number; x: number; y: number }) => {
    const zoom = Math.min(4, Math.max(1, next.zoom));
    return { zoom, x: Math.max(-limit(zoom), Math.min(limit(zoom), next.x)), y: Math.max(-limit(zoom), Math.min(limit(zoom), next.y)) };
  };
  const zoomBy = (factor: number) => setView(v => clampView({ ...v, zoom: v.zoom * factor }));
  const pan = (dx: number, dy: number) => setView(v => clampView({ ...v, x: v.x + dx / v.zoom, y: v.y + dy / v.zoom }));
  const w = box.w / view.zoom;
  const h = box.h / view.zoom;
  const viewBox = `${box.x + box.w * (0.5 + view.x) - w / 2} ${box.y + box.h * (0.5 + view.y) - h / 2} ${w} ${h}`;
  const zoomed = view.zoom > 1;

  // One handler for the whole section: a stadium sector has a thousand seats.
  const seatFrom = (target: EventTarget) => byId.get(Number((target as Element).getAttribute?.("data-seat-id")));
  const toggle = (seat: Seat | undefined) => {
    if (!disabled && seat && (seat.status === "AVAILABLE" || selected[seat.id])) onToggle(seat);
  };
  const onClick = (event: MouseEvent<SVGSVGElement>) => toggle(seatFrom(event.target));
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    // + / - / 0 zoom, arrow keys pan when zoomed in; Enter and Space pick the focused seat.
    const panKeys: Record<string, [number, number]> = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.5); return; }
    if (event.key === "-") { event.preventDefault(); zoomBy(1 / 1.5); return; }
    if (event.key === "0") { event.preventDefault(); setView({ zoom: 1, x: 0, y: 0 }); return; }
    if (panKeys[event.key] && zoomed) { event.preventDefault(); pan(...panKeys[event.key]); return; }
    if (event.key !== "Enter" && event.key !== " ") return;
    const seat = seatFrom(event.target);
    if (seat) { event.preventDefault(); toggle(seat); }
  };

  const tool = "flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-bold hover:border-primary hover:bg-primary-soft disabled:opacity-40";
  return (
    <div className="mt-3">
    <div role="toolbar" aria-label={tx("Масштаб схемы")} className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={tool} onClick={() => zoomBy(1.5)} disabled={view.zoom >= 4} aria-label={tx("Приблизить")}>+</button>
      <button type="button" className={tool} onClick={() => zoomBy(1 / 1.5)} disabled={!zoomed} aria-label={tx("Отдалить")}>−</button>
      <button type="button" className={`${tool} w-auto px-3 text-sm`} onClick={() => setView({ zoom: 1, x: 0, y: 0 })} disabled={!zoomed}>{tx("Сбросить масштаб")}</button>
      {zoomed && <>
        <button type="button" className={tool} onClick={() => pan(-0.25, 0)} aria-label={tx("Сдвинуть влево")}><Icon name="chevronLeft" className="h-4 w-4" /></button>
        <button type="button" className={tool} onClick={() => pan(0, -0.25)} aria-label={tx("Сдвинуть вверх")}><Icon name="chevronDown" className="h-4 w-4 rotate-180" /></button>
        <button type="button" className={tool} onClick={() => pan(0, 0.25)} aria-label={tx("Сдвинуть вниз")}><Icon name="chevronDown" className="h-4 w-4" /></button>
        <button type="button" className={tool} onClick={() => pan(0.25, 0)} aria-label={tx("Сдвинуть вправо")}><Icon name="chevronRight" className="h-4 w-4" /></button>
      </>}
      <span className="ml-1 text-xs text-muted" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
    </div>
    <p className="mt-1 text-xs text-muted">{tx("Клавиши: + и − меняют масштаб, стрелки сдвигают схему, 0 сбрасывает.")}</p>
    <svg viewBox={viewBox} className="mt-2 h-auto max-h-[28rem] w-full rounded-lg bg-surface" role="group" aria-label={tx("Места сектора {0}", [section.name])} onClick={onClick} onKeyDown={onKeyDown}>
      {rows.map((row) => (
        <text key={row.label} x={row.x} y={row.y} fontSize={radius * 1.8} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none fill-gray-500">{row.label}</text>
      ))}
      {seats.map((seat) => {
        const isSelected = !!selected[seat.id];
        const free = seat.status === "AVAILABLE";
        const look = seatLook(seat.status, isSelected);
        const stateLabel = isSelected ? tx("Выбрано") : tx(({ AVAILABLE: "Свободно", HELD: "Зарезервировано другим покупателем", YOURS: "В вашем неоплаченном заказе", SOLD: "Продано", UNAVAILABLE: "Недоступно" })[seat.status]);
        const label = tx("Ряд {0}, место {1}", [seat.row, seat.number]) + (seat.accessible ? tx(", доступная среда") : "") + ", " + stateLabel;
        const symbol = seatSymbol(seat, isSelected);
        return (
          <g key={seat.id}><circle
            key={seat.id}
            data-seat-id={seat.id}
            cx={seat.x}
            cy={seat.y}
            r={radius}
            role="button"
            tabIndex={free || isSelected ? 0 : -1}
            aria-label={label}
            aria-pressed={isSelected}
            aria-disabled={!free && !isSelected}
            strokeWidth={radius * 0.3}
            className={`outline-none stroke-transparent focus-visible:stroke-black ${look.fill}`}
          >
            <title>{label}</title>
          </circle><text x={seat.x} y={seat.y} textAnchor="middle" dominantBaseline="central" fontSize={radius * 1.1} className={`pointer-events-none ${look.text}`} aria-hidden="true">{symbol}</text>
            {seat.accessible && <g aria-hidden="true" data-accessible-badge="true" className="pointer-events-none">
              <circle cx={seat.x + radius * 0.78} cy={seat.y - radius * 0.78} r={radius * 0.45} className="fill-sky-700 stroke-white" strokeWidth={radius * 0.1} />
              <text x={seat.x + radius * 0.78} y={seat.y - radius * 0.78} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.55} className="fill-white">♿</text>
            </g>}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

function SeatLegend() {
  const { tx } = useLanguage();
  // The same fill and symbol as on the map, so the legend works without colour too.
  const items: [string, string, string][] = [
    ["bg-emerald-500 text-black", "1", tx("Свободно")],
    ["bg-primary text-white", "✓", tx("Выбрано")],
    ["bg-amber-300 text-black", "…", tx("Зарезервировано другим покупателем")],
    ["bg-blue-300 text-black", "Y", tx("В вашем неоплаченном заказе")],
    ["bg-gray-600 text-white", "×", tx("Продано")],
    ["bg-gray-200 text-black", "—", tx("Недоступно")],
    ["bg-sky-700 text-white", "♿", tx("Доступная среда (значок рядом с местом)")],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label={tx("Обозначения")}>
      {items.map(([look, symbol, text]) => (
        <li key={text} className="flex items-center gap-1.5"><span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.625rem] font-semibold leading-none ${look}`} aria-hidden="true">{symbol}</span>{text}</li>
      ))}
    </ul>
  );
}
