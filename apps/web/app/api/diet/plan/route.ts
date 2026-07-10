import { NextResponse } from "next/server";
import { buildDietSystem } from "@personal-os/core";
import { readStore } from "@/lib/server/local-store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ plan: buildDietSystem(new Date(), store.dietPlan) });
}
