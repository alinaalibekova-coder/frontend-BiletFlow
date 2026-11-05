import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, buttonClass } from "../components/ui/Button";

export function RoleGuard({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, isLoggedIn, isUserLoading, userError, refetchUser, openLogin } = useAuth();

  if (!isLoggedIn) {
    return <AccessMessage title="Войдите в аккаунт" detail="Для доступа к этому разделу нужно авторизоваться." action={<Button onClick={openLogin}>Войти</Button>} />;
  }
  if (isUserLoading || (!user && !userError)) {
    return <p className="rounded-xl bg-surface p-6 text-center text-sm">Проверяем аккаунт…</p>;
  }
  if (userError) {
    return <AccessMessage title="Не удалось проверить аккаунт" detail={userError instanceof Error ? userError.message : "Попробуйте ещё раз."} action={<Button variant="secondary" onClick={refetchUser}>Повторить</Button>} />;
  }
  const role = user?.role.trim().toUpperCase().replace(/^ROLE_/, "");
  if (!role || !roles.includes(role)) {
    return <AccessMessage title="Недостаточно прав" detail={`Текущая роль: ${role ?? "не определена"}.`} action={<Link to="/" className={buttonClass("secondary")}>На главную</Link>} />;
  }
  return children;
}

function AccessMessage({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return <section className="mx-auto max-w-xl rounded-2xl border p-8 text-center"><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-muted">{detail}</p><div className="mt-5">{action}</div></section>;
}
