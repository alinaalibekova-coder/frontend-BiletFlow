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
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return response.blob();
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
    case 413: return "Файл превышает допустимый размер 5 МБ.";
    case 409: return "Такой пользователь уже существует.";
    default: return "Ошибка сервера. Попробуйте позже.";
  }
}
