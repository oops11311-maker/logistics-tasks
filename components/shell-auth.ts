import { api, setCsrf } from "./api";

export async function sendLogin(username: string, password: string): Promise<{ ok: true; csrfToken?: string; mustChangePassword?: boolean } | { ok: false; message: string }> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await response.json()) as { message?: string; csrfToken?: string; mustChangePassword?: boolean };
    if (!response.ok) return { ok: false, message: data.message ?? "로그인하지 못했습니다." };
    if (data.csrfToken) setCsrf(data.csrfToken);
    return { ok: true, csrfToken: data.csrfToken, mustChangePassword: data.mustChangePassword };
  } catch {
    return { ok: false, message: "네트워크에 연결하지 못했습니다." };
  }
}

export async function sendPassword(currentPassword: string, newPassword: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const data = await api<{ csrfToken?: string }>("/api/auth/password", {
      method: "POST",
      mutate: true,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (data.csrfToken) setCsrf(data.csrfToken);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "비밀번호를 바꾸지 못했습니다." };
  }
}

export async function sendLogout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST", mutate: true, body: "{}" });
  } catch {
    /* 쿠키가 이미 없어도 로그인 화면으로 돌아간다. */
  }
  setCsrf("");
}
