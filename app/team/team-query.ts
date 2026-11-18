export function teamQuery(params: URLSearchParams, view: string, month: string): string {
  const next = new URLSearchParams();
  for (const key of ["q", "assigneeId", "categoryId", "status", "priority", "due", "kind"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  if (view === "calendar") {
    const [year, mon] = month.split("-").map(Number);
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    next.set("dueFrom", `${month}-01`);
    next.set("dueTo", `${month}-${String(last).padStart(2, "0")}`);
    next.delete("due");
  }
  next.set("limit", "100");
  return next.toString();
}
