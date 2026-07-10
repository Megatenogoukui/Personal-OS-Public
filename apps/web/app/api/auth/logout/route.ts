import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth-token";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookieName, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
