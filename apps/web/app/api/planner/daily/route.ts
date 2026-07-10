import { NextResponse } from "next/server";
import { buildDailyPlan } from "@personal-os/core";
import { readStore, saveDailyPlan } from "@/lib/server/local-store";

export async function POST() {
  const store = await readStore();
  const plan = buildDailyPlan(store.workTasks, store.manualRecords, store.profile.workIdentity);
  await saveDailyPlan(plan);
  return NextResponse.json({ plan });
}
