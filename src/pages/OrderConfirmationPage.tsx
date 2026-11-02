import { Link, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrder, payOrder } from "../api/orders";
import type { OrderStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { formatPrice } from "../lib/format";

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Ожидает подтверждения",
  PAID: "Подтверждён",
  CANCELLED: "Отменён",
  EXPIRED: "Истёк",
};

export default function OrderConfirmationPage() {
  const orderId = Number(useParams().orderId);
  const queryClient = useQueryClient();
  const { isLoggedIn, openLogin } = useAuth();
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: Number.isSafeInteger(orderId) && orderId > 0 && isLoggedIn,
    retry: false,
  });
  const confirmation = useMutation({
    mutationFn: () => payOrder(orderId),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(["order", orderId], updatedOrder);
    },
  });

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return <OrderMessage title="Некорректный номер заказа" detail="Проверьте ссылку и попробуйте снова." />;
  }
  if (!isLoggedIn) {
    return (
      <OrderMessage
        title="Войдите, чтобы просмотреть заказ"
        detail="Информация о заказе доступна только после входа в аккаунт."
        action={<Button onClick={openLogin}>Войти</Button>}
      />
    );
  }
  if (order.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">Загружаем заказ…</p>;
  if (order.error || !order.data) {
    return <ErrorMessage error={order.error ?? new Error("Заказ не найден.")} onRetry={() => { void order.refetch(); }} />;
  }

  const currentOrder = order.data;
  const canConfirm = currentOrder.status === "PENDING";
  const isFree = currentOrder.totalAmount === 0;

  return (
    <main className="mx-auto max-w-2xl">
      <p className="text-sm text-muted">Заказ №{currentOrder.id}</p>
      <h1 className="mt-1 text-2xl font-bold">
        {currentOrder.status === "PAID" ? "Заказ подтверждён" : "Подтверждение заказа"}
      </h1>
      <p className="mt-2 text-sm text-muted">{currentOrder.eventTitle}</p>

      <section className="mt-6 rounded-xl border p-5" aria-label="Состав заказа">
        <div className="space-y-3">
          {currentOrder.items.map((item) => (
            <div key={item.ticketTypeId} className="flex justify-between gap-4 text-sm">
              <span>{item.ticketTypeName} × {item.quantity}</span>
              <span className="whitespace-nowrap font-medium">{formatPrice(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t pt-4 font-bold">
          <span>Итого</span>
          <span>{formatPrice(currentOrder.totalAmount)}</span>
        </div>
        <p className="mt-3 text-sm text-muted">Статус: {statusLabels[currentOrder.status]}</p>
      </section>

      {currentOrder.status === "PAID" && (
        <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          {isFree ? "Бесплатные билеты подтверждены." : "Симулированная оплата прошла успешно."}
        </p>
      )}
      {currentOrder.status === "CANCELLED" && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">Этот заказ отменён.</p>
      )}
      {currentOrder.status === "EXPIRED" && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Срок действия заказа истёк. Создайте новый заказ.</p>
      )}
      {confirmation.error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {confirmation.error instanceof Error ? confirmation.error.message : "Не удалось подтвердить заказ."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {canConfirm && (
          <Button disabled={confirmation.isPending} onClick={() => confirmation.mutate()}>
            {confirmation.isPending
              ? "Подтверждаем…"
              : isFree
                ? "Подтвердить бесплатный заказ"
                : "Оплатить заказ"}
          </Button>
        )}
        <Link to={`/events/${currentOrder.eventId}`} className={buttonClass("secondary")}>
          Вернуться к событию
        </Link>
      </div>
      {canConfirm && (
        <p className="mt-3 text-xs text-muted">
          {isFree
            ? "Деньги не списываются. Подтверждение завершит оформление бесплатных билетов."
            : "Оплата симулируется backend-сервисом; реальные платёжные данные не запрашиваются."}
        </p>
      )}
    </main>
  );
}

function OrderMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface p-6 text-center">
      <h1 className="font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      <div className="mt-4 flex justify-center gap-3">
        {action}
        <Link to="/" className={buttonClass("secondary")}>На главную</Link>
      </div>
    </div>
  );
}
