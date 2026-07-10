import { NextResponse } from "next/server";
import { normalizeExternalTask, type WorkTask } from "@personal-os/core";
import { addNotification, upsertWorkTasks } from "@/lib/server/local-store";

export async function POST(request: Request) {
  const body = (await request.json()) as { tasks?: Array<Record<string, unknown> | WorkTask>; source?: string };
  const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];
  if (rawTasks.length === 0) return NextResponse.json({ message: "Provide at least one task." }, { status: 400 });

  const normalized = rawTasks.map((task, index) => {
    if ("externalId" in task && "title" in task && "status" in task) return task as WorkTask;
    return normalizeExternalTask(task as Record<string, unknown>, index);
  });

  const tasks = await upsertWorkTasks(normalized);
  await addNotification({
    title: "Work data imported",
    body: `Imported ${normalized.length} task(s) from ${body.source?.trim() || "manual import"}.`,
    area: "work",
    priority: normalized.some((task) => !task.feAssignee || !task.beAssignee) ? "high" : "medium",
  });

  return NextResponse.json({ imported: normalized.length, tasks });
}
