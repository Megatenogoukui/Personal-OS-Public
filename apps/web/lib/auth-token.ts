export const sessionCookieName = "personal_os_session";

export async function expectedSessionToken() {
  const password = process.env.PERSONAL_OS_ACCESS_PASSWORD?.trim();
  if (!password) return "";
  const secret = process.env.PERSONAL_OS_SECRET_KEY?.trim() || password;
  const bytes = new TextEncoder().encode(`personal-os:${password}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
