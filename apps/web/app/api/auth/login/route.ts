import { NextResponse } from "next/server";
import { expectedSessionToken, sessionCookieName } from "@/lib/auth-token";

export async function POST(request: Request) {
  const configured = process.env.PERSONAL_OS_ACCESS_PASSWORD?.trim();
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (configured && body.password !== configured) {
    return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  const token = await expectedSessionToken();
  if (token) {
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
