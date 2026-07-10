import { NextResponse } from "next/server";
import { buildFitnessSystem } from "@personal-os/core";
import { readStore } from "@/lib/server/local-store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ fitness: buildFitnessSystem(new Date(), store.fitnessPlan) });
}
