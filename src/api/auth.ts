import { api } from "./client";
import type { AuthResponse, User } from "./types";

// POST /api/auth/login  body: { email, password }
export const login = (email: string, password: string) =>
  api<AuthResponse>("/api/auth/login", { method: "POST", body: { email, password } });

// POST /api/auth/register  body: { email, password }  (password: 6+ characters)
export const register = (email: string, password: string) =>
  api<AuthResponse>("/api/auth/register", { method: "POST", body: { email, password } });

// GET /api/users/me — who is logged in (needs the token)
export const getMe = () => api<User>("/api/users/me");
