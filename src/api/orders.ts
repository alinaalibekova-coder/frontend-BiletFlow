import { api, apiBlob } from "./client";
import type { Order, Page, Ticket } from "./types";

export interface OrderItemInput {
  ticketTypeId: number;
  quantity: number;
}

// POST /api/orders — creates an order with status PENDING
export const createOrder = (eventId: number, items: OrderItemInput[]) =>
  api<Order>("/api/orders", { method: "POST", body: { eventId, items } });

// GET /api/orders/{id}
export const getOrder = (id: number) => api<Order>(`/api/orders/${id}`);

// POST /api/orders/{id}/pay — simulated payment, status becomes PAID
export const payOrder = (id: number) => api<Order>(`/api/orders/${id}/pay`, { method: "POST" });

// POST /api/orders/{id}/cancel
export const cancelOrder = (id: number) => api<Order>(`/api/orders/${id}/cancel`, { method: "POST" });

// GET /api/orders — my orders
export const getMyOrders = (page = 0, size = 20) =>
  api<Page<Order>>(`/api/orders?page=${page}&size=${size}`);

export const getMyTickets = (page = 0, size = 20) =>
  api<Page<Ticket>>(`/api/tickets?page=${page}&size=${size}`);

export const getTicketQr = (ticketId: number) => apiBlob(`/api/tickets/${ticketId}/qr`);