import { useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  getOrganizerEvents,
  getOrganizerProfile,
  getVenues,
  manageEvent,
  type EventManagementAction,
} from "../api/events";
import type { CreateEventRequest, Event, EventStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";

const isOrganizer = (role: string) => role.trim().toUpperCase().replace(/^ROLE_/, "") === "ORGANIZER";

function StatusBadge({ status }: { status?: EventStatus }) {
  const styles: Record<EventStatus, string> = {
    DRAFT: "bg-amber-100 text-amber-800",
    PUBLISHED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  const labels: Record<EventStatus, string> = {
    DRAFT: "Черновик",
    PUBLISHED: "Опубликовано",
    CANCELLED: "Отменено",
  };
  const value = status ?? "DRAFT";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[value]}`}>{labels[value]}</span>;
}

function OrganizerEventsList({ events, emptyMessage }: { events: Event[]; emptyMessage: string }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-8 text-center">
        <p className="text-sm text-muted">{emptyMessage}</p>
        <Link to="/organizer/create" className={`${buttonClass()} mt-4`}>Создать событие</Link>
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
              {event.venue?.name ?? "Площадка не указана"} · {formatDate(event.startTime)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={event.status} />
            <Link to="/organizer/manage" className="text-sm font-semibold underline">Управлять</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function useOrganizerEvents() {
  const profile = useQuery({
    queryKey: ["organizer-profile"],
    queryFn: getOrganizerProfile,
  });
  const events = useQuery({
    queryKey: ["organizer-events", profile.data?.id],
    queryFn: () => getOrganizerEvents(profile.data!.id),
    enabled: !!profile.data,
  });
  return { profile, events };
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
  if (loading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загрузка…</p>;
  if (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить данные.";
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-800">
        <p>{message}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>Повторить</Button>
      </div>
    );
  }
  return children;
}

export function OrganizerGuard() {
  const { user, isLoggedIn, isUserLoading, userError, refetchUser, openLogin } = useAuth();

  if (!isLoggedIn) {
    return (
      <AccessMessage
        title="Войдите в аккаунт"
        detail="Для доступа к кабинету организатора нужно авторизоваться."
        action={<Button onClick={openLogin}>Войти</Button>}
      />
    );
  }
  if (isUserLoading || !user && !userError) {
    return <p className="rounded-xl bg-surface p-6 text-center text-sm">Проверяем аккаунт…</p>;
  }
  if (userError) {
    return (
      <AccessMessage
        title="Не удалось проверить аккаунт"
        detail={userError instanceof Error ? userError.message : "Попробуйте ещё раз."}
        action={<Button variant="secondary" onClick={refetchUser}>Повторить</Button>}
      />
    );
  }
  if (!user || !isOrganizer(user.role)) {
    return (
      <AccessMessage
        title="Доступ только для организаторов"
        detail={`Текущая роль: ${user?.role ?? "не определена"}. Попросите администратора назначить роль ORGANIZER.`}
        action={<Link to="/" className={buttonClass("secondary")}>На главную</Link>}
      />
    );
  }
  return <Outlet />;
}

function AccessMessage({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border p-8 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      <div className="mt-5">{action}</div>
    </section>
  );
}

export function OrganizerDashboardLayout() {
  const tabs = [
    { to: "/organizer/events", label: "My Events" },
    { to: "/organizer/create", label: "Create Event" },
    { to: "/organizer/manage", label: "Event Management" },
  ];

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm text-muted">Кабинет организатора</p>
        <h1 className="mt-1 text-2xl font-bold">Управление событиями</h1>
      </div>
      <nav aria-label="Разделы кабинета организатора" className="mb-6 flex gap-2 overflow-x-auto border-b pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${isActive ? "bg-black text-white" : "bg-surface hover:bg-gray-200"}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}

export function MyOrganizerEventsPage() {
  const { profile, events } = useOrganizerEvents();
  const retry = () => {
    void profile.refetch();
    void events.refetch();
  };
  return (
    <QueryState loading={profile.isLoading || events.isLoading} error={profile.error ?? events.error} onRetry={retry}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">My Events</h2>
          <p className="text-sm text-muted">Все события, созданные вашим аккаунтом организатора.</p>
        </div>
        <Link to="/organizer/create" className={buttonClass()}>Создать событие</Link>
      </div>
      <OrganizerEventsList events={events.data?.content ?? []} emptyMessage="У вас пока нет событий." />
    </QueryState>
  );
}

export function CreateOrganizerEventPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["organizer-profile"], queryFn: getOrganizerProfile });
  const venues = useQuery({ queryKey: ["venues"], queryFn: () => getVenues() });
  const [formError, setFormError] = useState("");
  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
      navigate("/organizer/events");
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Не удалось создать событие."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const startTime = String(form.get("startTime") ?? "");
    const endTime = String(form.get("endTime") ?? "");
    const openingTime = String(form.get("registrationOpeningTime") ?? "");
    const closingTime = String(form.get("registrationClosingTime") ?? "");
    const capacityValue = String(form.get("capacity") ?? "");
    const request: CreateEventRequest = {
      title: String(form.get("title") ?? "").trim(),
      category: String(form.get("category") ?? "").trim(),
      startTime: new Date(startTime).toISOString(),
      venueId: Number(form.get("venueId")),
      visibilityStatus: String(form.get("visibilityStatus") ?? "PUBLIC") as CreateEventRequest["visibilityStatus"],
    };
    const description = String(form.get("description") ?? "").trim();
    if (description) request.description = description;
    if (endTime) request.endTime = new Date(endTime).toISOString();
    if (openingTime) request.registrationOpeningTime = new Date(openingTime).toISOString();
    if (closingTime) request.registrationClosingTime = new Date(closingTime).toISOString();
    if (capacityValue) request.capacity = Number(capacityValue);
    mutation.mutate(request);
  };

  if (profile.isLoading || venues.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загрузка…</p>;
  if (profile.error || venues.error) {
    return (
      <QueryState
        loading={false}
        error={profile.error ?? venues.error}
        onRetry={() => { void profile.refetch(); void venues.refetch(); }}
      >
        {null}
      </QueryState>
    );
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">Create Event</h2>
      <p className="mb-5 text-sm text-muted">После создания событие появится в списке как черновик.</p>
      {venues.data?.content.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">
          Для создания события сначала добавьте площадку через POST /api/venues или попросите администратора добавить её.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
          <FormField label="Название">
            <input name="title" required maxLength={200} className={fieldClass} />
          </FormField>
          <FormField label="Категория">
            <input name="category" required className={fieldClass} placeholder="Например, Концерт" />
          </FormField>
          <FormField label="Описание">
            <textarea name="description" rows={4} className={fieldClass} />
          </FormField>
          <FormField label="Площадка">
            <select name="venueId" required defaultValue="" className={fieldClass}>
              <option value="" disabled>Выберите площадку</option>
              {(venues.data?.content ?? []).map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name} — {venue.address}</option>
              ))}
            </select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Начало">
              <input name="startTime" type="datetime-local" required className={fieldClass} />
            </FormField>
            <FormField label="Окончание">
              <input name="endTime" type="datetime-local" className={fieldClass} />
            </FormField>
            <FormField label="Начало регистрации">
              <input name="registrationOpeningTime" type="datetime-local" className={fieldClass} />
            </FormField>
            <FormField label="Окончание регистрации">
              <input name="registrationClosingTime" type="datetime-local" className={fieldClass} />
            </FormField>
            <FormField label="Вместимость">
              <input name="capacity" type="number" min="0" step="1" className={fieldClass} />
            </FormField>
            <FormField label="Видимость">
              <select name="visibilityStatus" defaultValue="PUBLIC" className={fieldClass}>
                <option value="PUBLIC">Публичное</option>
                <option value="UNLISTED">По ссылке</option>
                <option value="PRIVATE">Приватное</option>
              </select>
            </FormField>
          </div>
          {formError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <Button type="submit" disabled={mutation.isPending || venues.data?.content.length === 0}>
            {mutation.isPending ? "Создаём…" : "Создать событие"}
          </Button>
        </form>
      )}
      {formError && venues.data?.content.length === 0 && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</p>
      )}
    </div>
  );
}

export function ManageOrganizerEventsPage() {
  const queryClient = useQueryClient();
  const { profile, events } = useOrganizerEvents();
  const [actionError, setActionError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ eventId, action }: { eventId: number; action: EventManagementAction }) => manageEvent(eventId, action),
    onSuccess: async () => {
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizer-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Не удалось изменить событие."),
  });
  const retry = () => {
    void profile.refetch();
    void events.refetch();
  };

  return (
    <QueryState loading={profile.isLoading || events.isLoading} error={profile.error ?? events.error} onRetry={retry}>
      <h2 className="mb-2 text-lg font-bold">Event Management</h2>
      <p className="mb-5 text-sm text-muted">Публикуйте, снимайте с публикации или отменяйте свои события.</p>
      {actionError && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {(events.data?.content ?? []).length === 0 ? (
        <OrganizerEventsList events={[]} emptyMessage="Нет событий для управления." />
      ) : (
        <div className="space-y-3">
          {(events.data?.content ?? []).map((event) => (
            <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm text-muted">{formatDate(event.startTime)} · ID: {event.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                {event.status === "DRAFT" && (
                  <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ eventId: event.id, action: "publish" })}>Опубликовать</Button>
                )}
                {event.status === "PUBLISHED" && (
                  <Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ eventId: event.id, action: "unpublish" })}>Снять</Button>
                )}
                {event.status !== "CANCELLED" && (
                  <Button variant="secondary" disabled={mutation.isPending} onClick={() => {
                    if (window.confirm(`Отменить событие «${event.title}»?`)) {
                      mutation.mutate({ eventId: event.id, action: "cancel" });
                    }
                  }}>Отменить</Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </QueryState>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

const fieldClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
