import { Link, useSearchParams } from "react-router-dom";
import { usePublicEvents } from "../../hooks/useEvents";
import { categoryLabel } from "../../lib/format";

// Category menu (Кино, Театры, Концерты…).
// The backend has no list of categories yet, so we show the categories
// that the loaded events actually have.
export function CategoryNav() {
  const { data: events } = usePublicEvents();
  const [params] = useSearchParams();
  const active = params.get("category");

  const categories = Array.from(new Set((events ?? []).map((e) => e.category).filter(Boolean)));
  if (categories.length === 0) return null;

  const link = (to: string, label: string, isActive: boolean) => (
    <Link
      key={to}
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={`whitespace-nowrap py-2 text-sm ${isActive ? "border-b-2 border-black font-semibold" : "hover:underline"}`}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="Категории" className="border-b">
      <div className="mx-auto flex max-w-6xl gap-8 overflow-x-auto px-4">
        {link("/", "Все", !active)}
        {categories.map((c) => link(`/?category=${encodeURIComponent(c)}`, categoryLabel(c), active === c))}
      </div>
    </nav>
  );
}
