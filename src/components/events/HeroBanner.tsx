import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { buttonClass } from "../ui/Button";
import { categoryLabel, formatPrice, formatShortDate, formatTime } from "../../lib/format";
import { useLanguage } from "../../i18n/LanguageContext";
import { cityLabel, venueCity } from "../../lib/cities";
import { EventPoster } from "./EventPoster";
import { Icon } from "../ui/Icons";

const ROTATE_MS = 7000;

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The next upcoming events as a carousel. Rotation pauses on hover and keyboard focus, has its
// own pause button (WCAG 2.2.2), and never starts for people who prefer reduced motion.
export function HeroBanner({ events }: { events: Event[] }) {
  const { t, tx, locale, language } = useLanguage();
  const slides = events.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const rotating = slides.length > 1 && !stopped && !reducedMotion && !hovered && !focused;
  useEffect(() => {
    if (!rotating || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setIndex(current => (current + 1) % slides.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, index, slides.length]);

  const current = slides[Math.min(index, slides.length - 1)];
  if (!current) return null;
  const go = (next: number) => setIndex((next + slides.length) % slides.length);
  const city = venueCity(current.venue);
  const price = typeof current.minPrice === "number" ? current.minPrice : null;
  const posterNeedsAuth = current.status !== undefined && current.status !== "PUBLISHED";

  return (
    <section
      aria-roledescription={tx("карусель")}
      aria-label={tx("Ближайшие события")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
      className="relative isolate overflow-hidden rounded-[var(--radius-card)] bg-ink text-white shadow-lifted"
    >
      {/* Poster as a darkened, blurred backdrop; the sharp poster card sits on the right. */}
      <EventPoster key={`bg-${current.id}`} posterUrl={current.posterUrl} authenticated={posterNeedsAuth} category={current.category} alt="" className="absolute inset-0 -z-10 scale-110 blur-2xl" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-r from-ink via-ink/85 to-ink/40" />

      <div
        key={current.id}
        role="group"
        aria-roledescription={tx("слайд")}
        aria-label={tx("Слайд {0} из {1}", [index + 1, slides.length])}
        aria-live={rotating ? "off" : "polite"}
        className="grid min-h-64 animate-page-in gap-6 p-6 md:min-h-80 md:grid-cols-[1fr_auto] md:p-10"
      >
        <div className="flex flex-col justify-center">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
            <span className="rounded-full bg-white/15 px-2.5 py-1">{categoryLabel(current.category, locale)}</span>
          </p>
          <h2 className="mt-3 max-w-xl text-2xl font-extrabold leading-tight md:text-4xl">{current.title}</h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <li className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-ink">
              <Icon name="calendar" className="h-4 w-4 text-primary" />{formatShortDate(current.startTime, locale)}, {formatTime(current.startTime)}
            </li>
            {price !== null && <li className="rounded-full bg-primary-soft px-3 py-1 font-semibold text-primary-dark">
              {price === 0 ? t("free") : t("fromPrice", { price: formatPrice(price, locale) })}
            </li>}
          </ul>
          {(current.venue?.name || city) && <p className="mt-3 flex items-center gap-1.5 text-sm text-white/85">
            <Icon name="pin" className="h-4 w-4" />
            {[current.venue?.name, city ? cityLabel(city, language) : null].filter(Boolean).join(" · ")}
          </p>}
          <div className="mt-6">
            <Link to={`/events/${current.id}`} className={`${buttonClass("primary")} inline-flex items-center gap-2 px-5 py-2.5 ring-1 ring-white/20`}>
              <Icon name="ticket" className="h-4 w-4" />{t("buyTicket")}
            </Link>
          </div>
        </div>
        <EventPoster posterUrl={current.posterUrl} authenticated={posterNeedsAuth} category={current.category} alt={current.title} className="hidden aspect-[3/4] w-48 rounded-xl shadow-panel ring-1 ring-white/20 md:flex lg:w-56" />
      </div>

      {slides.length > 1 && (
        <div className="flex items-center gap-2 px-6 pb-5 md:px-10">
          <button type="button" onClick={() => go(index - 1)} aria-label={tx("Предыдущее событие")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><Icon name="chevronLeft" /></button>
          <ul className="flex items-center gap-1" aria-label={tx("Выбор слайда")}>
            {slides.map((slide, i) => (
              <li key={slide.id}>
                <button type="button" onClick={() => go(i)} aria-label={tx("Слайд {0}: {1}", [i + 1, slide.title])} aria-current={i === index ? "true" : undefined}
                  className="flex h-10 w-8 items-center justify-center">
                  <span aria-hidden="true" className={`block h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2.5 border border-white/80"}`} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => go(index + 1)} aria-label={tx("Следующее событие")} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><Icon name="chevronRight" /></button>
          {!reducedMotion && <button type="button" onClick={() => setStopped(value => !value)} aria-pressed={stopped} className="ml-auto min-h-10 rounded-full bg-white/15 px-3 text-sm font-semibold hover:bg-white/25">
            {stopped ? tx("Включить прокрутку") : tx("Пауза")}
          </button>}
        </div>
      )}
    </section>
  );
}
