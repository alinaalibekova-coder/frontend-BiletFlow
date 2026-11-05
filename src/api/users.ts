import { api } from "./client";
import type { Page, User } from "./types";

export interface UpdateUserRequest {
  email?: string;
  password?: string;
}

export const getUsers = (page = 0, size = 20) =>
  api<Page<User>>(`/api/users?page=${page}&size=${size}`);

export const updateUser = (userId: number, request: UpdateUserRequest) =>
  api<User>(`/api/users/${userId}`, { method: "PUT", body: request });

export const deleteUser = (userId: number) =>
  api<void>(`/api/users/${userId}`, { method: "DELETE" });
