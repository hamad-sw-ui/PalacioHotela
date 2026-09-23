import type { Booking, CatalogItem, ContentPage, HotelSettings, QuoteRequest } from "@/db/schema";

export type AdminUser = { id: number; fullName: string; email: string; phone: string | null; role: string; locale: string; active: boolean; createdAt: string };
export type AdminMessage = { id: number; name: string; email: string; phone: string | null; subject: string; message: string; status: string; createdAt: string };
export type AdminNotification = { id: number; type: string; title: string; message: string; href: string; read: boolean; createdAt: string };
export type AdminActivity = { id: number; actorName: string; action: string; entity: string; entityId: number | null; details: string; createdAt: string };
export type AdminData = {
  admin: { id: number; fullName: string; role: string; email: string };
  bookings: Booking[];
  quotes: QuoteRequest[];
  catalog: CatalogItem[];
  pages: ContentPage[];
  users: AdminUser[];
  messages: AdminMessage[];
  notifications: AdminNotification[];
  activity: AdminActivity[];
  settings: HotelSettings;
  integrations: { card: boolean; paypal: boolean; cash: boolean; paypalRate: number | null; smtp: boolean; aiApi: boolean; demoLogin: boolean };
  stats: { bookings: number; pendingBookings: number; quotes: number; newQuotes: number; unread: number; messages: number };
};
export type Section = "overview" | "reservations" | "devis" | "catalogue" | "pages" | "utilisateurs" | "messages" | "notifications" | "activite" | "parametres";
export type Resource = "bookings" | "quotes" | "catalog" | "pages" | "users" | "messages" | "settings" | "notifications";
export type AdminAction = (resource: Resource, action: string, id?: number, data?: Record<string, unknown>) => Promise<{ ok: boolean; result?: unknown }>;
