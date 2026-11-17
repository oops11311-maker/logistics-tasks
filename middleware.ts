import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api")
    || pathname.startsWith("/_next")
    || pathname.startsWith("/icons")
    || pathname === "/login"
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
