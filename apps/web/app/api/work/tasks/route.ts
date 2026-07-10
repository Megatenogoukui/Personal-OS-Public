import { NextResponse } from "next/server";
import { normalizePriority, normalizeStatus, type WorkTask } from "@personal-os/core";
import { readStore, writeStore } from "@/lib/server/local-store";

type WorkTaskInput = Partial<Omit<WorkTask, "id" | "lastSyncedAt" | "raw">> & { id?: string };

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    tasks: store.workTasks,
    source: store.workTasks.length ? "your workspace" : "empty workspace",
  });
}

export async function POST(request: Request) {
  const input = (await request.json()) as WorkTaskInput;
  const title = input.title?.trim();
  if (!title) return NextResponse.json({ message: "Task title is required." }, { status: 400 });

  const store = await readStore();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const task = applyOptionalFields({
    id: `work:manual:${id}`,
    externalId: input.externalId?.trim() || `TASK-${store.workTasks.length + 1}`,
    title,
    status: normalizeStatus(input.status || "todo"),
    priority: normalizePriority(input.priority || "medium"),
    assignedTo: cleanPeople(input.assignedTo),
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    raw: { source: "manual" },
  }, input);
  const workTasks = [task, ...store.workTasks];
  await writeStore({ ...store, workTasks });
  return NextResponse.json({ task, tasks: workTasks }, { status: 201 });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as WorkTaskInput;
  if (!input.id) return NextResponse.json({ message: "Task ID is required." }, { status: 400 });

  const store = await readStore();
  const existing = store.workTasks.find((task) => task.id === input.id);
  if (!existing) return NextResponse.json({ message: "Task not found." }, { status: 404 });
  const title = input.title?.trim();
  if (!title) return NextResponse.json({ message: "Task title is required." }, { status: 400 });

  const updated = applyOptionalFields({
    ...existing,
    externalId: input.externalId?.trim() || existing.externalId,
    title,
    status: normalizeStatus(input.status || existing.status),
    priority: normalizePriority(input.priority || existing.priority),
    assignedTo: cleanPeople(input.assignedTo),
    updatedAt: new Date().toISOString(),
  }, input);
  const workTasks = store.workTasks.map((task) => task.id === updated.id ? updated : task);
  await writeStore({ ...store, workTasks });
  return NextResponse.json({ task: updated, tasks: workTasks });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Task ID is required." }, { status: 400 });
  const store = await readStore();
  if (!store.workTasks.some((task) => task.id === id)) return NextResponse.json({ message: "Task not found." }, { status: 404 });
  const workTasks = store.workTasks.filter((task) => task.id !== id);
  await writeStore({ ...store, workTasks });
  return NextResponse.json({ deleted: id, tasks: workTasks });
}

function cleanPeople(value: string[] | undefined) {
  return (value || []).map((person) => person.trim()).filter(Boolean);
}

function applyOptionalFields(task: WorkTask, input: WorkTaskInput): WorkTask {
  setOrDelete(task, "description", clean(input.description));
  setOrDelete(task, "client", clean(input.client));
  setOrDelete(task, "project", clean(input.project));
  setOrDelete(task, "deadline", dateOrUndefined(input.deadline));
  setOrDelete(task, "feAssignee", clean(input.feAssignee));
  setOrDelete(task, "beAssignee", clean(input.beAssignee));
  setOrDelete(task, "lead", clean(input.lead));
  setOrDelete(task, "sourceUrl", clean(input.sourceUrl));
  return task;
}

function setOrDelete<K extends "description" | "client" | "project" | "deadline" | "feAssignee" | "beAssignee" | "lead" | "sourceUrl">(task: WorkTask, key: K, value: string | undefined) {
  if (value) task[key] = value;
  else delete task[key];
}

function clean(value: string | null | undefined) {
  return value?.trim() || undefined;
}

function dateOrUndefined(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
