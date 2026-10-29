// The ONLY place in the app that calls fetch().
// Every request goes through here, so the login token and error handling
// are written once.

const TOKEN_KEY = "bf_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте интернет.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// The backend's error format is not documented in Swagger yet, so we try
// the common shapes and fall back to a message based on the status code.
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const msg = data?.message ?? data?.error?.message ?? data?.detail ?? data?.error;
    if (typeof msg === "string" && msg.length > 0) return msg;
  } catch {
    /* body was not JSON */
  }
  switch (response.status) {
    case 400: return "Проверьте введённые данные.";
    case 401: return "Нужно войти в аккаунт.";
    case 403: return "Нет доступа.";
    case 404: return "Не найдено.";
    case 409: return "Такой пользователь уже существует.";
    default: return "Ошибка сервера. Попробуйте позже.";
  }
}
