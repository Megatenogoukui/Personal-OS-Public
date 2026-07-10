import { NextResponse } from "next/server";
import { z } from "zod";
import { addManualRecord, listManualRecords } from "@/lib/server/local-store";
import type { ManualModule, ManualRecord } from "@personal-os/core";

const modules = new Set(["finance", "workout", "diet", "reading", "goals", "habits"]);

const payloadSchema = z.object({
  date: z.string().min(4),
  title: z.string().min(1),
  amount: z.number().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!modules.has(module)) return NextResponse.json({ message: "Unknown module" }, { status: 404 });
  const records = await listManualRecords(module as ManualModule);
  return NextResponse.json({ records });
}

export async function POST(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!modules.has(module)) return NextResponse.json({ message: "Unknown module" }, { status: 404 });
  const payload = payloadSchema.parse(await request.json());
  const input: Omit<ManualRecord, "id" | "createdAt" | "updatedAt"> = {
    module: module as ManualModule,
    date: payload.date,
    title: payload.title,
  };
  if (payload.amount !== undefined) input.amount = payload.amount;
  if (payload.unit !== undefined) input.unit = payload.unit;
  if (payload.category !== undefined) input.category = payload.category;
  if (payload.status !== undefined) input.status = payload.status;
  if (payload.notes !== undefined) input.notes = payload.notes;
  if (payload.metadata !== undefined) input.metadata = payload.metadata;

  const record = await addManualRecord(input);
  return NextResponse.json({ record }, { status: 201 });
}
