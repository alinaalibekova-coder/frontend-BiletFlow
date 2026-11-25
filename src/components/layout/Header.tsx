import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/Button";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "../../api/notifications";
import { useLanguage } from "../../i18n/LanguageContext";
import { catalogParams, cities } from "../../lib/cities";
import { Icon, LogoMark, type IconName } from "../ui/Icons";

// Top bar: logo, city, search, languages, and the signed-in user's menu.
export function Header() {
  const { user, isLoggedIn, openLogin } = useAuth();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, t, tx } = useLanguage();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const unread = useQuery({ queryKey: ["unread-notifications", user?.id], queryFn: getUnreadCount, enabled: isLoggedIn, refetchInterval: 30000 });
  const unreadCount = unread.data?.unread ?? 0;

  // Keep the box in sync when the URL changes (e.g. back button)
  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    updateSearch(query);
  };

  const updateSearch = (value: string) => {
    setQuery(value);
    const next = pathname === "/" ? catalogParams(params) : new URLSearchParams();
    next.set("lang", language);
    if (value.trim()) next.set("q", value);
    else next.delete("q");
    navigate(`/?${next}`, { replace: true });
  };
  const selectedCity = params.get("city") ?? "";
  const updateCity = (city: string) => {
    const next = pathname === "/" ? catalogParams(params) : new URLSearchParams();
    next.set("lang", language);
    if (city) next.set("city", city); else next.delete("city");
    navigate(`/?${next}`);
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 rounded-lg text-xl font-extrabold tracking-tight text-ink" aria-label="BiletFlow">
          <LogoMark />
          <span aria-hidden="true">Bilet<span className="text-primary">Flow</span></span>
        </Link>

        <label className="relative flex items-center text-sm">
          <span className="sr-only">{t("city")}</span>
          <Icon name="pin" className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted" />
          <select value={cities.some(city => city.id === selectedCity) || selectedCity === "unknown" ? selectedCity : ""} onChange={e => updateCity(e.target.value)} className="max-w-48 appearance-none rounded-full border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm font-medium hover:border-primary">
            <option value="">{t("allCities")}</option>
            {cities.map(city => <option key={city.id} value={city.id}>{city[language]}</option>)}
            <option value="unknown">{t("unknownCity")}</option>
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted" />
        </label>

        <form onSubmit={onSearch} role="search" className="relative order-last w-full min-w-0 md:order-none md:min-w-[220px] md:flex-1">
          <label htmlFor="search" className="sr-only">
            {t("search")}
          </label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="block w-full min-w-0 rounded-full border border-gray-300 bg-surface py-2 pl-9 pr-4 text-sm outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div role="group" aria-label={t("language")} className="flex rounded-full bg-surface p-0.5 text-xs">
            {([["kk", "KZ"], ["ru", "RU"], ["en", "ENG"]] as const).map(([code, label]) => <button key={code} type="button" lang={code} aria-pressed={language === code} onClick={() => setLanguage(code)} className={`min-h-8 rounded-full px-2.5 py-1 font-semibold ${language === code ? "bg-white text-primary-dark shadow-soft" : "text-muted hover:text-black"}`}>{label}</button>)}
          </div>
          {isLoggedIn && (
            <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface"
              aria-label={unreadCount > 0 ? tx("Уведомления: непрочитанных {0}", [unreadCount]) : t("notifications")}>
              <Icon name="bell" />
              {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-danger px-1.5 text-center text-xs font-bold leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
          )}
          {isLoggedIn ? <UserMenu unreadCount={unreadCount} /> : (
            <Button onClick={openLogin} className="min-w-24">{t("login")}</Button>
          )}
        </div>
      </div>
    </header>
  );
}

// Account, settings, notifications, support and role dashboards, grouped behind one button.
// A disclosure (not an ARIA menu): plain links in tab order, Escape closes and returns focus.
function UserMenu({ unreadCount }: { unreadCount: number }) {
  const { user, logout } = useAuth();
  const { t, tx } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const role = user?.role.trim().toUpperCase().replace(/^ROLE_/, "");

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    const onPointer = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onFocus = (e: FocusEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  const item = (to: string, icon: IconName, label: string, extra?: ReactNode) => (
    <li><Link to={to} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-primary-soft hover:text-primary-dark">
      <Icon name={icon} className="h-4 w-4" />{label}{extra}
    </Link></li>
  );
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}
        className="flex min-h-10 items-center gap-2 rounded-full border border-gray-300 py-1 pl-1 pr-2.5 text-sm font-semibold hover:border-primary">
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{initial}</span>
        <span className="hidden max-w-36 truncate sm:inline">{user?.email ?? "…"}</span>
        <span className="sr-only sm:hidden">{tx("Меню аккаунта")}</span>
        <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} hidden={!open} className="absolute right-0 z-40 mt-2 w-72 rounded-[var(--radius-card)] border border-gray-200 bg-white p-2 shadow-panel">
        <p className="truncate px-3 pb-2 pt-1 text-xs text-muted" title={user?.email}>{user?.email}</p>
        <nav aria-label={tx("Меню аккаунта")}>
          <ul>
            {item("/account", "ticket", t("myTickets"))}
            {item("/account/settings", "settings", t("profile"))}
            {item("/notifications", "bell", t("notifications"), unreadCount > 0 && <span className="ml-auto rounded-full bg-danger-soft px-2 text-xs font-bold text-danger-ink">{unreadCount}</span>)}
            {item("/support", "help", t("support"))}
          </ul>
          {role && role !== "USER" && <ul className="mt-1 border-t border-gray-200 pt-1">
            {role === "ATTENDEE" && item("/organizer", "briefcase", t("becomeOrganizer"))}
            {role === "ORGANIZER" && item("/organizer/events", "chart", t("organizer"))}
            {["EVENT_ADMIN", "EVENT_STAFF", "CHECK_IN_STAFF"].includes(role) && item("/staff", "scan", t("checkIn"))}
            {["PLATFORM_ADMIN", "ADMIN"].includes(role) && <>{item("/admin/dashboard", "shield", t("platform"))}{item("/admin/users", "users", t("users"))}</>}
          </ul>}
        </nav>
        <button type="button" onClick={logout} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-lg border-t border-gray-200 px-3 py-2 text-left text-sm hover:bg-surface">
          <Icon name="logout" className="h-4 w-4" />{t("logout")}
        </button>
      </div>
    </div>
  );
}
