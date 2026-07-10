import type { DeadlineBand, WorkPriority, WorkStatus, WorkTask, WorkTaskWithScore } from "./types";

const doneStatuses = new Set<WorkStatus>(["done", "cancelled"]);

export function normalizeStatus(value: unknown): WorkStatus {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["new", "todo", "in_progress", "blocked", "waiting", "review", "qa", "done", "cancelled"].includes(raw)) {
    return raw as WorkStatus;
  }
  if (["open", "pending"].includes(raw)) return "todo";
  if (["wip", "doing"].includes(raw)) return "in_progress";
  if (["completed", "complete", "closed"].includes(raw)) return "done";
  return "unknown";
}

export function normalizePriority(value: unknown): WorkPriority {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["low", "medium", "high", "critical"].includes(raw)) return raw as WorkPriority;
  if (["p0", "urgent", "highest"].includes(raw)) return "critical";
  if (["p1", "important"].includes(raw)) return "high";
  if (["p2", "normal"].includes(raw)) return "medium";
  if (["p3"].includes(raw)) return "low";
  return "unknown";
}

export function deadlineBand(deadline: string | undefined, now = new Date()): DeadlineBand {
  if (!deadline) return "none";
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return "none";
  const hours = (target.getTime() - now.getTime()) / 36e5;
  if (hours < 0) return "overdue";
  if (hours <= 24) return "critical";
  if (hours <= 48) return "high";
  if (hours <= 168) return "upcoming";
  return "normal";
}

export function formatTimeLeft(deadline: string | undefined, now = new Date()): string {
  if (!deadline) return "No deadline";
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return "Invalid deadline";
  const diffMs = target.getTime() - now.getTime();
  const absHours = Math.abs(diffMs) / 36e5;
  if (diffMs < 0) {
    if (absHours < 24) return `Overdue by ${Math.max(1, Math.round(absHours))} hours`;
    return `Overdue by ${Math.max(1, Math.round(absHours / 24))} days`;
  }
  if (absHours < 2) return "Due now";
  if (absHours < 24) return `Due in ${Math.round(absHours)} hours`;
  if (absHours < 48) return "Due tomorrow";
  return `Due in ${Math.round(absHours / 24)} days`;
}

export function isAssignedToMe(task: WorkTask, identity: string): boolean {
  const needle = identity.trim().toLowerCase();
  if (!needle) return false;
  const candidates = [
    ...(task.assignedTo ?? []),
    task.feAssignee ?? "",
    task.beAssignee ?? "",
    task.lead ?? "",
  ];
  return candidates.some((item) => item.toLowerCase().includes(needle));
}

export function calculateWorkPriorityScore(task: WorkTask, identity = "", now = new Date()): number {
  if (doneStatuses.has(task.status)) return 0;
  let score = 0;
  const band = deadlineBand(task.deadline, now);
  if (band === "overdue") score += 100;
  if (band === "critical") score += 80;
  if (band === "high") score += 60;
  if (band === "upcoming") score += 30;
  if (task.priority === "critical") score += 70;
  if (task.priority === "high") score += 50;
  if (task.priority === "medium") score += 20;
  if (identity && isAssignedToMe(task, identity)) score += 40;
  const missingFe = !task.feAssignee;
  const missingBe = !task.beAssignee;
  if (missingFe) score += 30;
  if (missingBe) score += 30;
  if (missingFe && missingBe) score += 40;
  if (task.status === "blocked") score += 20;
  if (task.updatedAt) {
    const ageHours = (now.getTime() - new Date(task.updatedAt).getTime()) / 36e5;
    if (ageHours >= 72) score += 20;
  }
  return score;
}

export function scoreBand(score: number): WorkTaskWithScore["priority"] {
  if (score >= 140) return "critical";
  if (score >= 90) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function recommendedWorkAction(task: WorkTask, now = new Date()): string {
  if (!task.feAssignee && !task.beAssignee) return "Both FE and BE are missing. Assign engineers immediately.";
  if (!task.feAssignee) return deadlineBand(task.deadline, now) === "normal" ? "Assign FE owner." : "Assign FE before EOD.";
  if (!task.beAssignee) return deadlineBand(task.deadline, now) === "normal" ? "Assign BE owner." : "Assign BE before EOD.";
  if (task.status === "blocked") return "Unblock or escalate this task.";
  if (deadlineBand(task.deadline, now) === "overdue") return "Recover the overdue task and reset expectation.";
  if (deadlineBand(task.deadline, now) === "critical") return "Review progress now and close the next blocker.";
  if (task.status === "review") return "Review and move to QA or done.";
  return "Confirm next step and keep ownership clear.";
}

export function enrichWorkTasks(tasks: WorkTask[], identity = "", now = new Date()): WorkTaskWithScore[] {
  return tasks
    .map((task) => ({
      ...task,
      score: calculateWorkPriorityScore(task, identity, now),
      deadlineBand: deadlineBand(task.deadline, now),
      timeLabel: formatTimeLeft(task.deadline, now),
      recommendedAction: recommendedWorkAction(task, now),
    }))
    .sort((a, b) => b.score - a.score);
}

export function summarizeWork(tasks: WorkTask[], identity = "", now = new Date()) {
  const enriched = enrichWorkTasks(tasks, identity, now);
  return {
    total: tasks.length,
    assignedToMe: tasks.filter((task) => identity && isAssignedToMe(task, identity)).length,
    overdue: enriched.filter((task) => task.deadlineBand === "overdue").length,
    dueSoon: enriched.filter((task) => ["critical", "high"].includes(task.deadlineBand)).length,
    missingFe: tasks.filter((task) => !task.feAssignee && !doneStatuses.has(task.status)).length,
    missingBe: tasks.filter((task) => !task.beAssignee && !doneStatuses.has(task.status)).length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    completedRecently: tasks.filter((task) => task.status === "done").length,
    top: enriched.slice(0, 5),
  };
}

export function normalizeExternalTask(input: Record<string, unknown>, index = 0): WorkTask {
  const externalId = firstString(input, ["id", "_id", "request_id", "requestId", "task_id", "taskId", "ticket_id"]) || `task-${index + 1}`;
  const title = firstString(input, ["title", "name", "request_title", "requestTitle", "task", "summary", "subject"]) || `Task ${externalId}`;
  const deadline = firstString(input, ["deadline", "due_date", "dueDate", "target_date", "eta", "end_date"]);
  const updatedAt = firstString(input, ["updated_at", "updatedAt", "last_updated", "modified_at"]);
  const createdAt = firstString(input, ["created_at", "createdAt", "created_on"]);
  const assignedRaw = input.assigned_to ?? input.assignedTo ?? input.assignee ?? input.owner;

  const task: WorkTask = {
    id: `work:${externalId}`,
    externalId,
    title,
    status: normalizeStatus(firstString(input, ["status", "state", "stage"])),
    priority: normalizePriority(firstString(input, ["priority", "severity", "urgency"])),
    assignedTo: normalizePeople(assignedRaw),
    raw: input,
    lastSyncedAt: new Date().toISOString(),
  };

  assignIfPresent(task, "description", firstString(input, ["description", "details", "notes"]));
  assignIfPresent(task, "client", firstString(input, ["client", "client_name", "company", "customer"]));
  assignIfPresent(task, "project", firstString(input, ["project", "project_name", "module"]));
  assignIfPresent(task, "deadline", toIsoDate(deadline));
  assignIfPresent(task, "createdAt", toIsoDate(createdAt));
  assignIfPresent(task, "updatedAt", toIsoDate(updatedAt));
  assignIfPresent(task, "feAssignee", firstString(input, ["fe_assignee", "feAssignee", "frontend_assignee", "frontend", "FE"]));
  assignIfPresent(task, "beAssignee", firstString(input, ["be_assignee", "beAssignee", "backend_assignee", "backend", "BE"]));
  assignIfPresent(task, "lead", firstString(input, ["lead", "manager", "owner", "assigned_lead"]));
  assignIfPresent(task, "sourceUrl", firstString(input, ["source_url", "sourceUrl", "url", "link"]));

  return task;
}

function firstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object" && "name" in value && typeof value.name === "string") return value.name;
  }
  return undefined;
}

function normalizePeople(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizePeople(item));
  }
  if (typeof value === "object" && "name" in value && typeof value.name === "string") return [value.name];
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function assignIfPresent<K extends keyof WorkTask>(task: WorkTask, key: K, value: WorkTask[K] | undefined) {
  if (value !== undefined && value !== null && value !== "") {
    task[key] = value;
  }
}
