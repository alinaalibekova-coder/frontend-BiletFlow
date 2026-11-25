import { useLanguage } from "../i18n/LanguageContext";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkPayment, getOrder, getPayments } from "../api/orders";
import type { PaymentSession } from "../api/commerce";
import { startOrderPayment } from "../lib/checkout";
import type { OrderStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { CalendarMenu } from "../components/events/EventExtras";
import { formatPrice, formatDateTime, parseDate } from "../lib/format";
import { HoldCountdown } from "../components/orders/HoldCountdown";
import { CheckoutSteps } from "../components/orders/CheckoutSteps";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Icon } from "../components/ui/Icons";

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Ожидает подтверждения",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
  EXPIRED: "Истёк",
  REFUNDED: "Возвращён",
};

export default function OrderConfirmationPage({ paymentResult = false }: { paymentResult?: boolean }) {
  const { tx, locale } = useLanguage();
  const orderId = Number(useParams().orderId);
  const queryClient = useQueryClient();
  const { isLoggedIn, openLogin } = useAuth();
  const [session, setSession] = useState<PaymentSession | null>(null);
  // Set when the hold countdown reaches zero, before the backend has marked the order EXPIRED.
  const [holdExpired, setHoldExpired] = useState(false);
  const [openedAt] = useState(Date.now);
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => paymentResult ? checkPayment(orderId) : getOrder(orderId),
    enabled: Number.isSafeInteger(orderId) && orderId > 0 && isLoggedIn,
    retry: false,
    staleTime: paymentResult ? 0 : 30000,
    refetchOnMount: paymentResult ? "always" : true,
    refetchInterval: query => paymentResult && query.state.data?.status === "PENDING" ? 5000 : false,
  });
  const payments = useQuery({
    queryKey: ["order-payments", orderId],
    queryFn: () => getPayments(orderId),
    enabled: isLoggedIn && !!order.data,
    refetchInterval: order.data?.status === "PENDING" && paymentResult ? 5000 : false,
  });
  useEffect(() => {
    if (order.data?.status === "PAID") {
      void Promise.all(["my-orders", "my-tickets", "order-payments"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    }
  }, [order.data?.status, queryClient]);
  const refreshRelated = async () => {
    await Promise.all(["my-orders", "my-tickets", "order-payments"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  };
  const confirmation = useMutation({
    mutationFn: async () => {
      if (!order.data) throw new Error(tx("Сначала загрузите заказ."));
      return startOrderPayment(order.data, setSession);
    },
    onSuccess: updatedOrder => { if (updatedOrder) queryClient.setQueryData(["order", orderId], updatedOrder); },
    onSettled: async () => { await order.refetch(); await refreshRelated(); },
  });
  const check = useMutation({
    mutationFn: () => checkPayment(orderId),
    onSuccess: updated => queryClient.setQueryData(["order", orderId], updated),
    onSettled: refreshRelated,
  });

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return <OrderMessage title={tx("Некорректный номер заказа")} detail={tx("Проверьте ссылку и попробуйте снова.")} />;
  }
  if (!isLoggedIn) {
    return (
      <OrderMessage
        title={tx("Войдите, чтобы просмотреть заказ")}
        detail={tx("Информация о заказе доступна только после входа в аккаунт.")}
        action={<Button onClick={openLogin}>{tx("Войти")}</Button>}
      />
    );
  }
  if (order.isLoading) return <p className="rounded-xl bg-surface p-6 text-center text-sm">{tx("Загружаем заказ…")}</p>;
  if (order.error || !order.data) {
    return <ErrorMessage error={order.error ?? new Error(tx("Заказ не найден."))} onRetry={() => { void order.refetch(); }} />;
  }

  const currentOrder = order.data;
  const pending = currentOrder.status === "PENDING";
  const holdOver = pending && (holdExpired || (!!currentOrder.expiresAt && parseDate(currentOrder.expiresAt).getTime() <= openedAt));
  // Back from the bank: a PENDING order past its hold time may still be confirmed by the bank,
  // so it is "waiting for the bank", never "expired", until the backend itself says EXPIRED.
  const waitingForBank = paymentResult && pending;
  const showExpired = currentOrder.status === "EXPIRED" || (holdOver && !waitingForBank);
  const canConfirm = pending && !holdOver;
  const onHoldExpired = () => {
    setHoldExpired(true);
    void order.refetch();
  };
  const isFree = currentOrder.totalAmount === 0;

  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="order-title">
      <CheckoutSteps current={currentOrder.status === "PAID" ? 3 : 2} failed={["CANCELLED", "EXPIRED"].includes(currentOrder.status) || showExpired} />
      <p className="text-sm text-muted">{tx("Заказ №")}{currentOrder.id}</p>
      <h1 id="order-title" className="mt-1 text-2xl font-bold">
        {currentOrder.status === "PAID" ? tx("Заказ подтверждён") : tx("Подтверждение заказа")}
      </h1>
      <p className="mt-2 text-sm text-muted">{currentOrder.eventTitle}</p>
      {currentOrder.attendeeName && <p className="mt-2 text-sm">{tx("Посетитель: ")}{currentOrder.attendeeName}</p>}
      {pending && currentOrder.expiresAt && !(waitingForBank && holdOver) && <HoldCountdown expiresAt={currentOrder.expiresAt} createdAt={currentOrder.createdAt} onExpire={onHoldExpired} />}
      {waitingForBank && <p role="status" data-waiting-for-bank="true" className="mt-4 flex items-start gap-2 rounded-[var(--radius-card)] bg-info-soft p-4 text-sm text-info-ink"><Icon name="clock" className="mt-0.5 h-4 w-4" />{tx("Проверяем оплату. Билеты появятся после подтверждения банка. Статус обновляется автоматически.")}</p>}

      <section className="mt-6 rounded-[var(--radius-card)] border border-gray-200 bg-white p-5 shadow-soft" aria-label={tx("Состав заказа")}>
        <div className="space-y-3">
          {currentOrder.items.map((item, index) => (
            <div key={item.seatId ?? `${item.ticketTypeId}-${index}`} className="flex justify-between gap-4 text-sm">
              <span>{item.seatLabel ? `${item.ticketTypeName} · ${item.seatLabel}${item.quantity > 1 ? ` × ${item.quantity}` : ""}` : `${item.ticketTypeName} × ${item.quantity}`}</span>
              <span className="whitespace-nowrap font-medium">{formatPrice(item.unitPrice * item.quantity, locale)}</span>
            </div>
          ))}
        </div>
        {!!currentOrder.discountAmount && <p className="mt-4 text-sm">{tx("Скидка ")}{currentOrder.promoCode}: −{formatPrice(currentOrder.discountAmount, locale)}</p>}
        <div className="mt-4 flex justify-between border-t pt-4 font-bold">
          <span>{tx("Итого")}</span>
          <span>{formatPrice(currentOrder.totalAmount, locale)}</span>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">{tx("Статус: ")}<StatusBadge status={currentOrder.status} label={tx(statusLabels[currentOrder.status])} /></p>
      </section>

      {currentOrder.status === "PAID" && (
        <CalendarMenu eventId={currentOrder.eventId} resolveStatus />
      )}
      {currentOrder.status === "PAID" && (
        <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          {isFree ? tx("Бесплатные билеты подтверждены.") : tx("Оплата подтверждена.")} {tx(" Билеты доступны в личном кабинете.")}</p>
      )}
      {currentOrder.status === "CANCELLED" && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{tx("Этот заказ отменён.")}</p>
      )}
      {currentOrder.status === "REFUNDED" && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{tx("Организатор вернул деньги за этот заказ. Билеты больше не действуют.")}</p>
      )}
      {showExpired && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{tx("Срок действия заказа истёк. Создайте новый заказ.")}</p>
      )}
      {confirmation.error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {confirmation.error instanceof Error ? tx(confirmation.error.message) : tx("Не удалось подтвердить заказ.")}
        </p>
      )}
      {check.error && <ErrorMessage error={check.error} />}
      {session?.simulated && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">{tx("Демонстрационная оплата: реальные деньги не списываются.")}</p>}

      <div className="mt-5 flex flex-wrap gap-3">
        {pending && (
          <Button disabled={!canConfirm || confirmation.isPending || check.isPending} onClick={() => confirmation.mutate()}>
            {confirmation.isPending
              ? tx("Подтверждаем…")
              : isFree
                ? tx("Подтвердить бесплатный заказ")
                : tx("Оплатить заказ")}
          </Button>
        )}
        {pending && <Button variant="secondary" disabled={check.isPending || confirmation.isPending} onClick={() => check.mutate()}>{check.isPending ? tx("Проверяем…") : tx("Проверить оплату")}</Button>}
        <Link to="/account" className={buttonClass("secondary")}>{tx("Мои билеты")}</Link>
        <Link to={`/events/${currentOrder.eventId}`} className={buttonClass("secondary")}>
          {tx("Вернуться к событию")}</Link>
      </div>
      {canConfirm && (
        <p className="mt-3 text-xs text-muted">
          {isFree
            ? tx("Деньги не списываются. Подтверждение завершит оформление бесплатных билетов.")
            : tx("Данные карты вводятся на странице банка. После возвращения проверим результат оплаты.")}
        </p>
      )}
      <section className="mt-8 rounded-xl border p-5">
        <h2 className="font-semibold">{tx("Попытки оплаты")}</h2>
        {payments.isLoading && <p className="mt-2 text-sm">{tx("Загрузка…")}</p>}
        {payments.error && <ErrorMessage error={payments.error} onRetry={() => void payments.refetch()} />}
        {payments.data?.length === 0 && <p className="mt-2 text-sm text-muted">{tx("Попыток пока нет.")}</p>}
        {payments.data?.map(payment => <article key={payment.id} className="mt-3 border-t pt-3 text-sm">
          <p>{payment.status === "SUCCEEDED" ? tx("Успешно") : tx("Отклонено")} · {formatPrice(payment.amount, locale)} · {payment.provider}</p>
          {payment.simulated && <p className="text-amber-800">{tx("Демонстрационная операция")}</p>}
          <p className="break-all text-xs text-muted">{payment.reference} · {formatDateTime(payment.createdAt, locale)}</p>
          {payment.failureReason && <p className="mt-1 text-red-700">{payment.failureReason}</p>}
        </article>)}
      </section>
      <Link to={`/support/new?orderId=${orderId}`} className="mt-5 inline-block text-sm underline">{tx("Помощь с заказом")}</Link>
    </section>
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
  const { tx } = useLanguage();
  return (
    <div className="rounded-xl bg-surface p-6 text-center">
      <h1 className="font-bold">{tx(title)}</h1>
      <p className="mt-2 text-sm text-muted">{tx(detail)}</p>
      <div className="mt-4 flex justify-center gap-3">
        {action}
        <Link to="/" className={buttonClass("secondary")}>{tx("На главную")}</Link>
      </div>
    </div>
  );
}
