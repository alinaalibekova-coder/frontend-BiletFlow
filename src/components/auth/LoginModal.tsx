import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";
import { useLanguage } from "../../i18n/LanguageContext";

type Mode = "login" | "register";

// "Вход или регистрация" window, by email and password
// (matches POST /api/auth/login and POST /api/auth/register).
export function LoginModal() {
  const { isLoginOpen, closeLogin, login, register } = useAuth();
  const { t, tx } = useLanguage();
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
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = t("validEmail");
    if (password.length < 6) e.password = t("passwordMinimum");
    if (mode === "register" && password !== password2) e.password2 = t("passwordsDiffer");
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
      setServerError(err instanceof Error ? tx(err.message) : t("genericError"));
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
    <Modal open={isLoginOpen} onClose={closeLogin} title={t("loginOrRegister")} titleClassName="px-6 text-center text-xl font-bold">
      <p className="mt-1 text-center text-xs text-muted">{t("signInByEmail")}</p>

      <div className="mt-5 flex rounded-lg bg-surface p-1">
        {tab("login", t("signInTab"))}
        {tab("register", t("registerTab"))}
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
          label={t("password")}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {mode === "register" && (
          <TextInput
            label={t("repeatPassword")}
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            error={errors.password2}
          />
        )}

        {serverError && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{tx(serverError)}</p>}

        <Button type="submit" disabled={loading} className="w-full py-3">
          {loading ? t("wait") : mode === "login" ? t("login") : t("register")}
        </Button>
      </form>
      {mode === "login" && <Link to="/forgot-password" onClick={closeLogin} className="mt-3 inline-block text-sm underline">{t("forgotPassword")}</Link>}

      <p className="mt-5 text-center text-xs text-muted">
        {t("agreement", { action: mode === "login" ? t("login") : t("register") })}
      </p>
    </Modal>
  );
}
