import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../ui/Button";

// Grey top bar: logo, city, search, languages, login.
export function Header() {
  const { user, isLoggedIn, openLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Keep the box in sync when the URL changes (e.g. back button)
  useEffect(() => setQuery(params.get("q") ?? ""), [params]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  return (
    <header className="bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
        <Link to="/" className="text-xl font-bold">
          BiletFlow
        </Link>

        {/* City choice comes later: the backend has no cities yet */}
        <span className="text-sm" title="Выбор города появится позже">
          Алматы
        </span>

        <form onSubmit={onSearch} role="search" className="order-last w-full md:order-none md:w-auto md:flex-1">
          <label htmlFor="search" className="sr-only">
            Поиск событий
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск событий..."
            className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </form>

        <div className="ml-auto flex items-center gap-6 md:ml-0">
          {/* Language switch comes later (i18n step) */}
          <span className="text-xs text-muted" title="Переключение языка появится позже">
            KZ | <b className="text-black">RU</b> | ENG
          </span>

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="max-w-40 truncate text-sm" title={user?.email}>
                {user?.email ?? "…"}
              </span>
              <Button variant="secondary" onClick={logout}>
                Выйти
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={openLogin} className="min-w-28 bg-gray-300">
              Войти
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
