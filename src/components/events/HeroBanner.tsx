import { Link } from "react-router-dom";
import type { Event } from "../../api/types";
import { buttonClass } from "../ui/Button";
import { categoryLabel, formatShortDate, formatTime } from "../../lib/format";
import { useLanguage } from "../../i18n/LanguageContext";

// Big grey banner at the top of the home page, showing the next upcoming event.
export function HeroBanner({ event }: { event: Event }) {
  const { t, locale } = useLanguage();
  return (
    <section className="flex min-h-56 flex-col justify-start rounded-2xl bg-surface p-6 md:min-h-72">
      <p className="text-xs font-semibold uppercase text-muted">{categoryLabel(event.category, locale)}</p>
      <h2 className="mt-1 text-2xl font-bold md:text-3xl">{event.title}</h2>
      <p className="mt-1 text-sm font-semibold">
        {formatShortDate(event.startTime, locale)}, {formatTime(event.startTime)}
        {event.venue?.name && ` • ${event.venue.name}`}
      </p>
      <div className="mt-5">
        <Link to={`/events/${event.id}`} className={buttonClass("primary")}>
          {t("buyTicket")}
        </Link>
      </div>
    </section>
  );
}
