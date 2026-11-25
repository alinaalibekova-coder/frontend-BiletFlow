import { getSeatingLayouts } from "../api/seating";
import { Icon, type IconName } from "../components/ui/Icons";
import { getAdminEvents } from "../api/platform";
import { useLanguage } from "../i18n/LanguageContext";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  createTicketType,
  createVenue,
  deleteEventPoster,
  duplicateEvent,
  getEvent,
  getMyEventsByPhase,
  getOrganizerEvents,
  getOrganizerProfile,
  getTicketTypes,
  getVenues,
  manageEvent,
  setEventSuspended,
  setTicketTypeHidden,
  updateEvent,
  updateTicketType,
  uploadEventPoster,
  type EventManagementAction,
} from "../api/events";
import type {
  CreateEventRequest,
  CreateTicketTypeRequest,
  Event,
  EventPhase,
  EventStatus,
  TicketType,
  UpdateTicketTypeRequest,
  UpdateEventRequest,
  Venue,
  Visibility,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";
import { BecomeOrganizerForm } from "../components/auth/BecomeOrganizerForm";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EventPoster } from "../components/events/EventPoster";
import { EventSuspensionDialog } from "../components/events/EventSuspensionDialog";
import { formatTicketSalesEnd, getEventTicketSaleState, getTicketSaleState } from "../lib/ticketSales";
import { almatyTimestamp, categoryLabel, eventCategoryOptions, formatDateTime } from "../lib/format";
import { cities, venueCity } from "../lib/cities";
import { prepareVenueRequest, validateEventVenue, venuesInCity } from "../lib/venues";

const isOrganizer = (role: string) => role.trim().toUpperCase().replace(/^ROLE_/, "") === "ORGANIZER";
const isPlatformAdmin = (role: string) => ["PLATFORM_ADMIN", "ADMIN"].includes(role.trim().toUpperCase().replace(/^ROLE_/, ""));
const EVENTS_PAGE_SIZE = 20;

function useDashboardBase() {
  const { user } = useAuth();
  return isPlatformAdmin(user?.role ?? "") ? "/admin/dashboard" : "/organizer";
}

function StatusBadge({ status }: { status?: EventStatus }) {
  const { tx } = useLanguage();
  const styles: Record<EventStatus, string> = {
    DRAFT: "bg-amber-100 text-amber-800",
    PUBLISHED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  const labels: Record<EventStatus, string> = {
    DRAFT: tx("Черновик"),
    PUBLISHED: tx("Опубликовано"),
    CANCELLED: tx("Отменено"),
  };
  const value = status ?? "DRAFT";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[value]}`}>{tx(labels[value])}</span>;
}

function OrganizerEventsList({ events, emptyMessage }: { events: Event[]; emptyMessage: string }) {
  const { tx, locale } = useLanguage();
  const base = useDashboardBase();
  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-8 text-center">
        <p className="text-sm text-muted">{emptyMessage}</p>
        {base === "/organizer" && <Link to={`${base}/create`} className={`${buttonClass()} mt-4`}>{tx("Создать событие")}</Link>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{event.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {event.venue?.name ?? tx("Площадка не указана")} · {formatDate(event.startTime, locale)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={event.status} />
            {base === "/organizer" && <>
            {event.status === "DRAFT" && <Link to={`/events/${event.id}?preview=1`} className="text-sm font-semibold underline">{tx("Предпросмотр")}</Link>}
            <Link to={`${base}/events/${event.id}/tickets`} className="text-sm font-semibold underline">
              {tx("Билеты")}</Link>
            <Link to={`${base}/events/${event.id}/staff`} className="text-sm font-semibold underline">
              {tx("Сотрудники")}</Link>
            {event.status !== "CANCELLED" && (
              <Link to={`${base}/events/${event.id}/edit`} className="text-sm font-semibold underline">
                {tx("Изменить")}</Link>
            )}
            <Link to={`${base}/events/${event.id}/seating`} className="text-sm font-semibold underline">{tx("Настройка мест")}</Link>
            {event.phase === "COMPLETED" && <Link to={`${base}/events/${event.id}/payout`} className="text-sm font-semibold underline">{tx("Выплата за событие")}</Link>}
            <Link to={`${base}/events/${event.id}/campaigns`} className="text-sm font-semibold underline">{tx("Кампании")}</Link>
            <Link to={`${base}/events/${event.id}/activation`} className="text-sm font-semibold underline">{tx("Платные продажи")}</Link>
            </>}
            {base === "/admin/dashboard" && <><Link to={`/events/${event.id}`} className="text-sm underline">{tx("Просмотр")}</Link><Link to={`${base}/events/${event.id}/staff`} className="text-sm underline">{tx("Сотрудники")}</Link></>}
            <Link to={`${base}/manage`} className="text-sm font-semibold underline">{tx("Управлять")}</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function useOrganizerEvents(page = 0, phase?: EventPhase) {
  const { user } = useAuth();
  const role = user?.role.trim().toUpperCase().replace(/^ROLE_/, "") ?? "";
  const platformAdmin = isPlatformAdmin(role);
  const profile = useQuery({
    queryKey: ["organizer-profile", role],
    queryFn: getOrganizerProfile,
    enabled: !platformAdmin,
  });
  const events = useQuery({
    // The phase goes at the end only when a tab is chosen, so the "All" list keeps its old cache key
    queryKey: phase
      ? ["organizer-events", platformAdmin ? "all" : profile.data?.userId, page, phase]
      : ["organizer-events", platformAdmin ? "all" : profile.data?.userId, page],
    queryFn: () => platformAdmin
      ? getAdminEvents({ page, size: EVENTS_PAGE_SIZE })
      : phase
        ? getMyEventsByPhase(phase, page, EVENTS_PAGE_SIZE)
        : getOrganizerEvents(profile.data!.userId, page, EVENTS_PAGE_SIZE),
    enabled: platformAdmin || !!profile.data?.userId,
  });
  return { profile, events, platformAdmin };
}

function EventListPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const { tx } = useLanguage();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>{tx("Назад")}</Button>
      <span className="text-sm text-muted">{tx("Страница ")}{page + 1} {tx(" из ")}{totalPages}</span>
      <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>{tx("Далее")}</Button>
    </div>
  );
}

function QueryState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { tx } = useLanguage();
  if (loading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загрузка…")}</p>;
  if (error) {
    const message = error instanceof Error ? tx(error.message) : tx("Не удалось загрузить данные.");
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-800">
        <p>{tx(message)}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>{tx("Повторить")}</Button>
      </div>
    );
  }
  return children;
}

export function OrganizerGuard() {
  const { tx } = useLanguage();
  const { user, isLoggedIn, isUserLoading, userError, refetchUser, openLogin } = useAuth();

  if (!isLoggedIn) {
    return (
      <AccessMessage
        title={tx("Войдите в аккаунт")}
        detail={tx("Для доступа к кабинету организатора нужно авторизоваться.")}
        action={<Button onClick={openLogin}>{tx("Войти")}</Button>}
      />
    );
  }
  if (isUserLoading || !user && !userError) {
    return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Проверяем аккаунт…")}</p>;
  }
  if (userError) {
    return (
      <AccessMessage
        title={tx("Не удалось проверить аккаунт")}
        detail={userError instanceof Error ? tx(userError.message) : tx("Попробуйте ещё раз.")}
        action={<Button variant="secondary" onClick={refetchUser}>{tx("Повторить")}</Button>}
      />
    );
  }
  if (user && user.role.trim().toUpperCase().replace(/^ROLE_/, "") === "ATTENDEE") {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border p-8">
        <h1 className="text-xl font-bold">{tx("Станьте организатором")}</h1>
        <p className="mt-2 text-sm text-muted">{tx("Кабинет организатора доступен организаторам. Укажите контакты, и ваш аккаунт станет аккаунтом организатора.")}</p>
        <BecomeOrganizerForm className="mt-5" />
      </section>
    );
  }
  if (!user || !isOrganizer(user.role)) {
    return (
      <AccessMessage
        title={tx("Нет доступа к управлению мероприятиями")}
        detail={tx("Текущая роль: {0}.", [user?.role ?? tx("не определена")])}
        action={<Link to="/" className={buttonClass("secondary")}>{tx("На главную")}</Link>}
      />
    );
  }
  return <Outlet />;
}

function AccessMessage({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  const { tx } = useLanguage();
  return (
    <section className="mx-auto max-w-xl rounded-2xl border p-8 text-center">
      <h1 className="text-xl font-bold">{tx(title)}</h1>
      <p className="mt-2 text-sm text-muted">{tx(detail)}</p>
      <div className="mt-5">{action}</div>
    </section>
  );
}

export function OrganizerDashboardLayout() {
  const { tx } = useLanguage();
  const base = useDashboardBase();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  const platformAdmin = base === "/admin/dashboard";
  const tabs: { to: string; label: string; icon: IconName }[] = [
    ...(platformAdmin ? [{ to: `${base}/overview`, label: tx("Обзор платформы"), icon: "chart" as IconName }, ...([["orders", "Заказы", "ticket"], ["payments", "Платежи", "wallet"], ["refunds", "Возвраты", "undo"], ["campaigns", "Промокампании", "sparkle"], ["reports", "Жалобы на события", "flag"], ["settings", "Настройки платформы", "settings"], ["venues", "Схемы площадок", "map"]] as const).map(([path, label, icon]) => ({ to: `${base}/${path}`, label: tx(label), icon: icon as IconName }))] : []),
    { to: `${base}/payouts`, label: tx("Выплаты"), icon: "briefcase" },
    { to: `${base}/events`, label: platformAdmin ? tx("Все мероприятия") : tx("Мои мероприятия"), icon: "calendar" },
    ...(!platformAdmin ? [{ to: `${base}/create`, label: tx("Создать мероприятие"), icon: "sparkle" as IconName }] : []),
    { to: `${base}/manage`, label: tx("Управление"), icon: "settings" },
    { to: `${base}/sales`, label: tx("Продажи"), icon: "chart" },
    ...(platformAdmin ? [{ to: `${base}/verification`, label: tx("Заявки организаторов"), icon: "shield" as IconName }, { to: `${base}/activations`, label: tx("Платные продажи"), icon: "wallet" as IconName }, { to: `${base}/support`, label: tx("Эскалации"), icon: "help" as IconName }] : [{ to: "/support", label: tx("Поддержка"), icon: "help" as IconName }]),
    { to: "/staff", label: tx("Check-in"), icon: "scan" },
  ];
  const navLabel = platformAdmin ? tx("Разделы панели администратора") : tx("Разделы кабинета организатора");

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-[var(--radius-card)] bg-ink p-4 text-white shadow-lifted">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{platformAdmin ? tx("Панель платформенного администратора") : tx("Кабинет организатора")}</p>
          <p className="mt-1 text-lg font-bold leading-snug">{platformAdmin ? tx("Управление всеми мероприятиями") : tx("Управление событиями")}</p>
          <button type="button" aria-expanded={menuOpen} aria-controls="dashboard-nav" onClick={() => setMenuOpen(open => !open)}
            className="mt-3 flex min-h-10 w-full items-center justify-between rounded-lg bg-white/10 px-3 text-sm font-semibold hover:bg-white/20 lg:hidden">
            <span className="flex items-center gap-2"><Icon name="menu" className="h-4 w-4" />{navLabel}</span>
            <Icon name="chevronDown" className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        <nav id="dashboard-nav" aria-label={navLabel} className={`${menuOpen ? "block" : "hidden"} mt-3 rounded-[var(--radius-card)] border border-gray-200 bg-white p-2 shadow-soft lg:block`}>
          <ul className="space-y-0.5">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-primary text-white" : "text-brand hover:bg-primary-soft hover:text-primary-dark"}`
                  }
                >
                  <Icon name={tab.icon} className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <h1 className="sr-only">{platformAdmin ? tx("Управление всеми мероприятиями") : tx("Управление событиями")}</h1>
        <Outlet />
      </div>
    </section>
  );
}

export function MyOrganizerEventsPage() {
  const { tx } = useLanguage();
  const [page, setPage] = useState(0);
  const base = useDashboardBase();
  const { profile, events, platformAdmin } = useOrganizerEvents(page);
  const retry = () => {
    if (!platformAdmin) void profile.refetch();
    void events.refetch();
  };
  return (
    <QueryState loading={(!platformAdmin && profile.isLoading) || events.isLoading} error={(platformAdmin ? null : profile.error) ?? events.error} onRetry={retry}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{platformAdmin ? tx("Все мероприятия платформы") : tx("Мои мероприятия")}</h2>
          <p className="text-sm text-muted">{platformAdmin ? tx("Модерируйте мероприятия всех организаторов.") : tx("Все события, созданные вашим аккаунтом организатора.")}</p>
        </div>
        {!platformAdmin && <Link to={`${base}/create`} className={buttonClass()}>{tx("Создать событие")}</Link>}
      </div>
      <OrganizerEventsList events={events.data?.content ?? []} emptyMessage={platformAdmin ? tx("Мероприятия не найдены.") : tx("У вас пока нет событий.")} />
      <EventListPagination page={page} totalPages={events.data?.totalPages ?? 0} onChange={setPage} />
    </QueryState>
  );
}

export function CreateOrganizerEventPage() {
  const { tx } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => getVenues() });
  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
  });
  if (venues.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загрузка площадок…")}</p>;
  if (venues.error) {
    return (
      <QueryState
        loading={false}
        error={venues.error}
        onRetry={() => { void venues.refetch(); }}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">{tx("Создать мероприятие")}</h2>
      <p className="mb-5 text-sm text-muted">{tx("После создания событие появится в списке как черновик.")}</p>
      <OrganizerEventForm
        venues={venues.data?.content ?? []}
        isPending={mutation.isPending}
        error={mutation.error}
        submitLabel={mutation.isPending ? tx("Создаём…") : tx("Создать событие")}
        onSubmit={(request) => mutation.mutate(request, {
          onSuccess: (createdEvent) => navigate(`/organizer/events/${createdEvent.id}/tickets`),
        })}
      />
    </div>
  );
}

export function EditOrganizerEventPage() {
  const { tx } = useLanguage();
  const { eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const navigate = useNavigate();
  const base = useDashboardBase();
  const queryClient = useQueryClient();
  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId),
    enabled: Number.isSafeInteger(eventId) && eventId > 0,
  });
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => getVenues() });
  const mutation = useMutation({
    mutationFn: (request: UpdateEventRequest) => updateEvent(eventId, request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
      navigate(`${base}/events`);
    },
  });

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return <AccessMessage title={tx("Некорректный ID события")} detail={tx("Проверьте ссылку и выберите событие из списка.")} action={<Link to={`${base}/events`} className={buttonClass("secondary")}>{tx("К мероприятиям")}</Link>} />;
  }
  if (event.isLoading || venues.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загрузка события…")}</p>;
  if (event.error || venues.error) {
    return (
      <QueryState
        loading={false}
        error={event.error ?? venues.error}
        onRetry={() => { void event.refetch(); void venues.refetch(); }}
      >
        {null}
      </QueryState>
    );
  }
  if (!event.data) {
    return <AccessMessage title={tx("Событие не найдено")} detail={tx("Возможно, оно было удалено или у вас нет доступа.")} action={<Link to={`${base}/events`} className={buttonClass("secondary")}>{tx("К мероприятиям")}</Link>} />;
  }
  if (event.data.status === "CANCELLED") {
    return <AccessMessage title={tx("Событие отменено")} detail={tx("Отменённые события нельзя редактировать.")} action={<Link to={`${base}/events`} className={buttonClass("secondary")}>{tx("К мероприятиям")}</Link>} />;
  }
  const existingEvent = event.data;

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">{tx("Редактирование события")}</h2>
      <p className="mb-5 text-sm text-muted">{tx("Изменения сохраняются в существующем событии.")}</p>
      <OrganizerEventForm
        event={existingEvent}
        venues={venues.data?.content ?? []}
        isPending={mutation.isPending}
        error={mutation.error}
        submitLabel={mutation.isPending ? tx("Сохраняем…") : tx("Сохранить изменения")}
        onCancel={() => navigate(`${base}/events`)}
        onSubmit={(request) => mutation.mutate(buildEventUpdate(existingEvent, request))}
      />
      <PosterManager event={existingEvent} />
    </div>
  );
}

function PosterManager({ event }: { event: Event }) {
  const { tx } = useLanguage();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const invalidateEvent = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["event", event.id] }),
      queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
      queryClient.invalidateQueries({ queryKey: ["events"] }),
    ]);
  };
  const uploadMutation = useMutation({
    mutationFn: (selectedFile: File) => uploadEventPoster(event.id, selectedFile),
    onSuccess: async () => {
      setFile(null);
      setValidationError("");
      await invalidateEvent();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteEventPoster(event.id),
    onSuccess: invalidateEvent,
  });
  const isPending = uploadMutation.isPending || deleteMutation.isPending;
  const validateFile = (selectedFile: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
      return tx("Выберите файл JPEG, PNG или WebP.");
    }
    if (selectedFile.size === 0) return tx("Файл постера пустой.");
    if (selectedFile.size > 5 * 1024 * 1024) return tx("Размер постера не должен превышать 5 МБ.");
    return "";
  };

  return (
    <section className="space-y-4 rounded-xl border p-5">
      <ConfirmDialog
        open={confirmDelete}
        title={tx("Удалить постер этого события?")}
        message={tx("Посетители увидят обложку-заглушку, пока вы не загрузите новый постер.")}
        confirmLabel={tx("Удалить постер")}
        cancelLabel={tx("Оставить постер")}
        destructive
        onConfirm={() => { deleteMutation.mutate(); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <div>
        <h3 className="font-semibold">{tx("Постер события")}</h3>
        <p className="mt-1 text-sm text-muted">{tx("JPEG, PNG или WebP, не более 5 МБ.")}</p>
      </div>
      <EventPoster
        posterUrl={event.posterUrl}
        authenticated
        className="aspect-[4/3] max-w-sm rounded-lg"
      />
      {event.status === "CANCELLED" ? (
        <p className="text-sm text-muted">{tx("Постер отменённого события нельзя изменить или удалить.")}</p>
      ) : (
        <>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{tx("Выберите изображение")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isPending}
              className={fieldClass}
              onChange={(change) => {
                const selectedFile = change.target.files?.[0] ?? null;
                setFile(selectedFile);
                setValidationError(selectedFile ? validateFile(selectedFile) : "");
                uploadMutation.reset();
              }}
            />
          </label>
          {validationError && <p role="alert" className="text-sm text-red-700">{tx(validationError)}</p>}
          {uploadMutation.error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {uploadMutation.error instanceof Error ? tx(uploadMutation.error.message) : tx("Не удалось загрузить постер.")}
            </p>
          )}
          {deleteMutation.error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {deleteMutation.error instanceof Error ? tx(deleteMutation.error.message) : tx("Не удалось удалить постер.")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!file || !!validationError || isPending}
              onClick={() => file && uploadMutation.mutate(file)}
            >
              {uploadMutation.isPending ? tx("Загружаем…") : tx("Загрузить постер")}
            </Button>
            {event.posterUrl && (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
              >
                {deleteMutation.isPending ? tx("Удаляем…") : tx("Удалить постер")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function OrganizerTicketsPage() {
  const { tx } = useLanguage();
  const { eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const base = useDashboardBase();
  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId),
    enabled: Number.isSafeInteger(eventId) && eventId > 0,
  });
  const ticketTypes = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: () => getTicketTypes(eventId),
    enabled: Number.isSafeInteger(eventId) && eventId > 0,
  });
  const mutation = useMutation({
    mutationFn: (request: CreateTicketTypeRequest) => createTicketType(eventId, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-types", eventId] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ ticketTypeId, request }: { ticketTypeId: number; request: UpdateTicketTypeRequest }) =>
      updateTicketType(ticketTypeId, request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ticket-types", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-sales-detail"] }),
      ]);
    },
  });
  const visibilityMutation = useMutation({
    mutationFn: ({ ticketTypeId, hidden }: { ticketTypeId: number; hidden: boolean }) =>
      setTicketTypeHidden(ticketTypeId, hidden),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ticket-types", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["organizer-sales-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
  });

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return <AccessMessage title={tx("Некорректный ID события")} detail={tx("Проверьте ссылку и выберите событие из списка.")} action={<Link to={`${base}/events`} className={buttonClass("secondary")}>{tx("К мероприятиям")}</Link>} />;
  }
  if (event.isLoading || ticketTypes.isLoading) {
    return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загружаем событие и билеты…")}</p>;
  }
  if (event.error || ticketTypes.error) {
    return (
      <QueryState
        loading={false}
        error={event.error ?? ticketTypes.error}
        onRetry={() => { void event.refetch(); void ticketTypes.refetch(); }}
      >
        {null}
      </QueryState>
    );
  }
  if (!event.data) {
    return <AccessMessage title={tx("Событие не найдено")} detail={tx("Возможно, оно было удалено или у вас нет доступа.")} action={<Link to={`${base}/events`} className={buttonClass("secondary")}>{tx("К мероприятиям")}</Link>} />;
  }

  const tickets = ticketTypes.data ?? [];
  const saleState = getEventTicketSaleState(tickets);
  const allocated = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  const remaining = event.data.seatingMode === "ASSIGNED" || event.data.capacity == null ? null : Math.max(event.data.capacity - allocated, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PosterManager event={event.data} />
      <Link to={`${base}/events/${eventId}/seating`} className={buttonClass("secondary")}>{tx("Настройка мест")}</Link>
      {saleState === "sold-out" && (
        <p role="status" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">
          {tx("Все доступные билеты на мероприятие распроданы.")}</p>
      )}
      {saleState === "sales-ended" && (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {tx("Срок продажи билетов завершён. Билеты, не проданные до дедлайна, больше недоступны для покупки.")}</p>
      )}
      <div>
        <p className="text-sm text-muted">{tx("Новое событие сохранено")}</p>
        <h2 className="mt-1 text-xl font-bold">{tx("Билеты: ")}{event.data.title}</h2>
        <p className="mt-2 text-sm text-muted">
          {tx("Добавляйте типы билетов, например «Стандарт» и «VIP». Количество — это доступные места этого типа, цена указывается в ₸.")}</p>
        {event.data.capacity != null && (
          <p className="mt-2 text-sm">
            {tx("Вместимость события: ")}{event.data.capacity}{tx(". Распределено по типам билетов: ")}{allocated}{tx(". Осталось распределить: ")}{remaining}.
          </p>
        )}
      </div>

      {tickets.length > 0 && (
        <section aria-label={tx("Созданные типы билетов")} className="space-y-3">
          {tickets.map((ticket) => (
            <TicketTypeCard
              key={ticket.id}
              ticket={ticket}
              assigned={event.data?.seatingMode === "ASSIGNED"}
              maxQuantity={remaining === null ? null : remaining + ticket.quantity}
              isPending={updateMutation.isPending || visibilityMutation.isPending}
              updateError={updateMutation.variables?.ticketTypeId === ticket.id ? updateMutation.error : null}
              visibilityError={visibilityMutation.variables?.ticketTypeId === ticket.id ? visibilityMutation.error : null}
              onUpdate={(request, onSuccess) => updateMutation.mutate(
                { ticketTypeId: ticket.id, request },
                { onSuccess },
              )}
              onToggleHidden={() => visibilityMutation.mutate({ ticketTypeId: ticket.id, hidden: !ticket.hidden })}
            />
          ))}
        </section>
      )}

      {event.data.status === "CANCELLED" ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{tx("Для отменённого события нельзя менять билеты.")}</p>
      ) : remaining !== 0 ? (
        <TicketTypeForm
          key={tickets.length}
          event={event.data}
          maxQuantity={remaining}
          isPending={mutation.isPending}
          error={mutation.error}
          onSubmit={(request) => mutation.mutate(request)}
        />
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {tx("Вся вместимость события уже распределена. Увеличьте вместимость в настройках события, если нужно добавить ещё билеты.")}</p>
      )}

      <Button variant="secondary" onClick={() => navigate(`${base}/events`)}>
        {tickets.length > 0 ? tx("Завершить и вернуться к событиям") : tx("Добавить билеты позже")}
      </Button>
    </div>
  );
}

function TicketTypeCard({
  assigned = false,
  ticket,
  maxQuantity,
  isPending,
  updateError,
  visibilityError,
  onUpdate,
  onToggleHidden,
}: {
  ticket: TicketType;
  assigned?: boolean;
  maxQuantity: number | null;
  isPending: boolean;
  updateError: unknown;
  visibilityError: unknown;
  onUpdate: (request: UpdateTicketTypeRequest, onSuccess: () => void) => void;
  onToggleHidden: () => void;
}) {
  const { tx, locale } = useLanguage();
  const [editing, setEditing] = useState(false);
  const saleState = getTicketSaleState(ticket);
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{ticket.name}</h3>
          {ticket.description && <p className="mt-1 text-sm text-muted">{ticket.description}</p>}
          <p className="mt-1 text-sm text-muted">
            {ticket.price === 0 ? tx("Бесплатно") : `${ticket.price} ₸`} {tx(" · Доступно: ")}{ticket.available} {tx(" из ")}{ticket.quantity} {tx(" · Продано: ")}{ticket.sold}
          </p>
          {saleState === "sold-out" && <p className="mt-1 text-sm font-semibold text-red-700">{tx("Билеты этого типа распроданы")}</p>}
          {saleState === "sales-ended" && (
            <p className="mt-1 text-sm font-semibold text-amber-800">
              {tx("Продажи завершены")}{ticket.salesEnd ? ` ${formatTicketSalesEnd(ticket.salesEnd, locale)}` : ""}
            </p>
          )}
          {saleState === "not-started" && ticket.salesStart && (
            <p className="mt-1 text-sm text-muted">{tx("Продажи начнутся ")}{formatTicketSalesEnd(ticket.salesStart, locale)}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ticket.hidden ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-800"}`}>
            {ticket.hidden ? tx("Скрыт") : tx("Активен")}
          </span>
          <Button variant="secondary" disabled={isPending} onClick={() => setEditing((current) => !current)}>
            {editing ? tx("Закрыть") : tx("Изменить")}
          </Button>
          <Button variant="secondary" disabled={isPending} onClick={onToggleHidden}>
            {ticket.hidden ? tx("Показать") : tx("Скрыть")}
          </Button>
        </div>
      </div>
      {editing && (
        <TicketTypeEditForm
          ticket={ticket}
          assigned={assigned}
          maxQuantity={maxQuantity}
          isPending={isPending}
          error={updateError}
          onSubmit={(request) => onUpdate(request, () => setEditing(false))}
        />
      )}
      {!editing && updateError != null && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {updateError instanceof Error ? tx(updateError.message) : tx("Не удалось обновить тип билета.")}
        </p>
      )}
      {visibilityError != null && <p role="alert" className="mt-3 text-sm text-red-700">{visibilityError instanceof Error ? tx(visibilityError.message) : tx("Не удалось изменить видимость билета.")}</p>}
    </article>
  );
}

function TicketTypeEditForm({
  assigned = false,
  ticket,
  maxQuantity,
  isPending,
  error,
  onSubmit,
}: {
  ticket: TicketType;
  assigned?: boolean;
  maxQuantity: number | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (request: UpdateTicketTypeRequest) => void;
}) {
  const { tx } = useLanguage();
  const [validationError, setValidationError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const priceValue = String(form.get("price") ?? "");
    const price = Number(priceValue);
    const quantity = assigned ? ticket.quantity : Number(form.get("quantity"));
    const salesStart = String(form.get("salesStart") ?? "");
    const salesEnd = String(form.get("salesEnd") ?? "");
    const maxPerOrder = Number(form.get("maxPerOrder"));
    if (!name) return setValidationError(tx("Укажите название типа билета."));
    if (!Number.isFinite(price) || price < 0 || !/^\d+(\.\d{1,2})?$/.test(priceValue)) {
      return setValidationError(tx("Цена должна быть неотрицательной и содержать не более двух знаков после запятой."));
    }
    if (!assigned && (!Number.isSafeInteger(quantity) || quantity < ticket.sold || (maxQuantity !== null && quantity > maxQuantity))) {
      return setValidationError(tx("Количество должно быть не меньше уже проданных билетов ({0}) и не больше {1}.", [ticket.sold, maxQuantity ?? tx("допустимого лимита")]));
    }
    if (!Number.isSafeInteger(maxPerOrder) || maxPerOrder <= 0 || (!assigned && maxPerOrder > quantity)) {
      return setValidationError(tx("Лимит на заказ должен быть положительным числом и не превышать количество билетов."));
    }
    if (salesStart && salesEnd && almatyTimestamp(salesStart) >= almatyTimestamp(salesEnd)) {
      return setValidationError(tx("Начало продаж должно быть раньше окончания."));
    }
    const request: UpdateTicketTypeRequest = { name, description, price, ...(!assigned ? { quantity } : {}), maxPerOrder };
    if (salesStart) request.salesStart = toApiLocalDateTime(salesStart);
    if (salesEnd) request.salesEnd = toApiLocalDateTime(salesEnd);
    onSubmit(request);
  };
  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <FormField label={tx("Название")}><input name="name" required maxLength={100} defaultValue={ticket.name} className={fieldClass} /></FormField>
      <FormField label={tx("Описание")}><textarea name="description" rows={2} defaultValue={ticket.description ?? ""} className={fieldClass} /></FormField>
      <FormField label={tx("Цена, ₸")}><input name="price" type="number" min="0" step="0.01" required defaultValue={ticket.price} className={fieldClass} /></FormField>
      {!assigned && <FormField label={tx("Количество (не меньше проданного)")}><input name="quantity" type="number" min={ticket.sold} max={maxQuantity ?? undefined} step="1" required defaultValue={ticket.quantity} className={fieldClass} /></FormField>}
      <FormField label={tx("Начало продаж")}><input name="salesStart" type="datetime-local" defaultValue={toLocalInputValue(ticket.salesStart)} className={fieldClass} /></FormField>
      <FormField label={tx("Окончание продаж")}><input name="salesEnd" type="datetime-local" defaultValue={toLocalInputValue(ticket.salesEnd)} className={fieldClass} /></FormField>
      <FormField label={tx("Максимум в одном заказе")}><input name="maxPerOrder" type="number" min="1" max={assigned ? undefined : ticket.quantity} step="1" required defaultValue={ticket.maxPerOrder ?? 10} className={fieldClass} /></FormField>
      <p className="text-xs text-muted sm:col-span-2">{tx("Пустые даты отправляются как отсутствие изменения; очистка даты зависит от поддержки backend.")}</p>
      {(validationError || error != null) && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{tx(validationError) || (error instanceof Error ? tx(error.message) : tx("Не удалось обновить тип билета."))}</p>}
      <Button type="submit" disabled={isPending} className="sm:col-span-2">{isPending ? tx("Сохраняем…") : tx("Сохранить тип билета")}</Button>
    </form>
  );
}

function TicketTypeForm({
  event,
  maxQuantity,
  isPending,
  error,
  onSubmit,
}: {
  event: Event;
  maxQuantity: number | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (request: CreateTicketTypeRequest) => void;
}) {
  const { tx } = useLanguage();
  const assigned = event.seatingMode === "ASSIGNED";
  const [validationError, setValidationError] = useState("");

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setValidationError("");
    try {
      const form = new FormData(formEvent.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const description = String(form.get("description") ?? "").trim();
      const price = Number(form.get("price"));
      const quantity = assigned ? Infinity : Number(form.get("quantity"));
      const maxPerOrderValue = String(form.get("maxPerOrder") ?? "");
      const salesStart = String(form.get("salesStart") ?? "");
      const salesEnd = String(form.get("salesEnd") ?? "");
      const eventStart = almatyTimestamp(event.startTime);

      if (!name) throw new Error(tx("Укажите название типа билета."));
      if (!Number.isFinite(price) || price < 0 || !/^\d+(\.\d{1,2})?$/.test(String(form.get("price")))) {
        throw new Error(tx("Цена должна быть неотрицательной и содержать не более двух знаков после запятой."));
      }
      if (!assigned && (!Number.isSafeInteger(quantity) || quantity <= 0)) {
        throw new Error(tx("Количество билетов должно быть целым числом больше нуля."));
      }
      if (!assigned && maxQuantity !== null && quantity > maxQuantity) {
        throw new Error(tx("Можно добавить не более {0} билетов с учётом уже распределённых мест.", [maxQuantity]));
      }
      if (maxPerOrderValue) {
        const maxPerOrder = Number(maxPerOrderValue);
        if (!Number.isSafeInteger(maxPerOrder) || maxPerOrder <= 0 || maxPerOrder > quantity) {
          throw new Error(tx("Лимит билетов в заказе должен быть положительным числом и не превышать количество билетов."));
        }
      }
      if (salesStart && almatyTimestamp(salesStart) >= eventStart) {
        throw new Error(tx("Продажи должны начаться до начала события."));
      }
      if (salesEnd && almatyTimestamp(salesEnd) > eventStart) {
        throw new Error(tx("Продажи должны закончиться не позже начала события."));
      }
      if (salesStart && salesEnd && almatyTimestamp(salesStart) >= almatyTimestamp(salesEnd)) {
        throw new Error(tx("Начало продаж должно быть раньше окончания."));
      }

      const request: CreateTicketTypeRequest = { name, price, ...(!assigned ? { quantity } : {}) };
      if (description) request.description = description;
      if (salesStart) request.salesStart = toApiLocalDateTime(salesStart);
      if (salesEnd) request.salesEnd = toApiLocalDateTime(salesEnd);
      if (maxPerOrderValue) request.maxPerOrder = Number(maxPerOrderValue);
      onSubmit(request);
    } catch (caught) {
      setValidationError(caught instanceof Error ? tx(caught.message) : tx("Проверьте данные билета."));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
      <h3 className="font-semibold">{tx("Добавить тип билета")}</h3>
      <FormField label={tx("Название")}>
        <input name="name" required maxLength={100} className={fieldClass} placeholder={tx("Например, Стандарт или VIP")} />
      </FormField>
      <FormField label={tx("Описание")}>
        <textarea name="description" rows={2} className={fieldClass} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={tx("Цена, ₸ (0 — бесплатно)")}>
          <input name="price" type="number" min="0" step="0.01" required className={fieldClass} />
        </FormField>
        {!assigned && <FormField label={tx("Количество билетов / мест")}>
          <input name="quantity" type="number" min="1" max={maxQuantity ?? undefined} step="1" required className={fieldClass} />
        </FormField>}
        <FormField label={tx("Начало продаж")}>
          <input name="salesStart" type="datetime-local" className={fieldClass} />
        </FormField>
        <FormField label={tx("Окончание продаж")}>
          <input name="salesEnd" type="datetime-local" className={fieldClass} />
        </FormField>
        <FormField label={tx("Максимум билетов в одном заказе")}>
          <input name="maxPerOrder" type="number" min="1" step="1" defaultValue="10" className={fieldClass} />
        </FormField>
      </div>
      {validationError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{tx(validationError)}</p>}
      {error !== null && error !== undefined && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error instanceof Error ? tx(error.message) : tx("Не удалось создать тип билета.")}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? tx("Добавляем…") : tx("Добавить тип билета")}
      </Button>
    </form>
  );
}

export function OrganizerEventForm({
  event,
  venues,
  isPending,
  error,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  event?: Event;
  venues: Venue[];
  isPending: boolean;
  error: unknown;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (request: CreateEventRequest) => void;
}) {
  const { tx, language, locale } = useLanguage();
  const [validationError, setValidationError] = useState("");
  const [selectedCityId, setSelectedCityId] = useState(() => event?.venue ? venueCity(event.venue) ?? "unknown" : "");
  const [selectedVenueId, setSelectedVenueId] = useState(event?.venue?.id ? String(event.venue.id) : "");
  const [capacityValue, setCapacityValue] = useState(event?.capacity == null ? "" : String(event.capacity));
  const [newlyCreatedVenue, setNewlyCreatedVenue] = useState<Venue | null>(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const layouts = useQuery({ queryKey: ["seating-layouts"], queryFn: getSeatingLayouts });
  const [venueLayout, setVenueLayout] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueCityId, setVenueCityId] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCapacity, setVenueCapacity] = useState("");
  const [venueFormError, setVenueFormError] = useState("");
  const queryClient = useQueryClient();
  const venueMutation = useMutation({
    mutationFn: createVenue,
    onSuccess: async (createdVenue) => {
      setSelectedCityId(venueCity(createdVenue) ?? "");
      setSelectedVenueId(String(createdVenue.id));
      setNewlyCreatedVenue(createdVenue);
      setVenueName("");
      setVenueCityId("");
      setVenueAddress("");
      setVenueCapacity("");
      setVenueLayout("");
      setShowVenueForm(false);
      await queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
  });

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setValidationError("");
    try {
      validateEventVenue(selectedCityId, selectedVenue, event?.venue?.id);
      onSubmit(readEventForm(
        new FormData(formEvent.currentTarget),
        event?.startTime,
        selectedVenue,
        event?.capacity,
      ));
    } catch (caught) {
      setValidationError(caught instanceof Error ? tx(caught.message) : tx("Проверьте введённые данные."));
    }
  };
  const allVenues = [...new Map([
    ...venues,
    ...(event?.venue ? [event.venue] : []),
    ...(newlyCreatedVenue ? [newlyCreatedVenue] : []),
  ].map(venue => [venue.id, venue])).values()];
  const cityVenues = venuesInCity(allVenues, selectedCityId).filter(venue => selectedCityId !== "unknown" || venue.id === event?.venue?.id);
  const selectedVenueIdNumber = Number(selectedVenueId);
  const selectedVenue = cityVenues.find(venue => venue.id === selectedVenueIdNumber);
  const addVenue = () => {
    try {
      const request = prepareVenueRequest({ name: venueName, cityId: venueCityId, address: venueAddress, capacity: venueCapacity, seatingLayout: venueLayout });
      setVenueFormError("");
      venueMutation.mutate(request);
    } catch (error) {
      venueMutation.reset();
      setVenueFormError(error instanceof Error ? error.message : "Проверьте введённые данные.");
    }
  };

  return (
    <form
      onSubmit={submit}
      onReset={() => {
        setValidationError("");
        setSelectedCityId("");
        setSelectedVenueId("");
        setCapacityValue("");
        setNewlyCreatedVenue(null);
        setShowVenueForm(false);
        setVenueName("");
        setVenueCityId("");
        setVenueAddress("");
        setVenueCapacity("");
        setVenueFormError("");
        venueMutation.reset();
      }}
      className="space-y-4 rounded-xl border p-5"
    >
      <FormField label={tx("Название")}>
        <input name="title" required maxLength={200} defaultValue={event?.title ?? ""} className={fieldClass} />
      </FormField>
      <FormField label={tx("Категория")}>
        <select name="category" required defaultValue={event?.category ?? ""} className={fieldClass}>
          <option value="" disabled>{tx("Выберите категорию")}</option>
          {eventCategoryOptions(event?.category).map(option => (
            <option key={option.value} value={option.value}>
              {option.legacy ? `${categoryLabel(option.value, locale)} · ${tx("текущее значение")}` : categoryLabel(option.value, locale)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={tx("Описание")}>
        <textarea name="description" rows={4} defaultValue={event?.description ?? ""} className={fieldClass} />
      </FormField>
      <FormField label={tx("Политика возврата")}>
        <textarea
          name="refundPolicy"
          rows={3}
          maxLength={2000}
          defaultValue={event?.refundPolicy ?? ""}
          className={fieldClass}
          placeholder={tx("Например: полный возврат до 48 часов до начала события")}
        />
      </FormField>
      <FormField label={tx("Город события")}>
        <select
          name="eventCity"
          required
          value={selectedCityId}
          disabled={event?.seatingMode === "ASSIGNED" || isPending || venueMutation.isPending}
          onChange={change => {
            setSelectedCityId(change.target.value);
            setSelectedVenueId("");
            if (showVenueForm) setVenueCityId(cities.some(city => city.id === change.target.value) ? change.target.value : "");
            setValidationError("");
          }}
          className={fieldClass}
        >
          <option value="" disabled>{tx("Выберите город")}</option>
          {cities.map(city => <option key={city.id} value={city.id}>{city[language]}</option>)}
          {event?.venue && venueCity(event.venue) === null && <option value="unknown">{tx("Город не указан")}</option>}
        </select>
      </FormField>
      {event?.seatingMode === "ASSIGNED" && <input type="hidden" name="venueId" value={selectedVenueId} />}
      <FormField label={tx("Площадка")}>
        <select
          name="venueId"
          required
          value={selectedVenueId}
          disabled={event?.seatingMode === "ASSIGNED" || !selectedCityId || isPending || venueMutation.isPending}
          onChange={(change) => setSelectedVenueId(change.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>{selectedCityId ? tx("Выберите площадку") : tx("Сначала выберите город")}</option>
          {cityVenues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} — {venue.address}
              {venue.capacity != null ? tx(" · до {0} человек", [venue.capacity]) : tx(" · без лимита")}
            </option>
          ))}
        </select>
        {selectedCityId && cityVenues.length === 0 && <p className="text-sm text-muted">{tx("В этом городе пока нет площадок. Добавьте новую площадку ниже.")}</p>}
        {selectedCityId === "unknown" && <p className="text-sm text-muted">{tx("У текущей площадки не указан город. Чтобы изменить место проведения, выберите город и другую площадку.")}</p>}
      </FormField>
      <div className="rounded-lg bg-surface p-4">
        <Button
          type="button"
          variant="secondary"
          title={tx("Добавить площадку")}
          aria-label={tx("Добавить площадку")}
          aria-expanded={showVenueForm}
          disabled={event?.seatingMode === "ASSIGNED" || isPending || venueMutation.isPending}
          onClick={() => {
            if (!showVenueForm) setVenueCityId(cities.some(city => city.id === selectedCityId) ? selectedCityId : "");
            setShowVenueForm((shown) => !shown);
            setVenueFormError("");
            venueMutation.reset();
          }}
        >
          {showVenueForm ? tx("Закрыть") : tx("Добавить")}
        </Button>
        {showVenueForm && (
          <fieldset disabled={venueMutation.isPending} className="mt-4 space-y-3">
            <legend className="font-semibold">{tx("Новая площадка")}</legend>
            <FormField label={tx("Город площадки")}>
              <select value={venueCityId} onChange={change => setVenueCityId(change.target.value)} className={fieldClass} autoComplete="address-level2">
                <option value="" disabled>{tx("Выберите город площадки")}</option>
                {cities.map(city => <option key={city.id} value={city.id}>{city[language]}</option>)}
              </select>
            </FormField>
            <FormField label={tx("Название площадки")}>
              <input
                value={venueName}
                onChange={(change) => setVenueName(change.target.value)}
                maxLength={200}
                className={fieldClass}
                autoComplete="organization"
              />
            </FormField>
            <FormField label={tx("Адрес площадки: улица и дом")}>
              <input
                value={venueAddress}
                onChange={(change) => setVenueAddress(change.target.value)}
                maxLength={300}
                className={fieldClass}
                autoComplete="street-address"
              />
            </FormField>
            <FormField label={tx("Схема зала")}><select value={venueLayout} onChange={e => setVenueLayout(e.target.value)} className={fieldClass}><option value="">{tx("Без схемы")}</option>{layouts.data?.map(layout => <option key={layout.key} value={layout.key}>{layout.name} · {layout.capacity}</option>)}</select>{layouts.error && <p role="alert">{tx("Не удалось загрузить схемы площадок")}</p>}</FormField>
            <FormField label={tx("Максимальная вместимость, человек")}>
              <input
                type="number"
                min="1"
                step="1"
                disabled={!!venueLayout}
                value={venueLayout ? layouts.data?.find(l => l.key === venueLayout)?.capacity ?? "" : venueCapacity}
                onChange={(change) => setVenueCapacity(change.target.value)}
                className={fieldClass}
              />
            </FormField>
            {venueFormError && <p role="alert" className="text-sm text-red-700">{tx(venueFormError)}</p>}
            {venueMutation.error && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {venueMutation.error instanceof Error ? tx(venueMutation.error.message) : tx("Не удалось добавить площадку.")}
              </p>
            )}
            <Button type="button" disabled={venueMutation.isPending} onClick={addVenue}>
              {venueMutation.isPending ? tx("Добавляем…") : tx("Добавить площадку")}
            </Button>
          </fieldset>
        )}
        {venues.length === 0 && (
          <p className="mt-3 text-sm text-muted">{tx("Создайте площадку, чтобы продолжить создание события.")}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={tx("Начало")}>
          <input name="startTime" type="datetime-local" required defaultValue={toLocalInputValue(event?.startTime)} className={fieldClass} />
        </FormField>
        <FormField label={tx("Окончание")}>
          <input name="endTime" type="datetime-local" defaultValue={toLocalInputValue(event?.endTime)} className={fieldClass} />
        </FormField>
        <FormField label={tx("Начало регистрации")}>
          <input name="registrationOpeningTime" type="datetime-local" defaultValue={toLocalInputValue(event?.registrationOpeningTime)} className={fieldClass} />
        </FormField>
        <FormField label={tx("Окончание регистрации")}>
          <input name="registrationClosingTime" type="datetime-local" defaultValue={toLocalInputValue(event?.registrationClosingTime)} className={fieldClass} />
        </FormField>
        <FormField label={tx("Вместимость")}>
          <input
            disabled={event?.seatingMode === "ASSIGNED"}
            name="capacity"
            type="number"
            min="1"
            max={selectedVenue?.capacity ?? undefined}
            step="1"
            value={capacityValue}
            onChange={(change) => setCapacityValue(change.target.value)}
            className={fieldClass}
          />
          {selectedVenue && (
            <p className="text-xs text-muted">
              {selectedVenue.capacity == null
                ? tx("У площадки нет заданного ограничения вместимости.")
                : tx("Максимум площадки: {0} человек. {1}", [selectedVenue.capacity, capacityValue || event?.capacity != null
                      ? tx("Вместимость события: {0}.", [capacityValue || event?.capacity])
                      : tx("Если оставить пустым, вместимость события будет {0}.", [selectedVenue.capacity])])}
            </p>
          )}
        </FormField>
        <FormField label={tx("Видимость")}>
          <select name="visibilityStatus" defaultValue={event?.visibilityStatus ?? "PUBLIC"} className={fieldClass}>
            <option value="PUBLIC">{tx("Публичное")}</option>
            <option value="UNLISTED">{tx("По ссылке")}</option>
            <option value="PRIVATE">{tx("Приватное")}</option>
          </select>
        </FormField>
      </div>
      {event && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {tx("Backend пока не очищает необязательные дату окончания, даты регистрации и вместимость: если очистить эти поля, прежние значения сохранятся.")}</p>
      )}
      {validationError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{tx(validationError)}</p>}
      {error !== null && error !== undefined && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error instanceof Error ? tx(error.message) : tx("Не удалось сохранить событие.")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending || venueMutation.isPending || !selectedVenue || !selectedCityId}>
          {submitLabel}
        </Button>
        {!event && (
          <Button type="reset" variant="secondary" disabled={isPending || venueMutation.isPending}>
            {tx("Очистить")}</Button>
        )}
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{tx("Отмена")}</Button>}
      </div>
    </form>
  );
}

// Exported for tests.
export function readEventForm(
  form: FormData,
  existingStartTime?: string,
  selectedVenue?: Venue,
  existingCapacity?: number,
): CreateEventRequest {
  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const startTime = String(form.get("startTime") ?? "");
  const venueId = Number(form.get("venueId"));
  const visibilityStatus = String(form.get("visibilityStatus") ?? "");
  if (!title || !category || !startTime || !Number.isSafeInteger(venueId) || venueId <= 0) {
    throw new Error("Заполните название, категорию, начало и выберите площадку.");
  }
  if (!isVisibility(visibilityStatus)) {
    throw new Error("Выберите допустимую видимость события.");
  }
  const startTimestamp = almatyTimestamp(startTime);
  if (!Number.isFinite(startTimestamp)) {
    throw new Error("Укажите корректные дату и время начала.");
  }
  const startTimeUnchanged = existingStartTime !== undefined &&
    startTime === toLocalInputValue(existingStartTime);
  if (!startTimeUnchanged && startTimestamp <= Date.now()) {
    throw new Error("Дата и время начала должны быть в будущем.");
  }

  const endTime = String(form.get("endTime") ?? "");
  const registrationOpeningTime = String(form.get("registrationOpeningTime") ?? "");
  const registrationClosingTime = String(form.get("registrationClosingTime") ?? "");
  const capacityValue = String(form.get("capacity") ?? "");
  if (endTime && almatyTimestamp(endTime) <= almatyTimestamp(startTime)) {
    throw new Error("Время окончания должно быть позже начала события.");
  }
  if (registrationOpeningTime && registrationClosingTime &&
      almatyTimestamp(registrationOpeningTime) >= almatyTimestamp(registrationClosingTime)) {
    throw new Error("Регистрация должна открываться раньше закрытия.");
  }
  if (registrationClosingTime && almatyTimestamp(registrationClosingTime) > almatyTimestamp(startTime)) {
    throw new Error("Регистрация должна закрыться до начала события.");
  }

  const request: CreateEventRequest = {
    title,
    description: String(form.get("description") ?? "").trim(),
    refundPolicy: String(form.get("refundPolicy") ?? "").trim(),
    category,
    startTime: toApiLocalDateTime(startTime),
    venueId,
    visibilityStatus,
  };
  if (endTime) request.endTime = toApiLocalDateTime(endTime);
  if (registrationOpeningTime) request.registrationOpeningTime = toApiLocalDateTime(registrationOpeningTime);
  if (registrationClosingTime) request.registrationClosingTime = toApiLocalDateTime(registrationClosingTime);
  if (capacityValue) {
    const capacity = Number(capacityValue);
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new Error("Вместимость должна быть целым числом больше нуля.");
    }
    if (selectedVenue?.capacity != null && capacity > selectedVenue.capacity) {
      throw new Error(`Вместимость события не может превышать вместимость площадки (${selectedVenue.capacity}).`);
    }
    request.capacity = capacity;
  } else {
    const effectiveCapacity = existingCapacity ?? selectedVenue?.capacity;
    if (selectedVenue?.capacity != null && effectiveCapacity != null && effectiveCapacity > selectedVenue.capacity) {
      throw new Error(`Вместимость события (${effectiveCapacity}) превышает вместимость площадки (${selectedVenue.capacity}).`);
    }
    if (existingStartTime && existingCapacity == null && selectedVenue?.capacity != null) {
      request.capacity = selectedVenue.capacity;
    }
  }
  return request;
}

function buildEventUpdate(current: Event, form: CreateEventRequest) {
  const update: UpdateEventRequest = {};
  if (form.title !== current.title) update.title = form.title;
  if (form.description !== (current.description ?? "")) update.description = form.description;
  if (form.refundPolicy !== (current.refundPolicy ?? "")) update.refundPolicy = form.refundPolicy;
  if (form.category !== current.category) update.category = form.category;
  if (form.startTime !== toApiLocalDateTime(toLocalInputValue(current.startTime))) update.startTime = form.startTime;
  if (form.endTime !== undefined && form.endTime !== toApiLocalDateTime(toLocalInputValue(current.endTime))) update.endTime = form.endTime;
  if (form.registrationOpeningTime !== undefined &&
      form.registrationOpeningTime !== toApiLocalDateTime(toLocalInputValue(current.registrationOpeningTime))) {
    update.registrationOpeningTime = form.registrationOpeningTime;
  }
  if (form.registrationClosingTime !== undefined &&
      form.registrationClosingTime !== toApiLocalDateTime(toLocalInputValue(current.registrationClosingTime))) {
    update.registrationClosingTime = form.registrationClosingTime;
  }
  if (form.capacity !== current.capacity) update.capacity = form.capacity;
  if (form.visibilityStatus !== current.visibilityStatus) update.visibilityStatus = form.visibilityStatus;
  if (form.venueId !== current.venue?.id) update.venueId = form.venueId;
  return update;
}

const PHASE_LABELS: Record<EventPhase, string> = {
  UPCOMING: "Предстоящее",
  ACTIVE: "Идёт сейчас",
  COMPLETED: "Завершено",
  CANCELLED: "Отменено",
};

const PHASE_TABS: { value: EventPhase | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "UPCOMING", label: "Предстоящие" },
  { value: "ACTIVE", label: "Идут сейчас" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "CANCELLED", label: "Отменённые" },
];

export function ManageOrganizerEventsPage() {
  const { tx, locale } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const base = useDashboardBase();
  const [page, setPage] = useState(0);
  // "" = all events; otherwise only the events in that phase (SRS 4.16)
  const [phase, setPhase] = useState<EventPhase | "">("");
  const { profile, events, platformAdmin } = useOrganizerEvents(page, phase || undefined);
  const [actionError, setActionError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<{ id: number; title: string } | null>(null);
  const duplication = useMutation({
    mutationFn: (eventId: number) => duplicateEvent(eventId),
    onSuccess: async (copy) => {
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["organizer-events"] });
      // The copy is a draft: open it so the organizer can change the date and add tickets
      navigate(`${base}/events/${copy.id}/edit`);
    },
    onError: (error) => setActionError(error instanceof Error ? tx(error.message) : tx("Не удалось скопировать событие.")),
  });
  const [suspensionTarget, setSuspensionTarget] = useState<Event | null>(null);
  const [eventPendingPublish, setEventPendingPublish] = useState<Event | null>(null);
  const [checkingTicketsForEvent, setCheckingTicketsForEvent] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: ({ eventId, action }: { eventId: number; action: EventManagementAction }) => manageEvent(eventId, action),
    onSuccess: async () => {
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
    onError: (error) => setActionError(error instanceof Error ? tx(error.message) : tx("Не удалось изменить событие.")),
  });
  const suspension = useMutation({
    mutationFn: ({ eventId, suspended, reason }: { eventId: number; suspended: boolean; reason?: string }) =>
      setEventSuspended(eventId, suspended, reason),
    onSuccess: async () => {
      setSuspensionTarget(null);
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["event"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-events"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-sales-events"] }),
      ]);
    },
    onError: (error) => setActionError(error instanceof Error ? tx(error.message) : tx("Не удалось изменить статус модерации.")),
  });
  const retry = () => {
    if (!platformAdmin) void profile.refetch();
    void events.refetch();
  };

  const requestPublish = async (event: Event) => {
    setActionError("");
    setCheckingTicketsForEvent(event.id);
    try {
      const tickets = await getTicketTypes(event.id);
      const hasPurchasableTickets = tickets.some((ticket) => !ticket.hidden && ticket.available > 0);
      if (!hasPurchasableTickets) {
        setEventPendingPublish(event);
        return;
      }
      mutation.mutate({ eventId: event.id, action: "publish" });
    } catch (error) {
      setActionError(error instanceof Error ? tx(error.message) : tx("Не удалось проверить билеты события."));
    } finally {
      setCheckingTicketsForEvent(null);
    }
  };

  return (
    <QueryState loading={(!platformAdmin && profile.isLoading) || events.isLoading} error={(platformAdmin ? null : profile.error) ?? events.error} onRetry={retry}>
      <ConfirmDialog
        open={cancelTarget !== null}
        title={tx("Отменить событие «{0}»?", [cancelTarget?.title ?? ""])}
        message={tx("Посетители увидят, что событие отменено. Отмену нельзя вернуть.")}
        confirmLabel={tx("Отменить событие")}
        cancelLabel={tx("Не отменять")}
        destructive
        onConfirm={() => { if (cancelTarget) mutation.mutate({ eventId: cancelTarget.id, action: "cancel" }); setCancelTarget(null); }}
        onCancel={() => setCancelTarget(null)}
      />
      {suspensionTarget && <EventSuspensionDialog
        key={suspensionTarget.id}
        event={suspensionTarget}
        pending={suspension.isPending}
        error={suspension.error}
        onClose={() => { setSuspensionTarget(null); suspension.reset(); }}
        onConfirm={reason => suspension.mutate({ eventId: suspensionTarget.id, suspended: true, reason })}
      />}
      <Modal
        open={eventPendingPublish !== null}
        onClose={() => setEventPendingPublish(null)}
        title={tx("У события нет доступных билетов")}
      >
        <p className="mt-3 text-sm text-muted">
          {eventPendingPublish?.title ? tx("«{0}» будет опубликовано", [eventPendingPublish.title]) : tx("Событие будет опубликовано")} {tx(" без доступных билетов. Посетители увидят событие, но пока не смогут купить билеты.")}</p>
        <div className="mt-5 flex flex-col gap-3">
          {eventPendingPublish && (
            <Button onClick={() => {
              const eventId = eventPendingPublish.id;
              setEventPendingPublish(null);
              navigate(`${base}/events/${eventId}/tickets`);
            }}>
              {tx("Сначала добавить билеты")}</Button>
          )}
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              if (!eventPendingPublish) return;
              mutation.mutate({ eventId: eventPendingPublish.id, action: "publish" });
              setEventPendingPublish(null);
            }}
          >
            {tx("Всё равно опубликовать")}</Button>
          <button
            type="button"
            className="py-2 text-sm text-muted hover:text-black"
            onClick={() => setEventPendingPublish(null)}
          >
            {tx("Отмена")}</button>
        </div>
      </Modal>
      <h2 className="mb-2 text-lg font-bold">{tx("Управление мероприятиями")}</h2>
      <p className="mb-5 text-sm text-muted">{platformAdmin ? tx("Управляйте статусами мероприятий всех организаторов.") : tx("Публикуйте, снимайте с публикации или отменяйте свои события.")}</p>
      {!platformAdmin && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={tx("Фильтр по этапу")}>
          {PHASE_TABS.map((tab) => (
            <Button
              key={tab.value || "ALL"}
              role="tab"
              aria-selected={phase === tab.value}
              variant={phase === tab.value ? "primary" : "secondary"}
              onClick={() => { setPhase(tab.value); setPage(0); }}
            >
              {tx(tab.label)}
            </Button>
          ))}
        </div>
      )}
      {actionError && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{tx(actionError)}</p>}
      {(events.data?.content ?? []).length === 0 ? (
        <OrganizerEventsList events={[]} emptyMessage={tx("Нет событий для управления.")} />
      ) : (
        <div className="space-y-3">
          {(events.data?.content ?? []).map((event) => (
            <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm text-muted">{formatDate(event.startTime, locale)} · ID: {event.id}</p>
                {event.suspensionReason && <p className="mt-1 text-sm text-red-700">{tx("Причина: ")}{event.suspensionReason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                {event.phase && event.phase !== "CANCELLED" && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{tx(PHASE_LABELS[event.phase])}</span>
                )}
                <Link to={`${base}/events/${event.id}/history`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">
                  {tx("История")}</Link>
                {!platformAdmin && !event.suspended && (
                  <Button
                    variant="secondary"
                    disabled={duplication.isPending}
                    title={tx("Новый черновик с теми же данными, без заказов и билетов")}
                    onClick={() => duplication.mutate(event.id)}
                  >
                    {duplication.isPending && duplication.variables === event.id ? tx("Копируем…") : tx("Дублировать")}
                  </Button>
                )}
                {platformAdmin && event.suspended && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">{tx("Приостановлено")}</span>}
                {!platformAdmin && <Link to={`${base}/events/${event.id}/tickets`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">
                  {tx("Билеты")}</Link>}
                {!platformAdmin && event.status !== "CANCELLED" && (
                  <Link to={`${base}/events/${event.id}/edit`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">
                    {tx("Изменить")}</Link>
                )}
                {platformAdmin && (event.suspended ? (
                  <Button
                    variant="secondary"
                    disabled={suspension.isPending}
                    onClick={() => suspension.mutate({ eventId: event.id, suspended: false })}
                  >
                    {suspension.isPending && suspension.variables?.eventId === event.id ? tx("Возобновляем…") : tx("Возобновить")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={suspension.isPending || event.status === "CANCELLED"}
                    title={event.status === "CANCELLED" ? tx("Отменённое событие нельзя приостановить") : undefined}
                    onClick={() => { setActionError(""); suspension.reset(); setSuspensionTarget(event); }}
                  >
                    {tx("Приостановить")}</Button>
                ))}
                {!platformAdmin && event.status === "DRAFT" && <Link to={`/events/${event.id}?preview=1`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">{tx("Предпросмотр")}</Link>}
                {!platformAdmin && event.status === "DRAFT" && (
                  <Button
                    disabled={mutation.isPending || checkingTicketsForEvent !== null}
                    onClick={() => void requestPublish(event)}
                  >
                    {checkingTicketsForEvent === event.id ? tx("Проверяем билеты…") : tx("Опубликовать")}
                  </Button>
                )}
                {!platformAdmin && event.status === "PUBLISHED" && (
                  <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ eventId: event.id, action: "unpublish" })}>{tx("Снять")}</Button>
                )}
                {!platformAdmin && event.status !== "CANCELLED" && (
                  <Button variant="secondary" disabled={mutation.isPending} onClick={() => setCancelTarget({ id: event.id, title: event.title })}>{tx("Отменить")}</Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <EventListPagination page={page} totalPages={events.data?.totalPages ?? 0} onChange={setPage} />
    </QueryState>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  const { tx } = useLanguage();
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{tx(label)}</span>
      {children}
    </label>
  );
}

const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

function formatDate(value: string, locale = "ru-RU") {
  return formatDateTime(value, locale);
}

function toLocalInputValue(value?: string) {
  return value ? value.slice(0, 16) : "";
}

function toApiLocalDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

function isVisibility(value: string): value is Visibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE";
}
