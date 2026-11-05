import { useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  createTicketType,
  createVenue,
  deleteEventPoster,
  getEvent,
  getOrganizerEvents,
  getOrganizerProfile,
  getTicketTypes,
  getVenues,
  manageEvent,
  updateEvent,
  uploadEventPoster,
  type EventManagementAction,
} from "../api/events";
import type {
  CreateEventRequest,
  CreateTicketTypeRequest,
  Event,
  EventStatus,
  TicketType,
  UpdateEventRequest,
  Venue,
  Visibility,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EventPoster } from "../components/events/EventPoster";

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
            <Link to={`/organizer/events/${event.id}/tickets`} className="text-sm font-semibold underline">
              Билеты
            </Link>
            <Link to={`/organizer/events/${event.id}/staff`} className="text-sm font-semibold underline">
              Сотрудники
            </Link>
            {event.status !== "CANCELLED" && (
              <Link to={`/organizer/events/${event.id}/edit`} className="text-sm font-semibold underline">
                Изменить
              </Link>
            )}
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
    queryKey: ["organizer-events", profile.data?.userId],
    queryFn: () => getOrganizerEvents(profile.data!.userId),
    enabled: !!profile.data?.userId,
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
    { to: "/organizer/sales", label: "Продажи" },
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

  if (venues.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загрузка площадок…</p>;
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
      <h2 className="text-lg font-bold">Create Event</h2>
      <p className="mb-5 text-sm text-muted">После создания событие появится в списке как черновик.</p>
      <OrganizerEventForm
        venues={venues.data?.content ?? []}
        isPending={mutation.isPending}
        error={mutation.error}
        submitLabel={mutation.isPending ? "Создаём…" : "Создать событие"}
        onSubmit={(request) => mutation.mutate(request, {
          onSuccess: (createdEvent) => navigate(`/organizer/events/${createdEvent.id}/tickets`),
        })}
      />
    </div>
  );
}

export function EditOrganizerEventPage() {
  const { eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const navigate = useNavigate();
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
      navigate("/organizer/events");
    },
  });

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return <AccessMessage title="Некорректный ID события" detail="Проверьте ссылку и выберите событие из списка." action={<Link to="/organizer/events" className={buttonClass("secondary")}>К моим событиям</Link>} />;
  }
  if (event.isLoading || venues.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загрузка события…</p>;
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
    return <AccessMessage title="Событие не найдено" detail="Возможно, оно было удалено или у вас нет доступа." action={<Link to="/organizer/events" className={buttonClass("secondary")}>К моим событиям</Link>} />;
  }
  if (event.data.status === "CANCELLED") {
    return <AccessMessage title="Событие отменено" detail="Отменённые события нельзя редактировать." action={<Link to="/organizer/events" className={buttonClass("secondary")}>К моим событиям</Link>} />;
  }
  const existingEvent = event.data;

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">Редактирование события</h2>
      <p className="mb-5 text-sm text-muted">Изменения сохраняются в существующем событии.</p>
      <OrganizerEventForm
        event={existingEvent}
        venues={venues.data?.content ?? []}
        isPending={mutation.isPending}
        error={mutation.error}
        submitLabel={mutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
        onCancel={() => navigate("/organizer/events")}
        onSubmit={(request) => mutation.mutate(buildEventUpdate(existingEvent, request))}
      />
      <PosterManager event={existingEvent} />
    </div>
  );
}

function PosterManager({ event }: { event: Event }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
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
      return "Выберите файл JPEG, PNG или WebP.";
    }
    if (selectedFile.size === 0) return "Файл постера пустой.";
    if (selectedFile.size > 5 * 1024 * 1024) return "Размер постера не должен превышать 5 МБ.";
    return "";
  };

  return (
    <section className="space-y-4 rounded-xl border p-5">
      <div>
        <h3 className="font-semibold">Постер события</h3>
        <p className="mt-1 text-sm text-muted">JPEG, PNG или WebP, не более 5 МБ.</p>
      </div>
      <EventPoster
        posterUrl={event.posterUrl}
        authenticated
        className="aspect-[4/3] max-w-sm rounded-lg"
      />
      {event.status === "CANCELLED" ? (
        <p className="text-sm text-muted">Постер отменённого события нельзя изменить или удалить.</p>
      ) : (
        <>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Выберите изображение</span>
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
          {validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}
          {uploadMutation.error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {uploadMutation.error instanceof Error ? uploadMutation.error.message : "Не удалось загрузить постер."}
            </p>
          )}
          {deleteMutation.error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Не удалось удалить постер."}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!file || !!validationError || isPending}
              onClick={() => file && uploadMutation.mutate(file)}
            >
              {uploadMutation.isPending ? "Загружаем…" : "Загрузить постер"}
            </Button>
            {event.posterUrl && (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  if (window.confirm("Удалить постер этого события?")) deleteMutation.mutate();
                }}
              >
                {deleteMutation.isPending ? "Удаляем…" : "Удалить постер"}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function OrganizerTicketsPage() {
  const { eventId: eventIdParam } = useParams();
  const eventId = Number(eventIdParam);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return <AccessMessage title="Некорректный ID события" detail="Проверьте ссылку и выберите событие из списка." action={<Link to="/organizer/events" className={buttonClass("secondary")}>К моим событиям</Link>} />;
  }
  if (event.isLoading || ticketTypes.isLoading) {
    return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загружаем событие и билеты…</p>;
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
    return <AccessMessage title="Событие не найдено" detail="Возможно, оно было удалено или у вас нет доступа." action={<Link to="/organizer/events" className={buttonClass("secondary")}>К моим событиям</Link>} />;
  }

  const tickets = ticketTypes.data ?? [];
  const allocated = tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  const remaining = event.data.capacity == null ? null : Math.max(event.data.capacity - allocated, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PosterManager event={event.data} />
      <div>
        <p className="text-sm text-muted">Новое событие сохранено</p>
        <h2 className="mt-1 text-xl font-bold">Билеты: {event.data.title}</h2>
        <p className="mt-2 text-sm text-muted">
          Добавляйте типы билетов, например «Стандарт» и «VIP». Количество — это доступные места этого типа, цена указывается в ₸.
        </p>
        {event.data.capacity != null && (
          <p className="mt-2 text-sm">
            Вместимость события: {event.data.capacity}. Распределено по типам билетов: {allocated}. Осталось распределить: {remaining}.
          </p>
        )}
      </div>

      {tickets.length > 0 && (
        <section aria-label="Созданные типы билетов" className="space-y-3">
          {tickets.map((ticket) => <TicketTypeCard key={ticket.id} ticket={ticket} />)}
        </section>
      )}

      {event.data.status === "CANCELLED" ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Для отменённого события нельзя менять билеты.</p>
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
          Вся вместимость события уже распределена. Увеличьте вместимость в настройках события, если нужно добавить ещё билеты.
        </p>
      )}

      <Button variant="secondary" onClick={() => navigate("/organizer/events")}>
        {tickets.length > 0 ? "Завершить и вернуться к событиям" : "Добавить билеты позже"}
      </Button>
    </div>
  );
}

function TicketTypeCard({ ticket }: { ticket: TicketType }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">{ticket.name}</h3>
        {ticket.description && <p className="mt-1 text-sm text-muted">{ticket.description}</p>}
        <p className="mt-1 text-sm text-muted">
          {ticket.price === 0 ? "Бесплатно" : `${ticket.price} ₸`} · Доступно: {ticket.available} из {ticket.quantity}
        </p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ticket.hidden ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-800"}`}>
        {ticket.hidden ? "Скрыт" : "Активен"}
      </span>
    </article>
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
  const [validationError, setValidationError] = useState("");

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setValidationError("");
    try {
      const form = new FormData(formEvent.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const description = String(form.get("description") ?? "").trim();
      const price = Number(form.get("price"));
      const quantity = Number(form.get("quantity"));
      const maxPerOrderValue = String(form.get("maxPerOrder") ?? "");
      const salesStart = String(form.get("salesStart") ?? "");
      const salesEnd = String(form.get("salesEnd") ?? "");
      const eventStart = new Date(event.startTime).getTime();

      if (!name) throw new Error("Укажите название типа билета.");
      if (!Number.isFinite(price) || price < 0 || !/^\d+(\.\d{1,2})?$/.test(String(form.get("price")))) {
        throw new Error("Цена должна быть неотрицательной и содержать не более двух знаков после запятой.");
      }
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error("Количество билетов должно быть целым числом больше нуля.");
      }
      if (maxQuantity !== null && quantity > maxQuantity) {
        throw new Error(`Можно добавить не более ${maxQuantity} билетов с учётом уже распределённых мест.`);
      }
      if (maxPerOrderValue) {
        const maxPerOrder = Number(maxPerOrderValue);
        if (!Number.isSafeInteger(maxPerOrder) || maxPerOrder <= 0 || maxPerOrder > quantity) {
          throw new Error("Лимит билетов в заказе должен быть положительным числом и не превышать количество билетов.");
        }
      }
      if (salesStart && new Date(salesStart).getTime() >= eventStart) {
        throw new Error("Продажи должны начаться до начала события.");
      }
      if (salesEnd && new Date(salesEnd).getTime() > eventStart) {
        throw new Error("Продажи должны закончиться не позже начала события.");
      }
      if (salesStart && salesEnd && new Date(salesStart).getTime() >= new Date(salesEnd).getTime()) {
        throw new Error("Начало продаж должно быть раньше окончания.");
      }

      const request: CreateTicketTypeRequest = { name, price, quantity };
      if (description) request.description = description;
      if (salesStart) request.salesStart = toApiLocalDateTime(salesStart);
      if (salesEnd) request.salesEnd = toApiLocalDateTime(salesEnd);
      if (maxPerOrderValue) request.maxPerOrder = Number(maxPerOrderValue);
      onSubmit(request);
    } catch (caught) {
      setValidationError(caught instanceof Error ? caught.message : "Проверьте данные билета.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border p-5">
      <h3 className="font-semibold">Добавить тип билета</h3>
      <FormField label="Название">
        <input name="name" required maxLength={100} className={fieldClass} placeholder="Например, Стандарт или VIP" />
      </FormField>
      <FormField label="Описание">
        <textarea name="description" rows={2} className={fieldClass} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Цена, ₸ (0 — бесплатно)">
          <input name="price" type="number" min="0" step="0.01" required className={fieldClass} />
        </FormField>
        <FormField label="Количество билетов / мест">
          <input name="quantity" type="number" min="1" max={maxQuantity ?? undefined} step="1" required className={fieldClass} />
        </FormField>
        <FormField label="Начало продаж">
          <input name="salesStart" type="datetime-local" className={fieldClass} />
        </FormField>
        <FormField label="Окончание продаж">
          <input name="salesEnd" type="datetime-local" className={fieldClass} />
        </FormField>
        <FormField label="Максимум билетов в одном заказе">
          <input name="maxPerOrder" type="number" min="1" step="1" defaultValue="10" className={fieldClass} />
        </FormField>
      </div>
      {validationError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{validationError}</p>}
      {error !== null && error !== undefined && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Не удалось создать тип билета."}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Добавляем…" : "Добавить тип билета"}
      </Button>
    </form>
  );
}

function OrganizerEventForm({
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
  const [validationError, setValidationError] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState(event?.venue?.id ? String(event.venue.id) : "");
  const [capacityValue, setCapacityValue] = useState(event?.capacity == null ? "" : String(event.capacity));
  const [newlyCreatedVenue, setNewlyCreatedVenue] = useState<Venue | null>(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCapacity, setVenueCapacity] = useState("");
  const [venueFormError, setVenueFormError] = useState("");
  const queryClient = useQueryClient();
  const venueMutation = useMutation({
    mutationFn: createVenue,
    onSuccess: async (createdVenue) => {
      setSelectedVenueId(String(createdVenue.id));
      setNewlyCreatedVenue(createdVenue);
      setVenueName("");
      setVenueAddress("");
      setVenueCapacity("");
      setShowVenueForm(false);
      await queryClient.invalidateQueries({ queryKey: ["venues"] });
    },
  });

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setValidationError("");
    try {
      onSubmit(readEventForm(
        new FormData(formEvent.currentTarget),
        event?.startTime,
        selectedVenue,
        event?.capacity,
      ));
    } catch (caught) {
      setValidationError(caught instanceof Error ? caught.message : "Проверьте введённые данные.");
    }
  };
  const knownVenue = venues.some((venue) => venue.id === event?.venue?.id);
  const selectedVenueIdNumber = Number(selectedVenueId);
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueIdNumber)
    ?? (event?.venue?.id === selectedVenueIdNumber ? event.venue : undefined)
    ?? (newlyCreatedVenue?.id === selectedVenueIdNumber ? newlyCreatedVenue : undefined);
  const addVenue = () => {
    const name = venueName.trim();
    const address = venueAddress.trim();
    const capacity = Number(venueCapacity);
    if (!name || !address || !Number.isSafeInteger(capacity) || capacity <= 0) {
      venueMutation.reset();
      setVenueFormError("Укажите название, адрес и вместимость площадки (целое число больше нуля).");
      return;
    }
    setVenueFormError("");
    venueMutation.mutate({ name, address, capacity });
  };

  return (
    <form
      onSubmit={submit}
      onReset={() => {
        setValidationError("");
        setSelectedVenueId("");
        setCapacityValue("");
        setNewlyCreatedVenue(null);
        setShowVenueForm(false);
        setVenueName("");
        setVenueAddress("");
        setVenueCapacity("");
        setVenueFormError("");
        venueMutation.reset();
      }}
      className="space-y-4 rounded-xl border p-5"
    >
      <FormField label="Название">
        <input name="title" required maxLength={200} defaultValue={event?.title ?? ""} className={fieldClass} />
      </FormField>
      <FormField label="Категория">
        <input name="category" required defaultValue={event?.category ?? ""} className={fieldClass} placeholder="Например, Концерт" />
      </FormField>
      <FormField label="Описание">
        <textarea name="description" rows={4} defaultValue={event?.description ?? ""} className={fieldClass} />
      </FormField>
      <FormField label="Площадка">
        <select
          name="venueId"
          required
          value={selectedVenueId}
          onChange={(change) => setSelectedVenueId(change.target.value)}
          className={fieldClass}
        >
          <option value="" disabled>Выберите площадку</option>
          {event?.venue && !knownVenue && (
            <option value={event.venue.id}>
              {event.venue.name} — {event.venue.address}
              {event.venue.capacity != null ? ` · до ${event.venue.capacity} человек` : " · без лимита"}
            </option>
          )}
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} — {venue.address}
              {venue.capacity != null ? ` · до ${venue.capacity} человек` : " · без лимита"}
            </option>
          ))}
          {newlyCreatedVenue && !venues.some((venue) => venue.id === newlyCreatedVenue.id) && (
            <option value={newlyCreatedVenue.id}>
              {newlyCreatedVenue.name} — {newlyCreatedVenue.address} · до {newlyCreatedVenue.capacity} человек
            </option>
          )}
        </select>
      </FormField>
      <div className="rounded-lg bg-surface p-4">
        <Button
          type="button"
          variant="secondary"
          title="Добавить площадку"
          aria-label="Добавить площадку"
          aria-expanded={showVenueForm}
          onClick={() => {
            setShowVenueForm((shown) => !shown);
            setVenueFormError("");
            venueMutation.reset();
          }}
        >
          {showVenueForm ? "Закрыть" : "Добавить"}
        </Button>
        {showVenueForm && (
          <div className="mt-4 space-y-3">
            <FormField label="Название площадки">
              <input
                value={venueName}
                onChange={(change) => setVenueName(change.target.value)}
                maxLength={200}
                className={fieldClass}
                autoComplete="organization"
              />
            </FormField>
            <FormField label="Адрес">
              <input
                value={venueAddress}
                onChange={(change) => setVenueAddress(change.target.value)}
                maxLength={300}
                className={fieldClass}
                autoComplete="street-address"
              />
            </FormField>
            <FormField label="Максимальная вместимость, человек">
              <input
                type="number"
                min="1"
                step="1"
                value={venueCapacity}
                onChange={(change) => setVenueCapacity(change.target.value)}
                className={fieldClass}
              />
            </FormField>
            {venueFormError && <p role="alert" className="text-sm text-red-700">{venueFormError}</p>}
            {venueMutation.error && (
              <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {venueMutation.error instanceof Error ? venueMutation.error.message : "Не удалось добавить площадку."}
              </p>
            )}
            <Button type="button" disabled={venueMutation.isPending} onClick={addVenue}>
              {venueMutation.isPending ? "Добавляем…" : "Добавить площадку"}
            </Button>
          </div>
        )}
        {venues.length === 0 && (
          <p className="mt-3 text-sm text-muted">Создайте площадку, чтобы продолжить создание события.</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Начало">
          <input name="startTime" type="datetime-local" required defaultValue={toLocalInputValue(event?.startTime)} className={fieldClass} />
        </FormField>
        <FormField label="Окончание">
          <input name="endTime" type="datetime-local" defaultValue={toLocalInputValue(event?.endTime)} className={fieldClass} />
        </FormField>
        <FormField label="Начало регистрации">
          <input name="registrationOpeningTime" type="datetime-local" defaultValue={toLocalInputValue(event?.registrationOpeningTime)} className={fieldClass} />
        </FormField>
        <FormField label="Окончание регистрации">
          <input name="registrationClosingTime" type="datetime-local" defaultValue={toLocalInputValue(event?.registrationClosingTime)} className={fieldClass} />
        </FormField>
        <FormField label="Вместимость">
          <input
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
                ? "У площадки нет заданного ограничения вместимости."
                : `Максимум площадки: ${selectedVenue.capacity} человек. ${
                    capacityValue || event?.capacity != null
                      ? `Вместимость события: ${capacityValue || event?.capacity}.`
                      : `Если оставить пустым, вместимость события будет ${selectedVenue.capacity}.`
                  }`}
            </p>
          )}
        </FormField>
        <FormField label="Видимость">
          <select name="visibilityStatus" defaultValue={event?.visibilityStatus ?? "PUBLIC"} className={fieldClass}>
            <option value="PUBLIC">Публичное</option>
            <option value="UNLISTED">По ссылке</option>
            <option value="PRIVATE">Приватное</option>
          </select>
        </FormField>
      </div>
      {event && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Backend пока не очищает необязательные дату окончания, даты регистрации и вместимость: если очистить эти поля, прежние значения сохранятся.
        </p>
      )}
      {validationError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{validationError}</p>}
      {error !== null && error !== undefined && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Не удалось сохранить событие."}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending || venues.length === 0}>
          {submitLabel}
        </Button>
        {!event && (
          <Button type="reset" variant="secondary" disabled={isPending}>
            Очистить
          </Button>
        )}
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Отмена</Button>}
      </div>
    </form>
  );
}

function readEventForm(
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
  const startTimestamp = new Date(startTime).getTime();
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
  if (endTime && new Date(endTime).getTime() <= new Date(startTime).getTime()) {
    throw new Error("Время окончания должно быть позже начала события.");
  }
  if (registrationOpeningTime && registrationClosingTime &&
      new Date(registrationOpeningTime).getTime() >= new Date(registrationClosingTime).getTime()) {
    throw new Error("Регистрация должна открываться раньше закрытия.");
  }
  if (registrationClosingTime && new Date(registrationClosingTime).getTime() > new Date(startTime).getTime()) {
    throw new Error("Регистрация должна закрыться до начала события.");
  }

  const request: CreateEventRequest = {
    title,
    description: String(form.get("description") ?? "").trim(),
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

export function ManageOrganizerEventsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile, events } = useOrganizerEvents();
  const [actionError, setActionError] = useState("");
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
    onError: (error) => setActionError(error instanceof Error ? error.message : "Не удалось изменить событие."),
  });
  const retry = () => {
    void profile.refetch();
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
      setActionError(error instanceof Error ? error.message : "Не удалось проверить билеты события.");
    } finally {
      setCheckingTicketsForEvent(null);
    }
  };

  return (
    <QueryState loading={profile.isLoading || events.isLoading} error={profile.error ?? events.error} onRetry={retry}>
      <Modal
        open={eventPendingPublish !== null}
        onClose={() => setEventPendingPublish(null)}
        title="Опубликовать событие без билетов?"
      >
        <h2 className="text-xl font-bold">У события нет доступных билетов</h2>
        <p className="mt-3 text-sm text-muted">
          {eventPendingPublish?.title ? `«${eventPendingPublish.title}» будет опубликовано` : "Событие будет опубликовано"} без доступных билетов. Посетители увидят событие, но пока не смогут купить билеты.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {eventPendingPublish && (
            <Button onClick={() => {
              const eventId = eventPendingPublish.id;
              setEventPendingPublish(null);
              navigate(`/organizer/events/${eventId}/tickets`);
            }}>
              Сначала добавить билеты
            </Button>
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
            Всё равно опубликовать
          </Button>
          <button
            type="button"
            className="py-2 text-sm text-muted hover:text-black"
            onClick={() => setEventPendingPublish(null)}
          >
            Отмена
          </button>
        </div>
      </Modal>
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
                <Link to={`/organizer/events/${event.id}/tickets`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">
                  Билеты
                </Link>
                {event.status !== "CANCELLED" && (
                  <Link to={`/organizer/events/${event.id}/edit`} className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold hover:bg-gray-200">
                    Изменить
                  </Link>
                )}
                {event.status === "DRAFT" && (
                  <Button
                    disabled={mutation.isPending || checkingTicketsForEvent !== null}
                    onClick={() => void requestPublish(event)}
                  >
                    {checkingTicketsForEvent === event.id ? "Проверяем билеты…" : "Опубликовать"}
                  </Button>
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

function toLocalInputValue(value?: string) {
  return value ? value.slice(0, 16) : "";
}

function toApiLocalDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

function isVisibility(value: string): value is Visibility {
  return value === "PUBLIC" || value === "UNLISTED" || value === "PRIVATE";
}
