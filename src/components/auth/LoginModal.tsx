import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

type Mode = "login" | "register";

// "Вход или регистрация" window, by email and password
// (matches POST /api/auth/login and POST /api/auth/register).
export function LoginModal() {
  const { isLoginOpen, closeLogin, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; password2?: string }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
    setServerError("");
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Введите корректный email";
    if (password.length < 6) e.password = "Минимум 6 символов";
    if (mode === "register" && password !== password2) e.password2 = "Пароли не совпадают";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
      setPassword("");
      setPassword2("");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={`flex-1 rounded-md py-2 text-sm ${mode === m ? "bg-white font-semibold shadow-sm" : "text-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <Modal open={isLoginOpen} onClose={closeLogin} title="Вход или регистрация">
      <h2 className="text-center text-xl font-bold">Вход или регистрация</h2>
      <p className="mt-1 text-center text-xs text-muted">Войдите по электронной почте</p>

      <div className="mt-5 flex rounded-lg bg-surface p-1">
        {tab("login", "Вход")}
        {tab("register", "Регистрация")}
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
        <TextInput
          label="email@example.com"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextInput
          label="Пароль"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {mode === "register" && (
          <TextInput
            label="Повторите пароль"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            error={errors.password2}
          />
        )}

        {serverError && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{serverError}</p>}

        <Button type="submit" disabled={loading} className="w-full py-3">
          {loading ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        Нажимая «{mode === "login" ? "Войти" : "Зарегистрироваться"}», вы принимаете условия Пользовательского соглашения
      </p>
    </Modal>
  );
}
