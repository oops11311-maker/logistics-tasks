import { NextResponse, type NextRequest } from "next/server";
import { setupOwner } from "./src/lib/setup-gate";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" && request.nextUrl.searchParams.get("form") !== "1") {
    const owner = await setupOwner(request);
    if (owner.ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  if (
    pathname.startsWith("/api")
    || pathname.startsWith("/_next")
    || pathname.startsWith("/icons")
    || pathname === "/login"
    || pathname === "/setup"
    || pathname === "/sw.js"
    || pathname === "/manifest.webmanifest"
    || pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  if (!request.cookies.get("logistics_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
