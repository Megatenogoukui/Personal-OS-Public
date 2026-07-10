import { NextResponse, type NextRequest } from "next/server";
import { expectedSessionToken, sessionCookieName } from "@/lib/auth-token";

const publicPaths = ["/login", "/api/auth/login", "/api/finance/import-message"];

export async function middleware(request: NextRequest) {
  if (!process.env.PERSONAL_OS_ACCESS_PASSWORD?.trim()) return NextResponse.next();
  if (publicPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) return NextResponse.next();

  const expected = await expectedSessionToken();
  const provided = request.cookies.get(sessionCookieName)?.value;
  if (provided && provided === expected) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|app.css).*)"],
};
