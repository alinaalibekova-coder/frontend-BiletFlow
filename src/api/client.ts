// The ONLY place in the app that calls fetch().
// Every request goes through here, so the login token and error handling
// are written once.

export const TOKEN_KEY = "bf_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Subscribers keep React auth state in sync when any authenticated call is rejected.
const authFailureListeners = new Set<(message: string) => void>();
export function onAuthFailure(listener: (message: string) => void) {
  authFailureListeners.add(listener);
  return () => { authFailureListeners.delete(listener); };
}
// Called when a 401 answers a request made with a token that is no longer the saved one:
// another tab signed out or into another account. Listeners re-read the saved token, so a
// tab never stays "signed in" while every request it makes is rejected.
const tokenChangeListeners = new Set<() => void>();
export function onStoredTokenChange(listener: () => void) {
  tokenChangeListeners.add(listener);
  return () => { tokenChangeListeners.delete(listener); };
}
function rejectAuthentication(status: number, message: string, code: string | undefined, token: string | null) {
  if (token && getToken() === token && (status === 401 || (status === 403 && code === "ACCOUNT_SUSPENDED"))) {
    clearToken();
    authFailureListeners.forEach(listener => listener(message));
  } else if (status === 401) {
    tokenChangeListeners.forEach(listener => listener());
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const body = options.body === undefined
    ? undefined
    : options.body instanceof FormData
      ? options.body
      : JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет.");
  }

  if (!response.ok) {
    const { message, code } = await readError(response);
    rejectAuthentication(response.status, message, code, token);
    throw new ApiError(response.status, message, code);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // e.g. index.html from a misrouted /api request: not a server answer the app can use.
    throw new ApiError(response.status, "Сервер вернул неожиданный ответ. Обновите страницу или попробуйте позже.", "INVALID_RESPONSE");
  }
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(path, { headers });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет.");
  }
  if (!response.ok) {
    const { message, code } = await readError(response);
    rejectAuthentication(response.status, message, code, token);
    throw new ApiError(response.status, message, code);
  }
  return response.blob();
}

// The backend's error format is not documented in Swagger yet, so we try
// the common shapes and fall back to a message based on the status code.
async function readError(response: Response): Promise<{ message: string; code?: string }> {
  try {
    const data = await response.json();
    const msg = data?.message ?? data?.error?.message ?? data?.detail ?? data?.error;
    const rawCode = data?.code ?? data?.error?.code;
    const code = typeof rawCode === "string" ? rawCode : undefined;
    if (typeof msg === "string" && msg.length > 0) return { message: msg, code };
    return { message: fallbackMessage(response.status), code };
  } catch {
    /* body was not JSON */
  }
  return { message: fallbackMessage(response.status) };
}
function fallbackMessage(status: number) {
  switch (status) {
    case 400: return "Проверьте введённые данные.";
    case 401: return "Нужно войти в аккаунт.";
    case 402: return "Оплата отклонена. Заказ ожидает оплаты; можно повторить попытку.";
    case 403: return "Нет доступа.";
    case 404: return "Не найдено.";
    case 413: return "Файл превышает допустимый размер 5 МБ.";
    // 409 covers many conflicts (taken seat, used-up promo code, repeated report, existing account),
    // so the fallback stays neutral; the backend's own message is shown whenever it sends one.
    case 409: return "Не удалось выполнить действие: данные уже изменились или такая запись уже есть. Обновите страницу и попробуйте снова.";
    default: return "Ошибка сервера. Попробуйте позже.";
  }
}
