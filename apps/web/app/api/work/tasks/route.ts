import { NextResponse } from "next/server";
import { readStore } from "@/lib/server/local-store";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    tasks: store.workTasks,
    source: store.workTasks.length ? "local store" : "empty store",
  });
}

