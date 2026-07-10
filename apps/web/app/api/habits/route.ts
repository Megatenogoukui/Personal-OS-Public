import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildHabitAnalytics,
  ensureDefaultHabits,
  habitLogId,
  toISODate,
  type HabitDefinition,
  type HabitLog,
  type ManualRecord,
  type StoredData,
} from "@personal-os/core";
import { readStore, writeStore } from "@/lib/server/local-store";

const habitSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["check", "number"]),
  targetValue: z.number().min(0),
  unit: z.string().min(1),
  category: z.string().min(1),
  mandatory: z.boolean().optional(),
  notes: z.string().optional(),
});

const patchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("habit"),
    id: z.string().min(1),
    patch: habitSchema.partial().extend({
      active: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal("log"),
    habitId: z.string().min(1),
    date: z.string().min(10),
    completed: z.boolean(),
    value: z.number().min(0),
    notes: z.string().optional(),
  }),
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") || toISODate(new Date())).slice(0, 10);
  const store = await readStore();
  const normalized = await ensureHabitStore(store);
  return NextResponse.json(buildResponse(normalized, date));
}

export async function POST(request: Request) {
  const payload = habitSchema.parse(await request.json());
  const store = await ensureHabitStore(await readStore());
  const now = new Date().toISOString();
  const habit: HabitDefinition = {
    id: `habit:${crypto.randomUUID()}`,
    name: payload.name,
    kind: payload.kind,
    targetValue: payload.targetValue,
    unit: payload.unit,
    category: payload.category,
    mandatory: payload.mandatory ?? false,
    active: true,
    sortOrder: nextSortOrder(store.habitDefinitions),
    createdAt: now,
    updatedAt: now,
  };
  if (payload.notes) habit.notes = payload.notes;
  const nextStore = { ...store, habitDefinitions: [...store.habitDefinitions, habit] };
  await writeStore(nextStore);
  return NextResponse.json(buildResponse(nextStore, toISODate(new Date())), { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = patchSchema.parse(await request.json());
  const store = await ensureHabitStore(await readStore());
  if (payload.type === "habit") {
    const now = new Date().toISOString();
    const habit = store.habitDefinitions.find((item) => item.id === payload.id);
    if (!habit) return NextResponse.json({ message: "Habit not found" }, { status: 404 });
    const habitDefinitions = store.habitDefinitions.map((item) => {
      if (item.id !== payload.id) return item;
      const next: HabitDefinition = { ...item, updatedAt: now };
      if (payload.patch.name !== undefined) next.name = payload.patch.name;
      if (payload.patch.kind !== undefined) next.kind = payload.patch.kind;
      if (payload.patch.targetValue !== undefined) next.targetValue = payload.patch.targetValue;
      if (payload.patch.unit !== undefined) next.unit = payload.patch.unit;
      if (payload.patch.category !== undefined) next.category = payload.patch.category;
      if (payload.patch.mandatory !== undefined) next.mandatory = payload.patch.mandatory;
      if (payload.patch.active !== undefined) next.active = payload.patch.active;
      if (payload.patch.sortOrder !== undefined) next.sortOrder = payload.patch.sortOrder;
      if (payload.patch.notes !== undefined) next.notes = payload.patch.notes;
      return next;
    });
    const nextStore = { ...store, habitDefinitions };
    await writeStore(nextStore);
    return NextResponse.json(buildResponse(nextStore, toISODate(new Date())));
  }

  const nextStore = upsertHabitLog(store, payload);
  const syncedStore = syncHabitManualSummary(nextStore, payload.date.slice(0, 10));
  await writeStore(syncedStore);
  return NextResponse.json(buildResponse(syncedStore, payload.date.slice(0, 10)));
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Missing habit id" }, { status: 400 });
  const store = await ensureHabitStore(await readStore());
  const habit = store.habitDefinitions.find((item) => item.id === id);
  if (!habit) return NextResponse.json({ message: "Habit not found" }, { status: 404 });
  if (habit.mandatory) return NextResponse.json({ message: "Mandatory habits cannot be deleted" }, { status: 400 });
  const now = new Date().toISOString();
  const nextStore = {
    ...store,
    habitDefinitions: store.habitDefinitions.map((item) => item.id === id ? { ...item, active: false, updatedAt: now } : item),
  };
  await writeStore(nextStore);
  return NextResponse.json(buildResponse(nextStore, toISODate(new Date())));
}

async function ensureHabitStore(store: StoredData): Promise<StoredData> {
  const currentHabits = store.habitDefinitions ?? [];
  const currentLogs = store.habitLogs ?? [];
  const habitDefinitions = ensureDefaultHabits(currentHabits);
  const normalized = { ...store, habitDefinitions, habitLogs: currentLogs };
  if (habitDefinitions.length !== currentHabits.length || !store.habitDefinitions || !store.habitLogs) {
    await writeStore(normalized);
  }
  return normalized;
}

function buildResponse(store: StoredData, date: string) {
  const analytics = buildHabitAnalytics(store.habitDefinitions ?? [], store.habitLogs ?? [], date.slice(0, 10));
  return {
    habits: store.habitDefinitions ?? [],
    logs: store.habitLogs ?? [],
    analytics,
  };
}

function nextSortOrder(habits: HabitDefinition[]) {
  return habits.reduce((max, habit) => Math.max(max, habit.sortOrder), 0) + 1;
}

function upsertHabitLog(store: StoredData, payload: Extract<z.infer<typeof patchSchema>, { type: "log" }>): StoredData {
  const now = new Date().toISOString();
  const date = payload.date.slice(0, 10);
  const id = habitLogId(payload.habitId, date);
  const existing = (store.habitLogs ?? []).find((log) => log.id === id);
  const log: HabitLog = {
    id,
    habitId: payload.habitId,
    date,
    completed: payload.completed,
    value: payload.value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (payload.notes) log.notes = payload.notes;
  const habitLogs = [log, ...(store.habitLogs ?? []).filter((item) => item.id !== id)];
  return { ...store, habitLogs };
}

function syncHabitManualSummary(store: StoredData, date: string): StoredData {
  const analytics = buildHabitAnalytics(store.habitDefinitions ?? [], store.habitLogs ?? [], date);
  const now = new Date().toISOString();
  const id = `habits:summary:${date}`;
  const record: ManualRecord = {
    id,
    module: "habits",
    date,
    title: "Daily mandatory habits",
    amount: analytics.mandatoryCompletedToday,
    unit: "habits",
    category: `${analytics.mandatoryTodayRate}% mandatory`,
    status: analytics.mandatoryCompletedToday === analytics.mandatoryCount ? "done" : "open",
    metadata: {
      kind: "habit_day_summary_v1",
      mandatoryCompleted: analytics.mandatoryCompletedToday,
      mandatoryTotal: analytics.mandatoryCount,
      overallStreak: analytics.overallStreak,
      rate: analytics.mandatoryTodayRate,
    },
    createdAt: store.manualRecords.find((item) => item.id === id)?.createdAt ?? now,
    updatedAt: now,
  };
  if (analytics.insights[0]) record.notes = analytics.insights[0];
  return {
    ...store,
    manualRecords: [record, ...store.manualRecords.filter((item) => item.id !== id)],
  };
}
