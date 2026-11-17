import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestWithHeaders, setupAccess } from "@/src/lib/auth";

export default async function LoginPage() {
  const incoming = await headers();
  const access = await setupAccess(requestWithHeaders(incoming));
  if (access.open) redirect("/setup");
  return null;
}
