import { NextResponse } from "next/server";
import { emptyStoredData, type StoredData } from "@personal-os/core";
import { readStore, writeStore } from "@/lib/server/local-store";

export const runtime = "nodejs";

type StoreImportBody = {
  secret?: string;
  store?: Partial<StoredData>;
};

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const store = await readStore();
  return NextResponse.json({ store });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as StoreImportBody | Partial<StoredData>;
  const auth = authorize(request, "secret" in body ? body.secret : undefined);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const payload = "store" in body && body.store ? body.store : body;
  const store = normalizeStore(payload);
  const saved = await writeStore(store);
  return NextResponse.json({ store: saved, imported: true });
}

function authorize(request: Request, bodySecret?: string): { ok: true } | { ok: false; status: number; message: string } {
  const configured = process.env.PERSONAL_OS_ADMIN_SECRET || process.env.FINANCE_IMPORT_SECRET;
  const provided = request.headers.get("x-personal-os-secret") ?? stringValue(bodySecret);
  if (!configured) return { ok: false, status: 500, message: "PERSONAL_OS_ADMIN_SECRET must be configured." };
  return provided === configured ? { ok: true } : { ok: false, status: 401, message: "Invalid admin secret." };
}

function normalizeStore(value: unknown): StoredData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyStoredData;
  return { ...emptyStoredData, ...(value as Partial<StoredData>) };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
