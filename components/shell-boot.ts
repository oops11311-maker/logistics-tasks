import { api, ApiError, setCsrf, type Category, type Person } from "./api";

type Note = { id: string; href: string | null; title: string; body: string; readAt: string | null; createdAt: string | null };
type Me = { id: string; name: string; email: string; role: string };

export type Boot =
  | { phase: "ready"; me: Me; categories: Category[]; members: Person[]; today: string; notes: Note[]; unread: number }
  | { phase: "password" }
  | { phase: "login" }
  | { phase: "error"; message: string };

export async function bootSession(): Promise<Boot> {
  try {
    const data = await api<{
      me: Me;
      categories: Category[];
      members: Person[];
      today: string;
      notifications: { unread: number; items: Note[] };
      csrfToken?: string;
    }>("/api/bootstrap");
    if (data.csrfToken) setCsrf(data.csrfToken);
    return {
      phase: "ready",
      me: data.me,
      categories: data.categories,
      members: data.members,
      today: data.today,
      notes: data.notifications.items,
      unread: data.notifications.unread,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && error.payload?.error === "password_change_required") {
      if (typeof error.payload.csrfToken === "string") setCsrf(error.payload.csrfToken);
      return { phase: "password" };
    }
    if (error instanceof ApiError && error.status === 401) return { phase: "login" };
    return { phase: "error", message: error instanceof Error ? error.message : "불러오지 못했습니다." };
  }
}
