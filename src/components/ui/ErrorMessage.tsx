import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "./Button";

// Shown when a request fails. If the server says "log in first", offer the login button.
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { openLogin, isLoggedIn } = useAuth();
  const needsLogin = error instanceof ApiError && (error.status === 401 || error.status === 403) && !isLoggedIn;
  const message = error instanceof Error ? error.message : "Что-то пошло не так";

  return (
    <div className="rounded-xl bg-surface p-6 text-center">
      <p className="text-sm">{needsLogin ? "Чтобы увидеть события, войдите в аккаунт." : message}</p>
      <div className="mt-4 flex justify-center gap-3">
        {needsLogin && <Button onClick={openLogin}>Войти</Button>}
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </div>
    </div>
  );
}
