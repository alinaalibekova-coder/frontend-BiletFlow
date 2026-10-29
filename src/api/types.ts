// These types copy the "Schemas" section of the backend's Swagger (api-docs.json).
// If the backend changes a field, change it here and TypeScript will show
// every place in the app that needs updating.

export interface User {
  id: number;
  email: string;
  role: string;
  verificationStatus: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Venue {
  id: number;
  name: string;
  address: string;
}

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export interface Event {
  id: number;
  title: string;
  description?: string;
  category: string;
  startTime: string;
  endTime?: string;
  registrationOpeningTime?: string;
  registrationClosingTime?: string;
  capacity?: number;
  visibilityStatus?: Visibility;
  status?: EventStatus;
  organizerId?: number;
  venue?: Venue;
}

export interface TicketType {
  id: number;
  eventId: number;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  sold: number;
  available: number;
  salesStart?: string;
  salesEnd?: string;
  maxPerOrder?: number;
  hidden: boolean;
}

// Spring Boot wraps every list in this "page" object. The items are in `content`.
export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";

export interface OrderItem {
  ticketTypeId: number;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  eventId: number;
  eventTitle: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  expiresAt?: string;
  paidAt?: string;
  items: OrderItem[];
}

export type TicketStatus = "VALID" | "USED" | "CANCELLED";

export interface Ticket {
  id: number;
  code: string;
  status: TicketStatus;
  orderId: number;
  eventId: number;
  eventTitle: string;
  ticketTypeId: number;
  ticketTypeName: string;
  attendeeEmail: string;
  usedAt?: string;
}