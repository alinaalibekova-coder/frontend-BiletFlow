import { Link, useLocation, useSearchParams } from "react-router-dom";
import { usePublicEvents } from "../../hooks/useEvents";
import { categoryKey, categoryLabel } from "../../lib/format";
import { useLanguage } from "../../i18n/LanguageContext";
import { catalogParams } from "../../lib/cities";
import { Icon, categoryIcon, type IconName } from "../ui/Icons";

// Category menu (Кино, Театры, Концерты…).
// The backend has no list of categories yet, so we show the categories
// that the loaded events actually have.
export function CategoryNav() {
  const { data: events } = usePublicEvents();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const active = params.get("category");
  const { t, locale } = useLanguage();
  const categoryUrl = (category?: string) => {
    const next = catalogParams(params);
    if (category) next.set("category", category); else next.delete("category");
    return `/?${next}`;
  };

  if (pathname.startsWith("/organizer")) return null;

  const categories = [...new Map((events ?? []).filter(event => event.category?.trim()).map(event => [categoryKey(event.category), event.category])).values()];
  if (categories.length === 0) return null;

  // Pill chips; the active one is filled (and marked aria-current), not only recoloured.
  const link = (to: string, label: string, icon: IconName, isActive: boolean) => (
    <li key={to} className="shrink-0">
      <Link
        to={to}
        aria-current={isActive ? "page" : undefined}
        className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${isActive ? "border-primary bg-primary text-white shadow-soft" : "border-gray-300 bg-white hover:border-primary hover:bg-primary-soft hover:text-primary-dark"}`}
      >
        <Icon name={icon} className="h-4 w-4" />
        {label}
      </Link>
    </li>
  );

  return (
    <nav aria-label={t("categories")} className="border-b border-gray-200 bg-white">
      <ul className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
        {link(categoryUrl(), t("all"), "grid", !active)}
        {categories.map((c) => link(categoryUrl(c), categoryLabel(c, locale), categoryIcon(c), !!active && categoryKey(active) === categoryKey(c)))}
      </ul>
    </nav>
  );
}
