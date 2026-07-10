import { NextResponse } from "next/server";
import { buildWeeklyReview } from "@personal-os/core";
import { readStore, saveWeeklyReview } from "@/lib/server/local-store";

export async function POST() {
  const store = await readStore();
  const review = buildWeeklyReview(store.workTasks, store.manualRecords, store.profile.workIdentity);
  await saveWeeklyReview(review);
  return NextResponse.json({ review });
}
