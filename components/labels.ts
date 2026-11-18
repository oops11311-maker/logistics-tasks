export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function roleLabel(role: string): string {
  if (role === "admin") return "관리자";
  if (role === "manager") return "매니저";
  if (role === "member") return "멤버";
  if (role === "viewer") return "뷰어";
  return role;
}

export function canWrite(role: string): boolean {
  return role === "admin" || role === "manager" || role === "member";
}
