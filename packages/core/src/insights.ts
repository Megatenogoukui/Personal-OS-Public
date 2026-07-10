import type { AttentionGroup, AttentionItem, AttentionSeverity, ManualModule, ManualRecord, ModuleSnapshot, OperatingSnapshot, WorkTask, WorkTaskWithScore } from "./types";
import { enrichWorkTasks, isAssignedToMe } from "./work";

const moduleLabels: Record<ManualModule, string> = {
  finance: "Money",
  workout: "Training",
  diet: "Diet",
  reading: "Reading",
  goals: "Goals",
  habits: "Habits",
};

const moduleTargets: Record<ManualModule, { target: string; weeklyTarget: number; daily: boolean; unit: string }> = {
  finance: { target: "Daily spend review", weeklyTarget: 3, daily: false, unit: "INR" },
  workout: { target: "3 workouts/week", weeklyTarget: 3, daily: false, unit: "min" },
  diet: { target: "Meals and water daily", weeklyTarget: 7, daily: true, unit: "kcal" },
  reading: { target: "10 pages/day", weeklyTarget: 7, daily: true, unit: "pages" },
  goals: { target: "Weekly progress", weeklyTarget: 1, daily: false, unit: "%" },
  habits: { target: "Daily habit close", weeklyTarget: 7, daily: true, unit: "count" },
};

const groupRank: Record<AttentionGroup, number> = {
  now: 0,
  delegate: 1,
  follow_up: 2,
  money: 3,
  health: 4,
  learning: 5,
  planning: 6,
  data: 7,
};

const severityRank: Record<AttentionSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function buildOperatingSnapshot(tasks: WorkTask[], records: ManualRecord[], identity = "", now = new Date()): OperatingSnapshot {
  const attention = buildAttentionQueue(tasks, records, identity, now);
  const modules = buildModuleSnapshots(records, now);
  const enriched = enrichWorkTasks(tasks, identity, now);
  const risks = buildRisks(enriched, modules, identity);
  const wins = buildWins(enriched, modules, identity);
  const dataGaps = buildDataGaps(tasks, records, modules);
  const next = attention[0];

  return {
    generatedAt: now.toISOString(),
    nextAction: next ? `${next.action} (${next.title})` : "No urgent action. Keep logging work and life inputs.",
    attention,
    modules,
    risks,
    wins,
    dataGaps,
  };
}

export function buildAttentionQueue(tasks: WorkTask[], records: ManualRecord[], identity = "", now = new Date()): AttentionItem[] {
  const workItems = enrichWorkTasks(tasks, identity, now)
    .filter((task) => task.score > 0)
    .filter((task) => task.score >= 45 || task.deadlineBand === "overdue" || task.status === "blocked" || !task.feAssignee || !task.beAssignee)
    .map((task) => workTaskToAttention(task, identity, now));

  const moduleItems = buildModuleSnapshots(records, now)
    .filter((module) => module.status !== "good")
    .map((module) => moduleToAttention(module));

  const dataItems = buildDataAttention(tasks, records, now);

  return [...workItems, ...moduleItems, ...dataItems].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity];
    if (severityDelta !== 0) return severityDelta;
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    return groupRank[a.group] - groupRank[b.group];
  });
}

export function buildModuleSnapshots(records: ManualRecord[], now = new Date()): ModuleSnapshot[] {
  return (Object.keys(moduleLabels) as ManualModule[]).map((module) => {
    const moduleRecords = records.filter((record) => record.module === module);
    const todayRecords = moduleRecords.filter((record) => isSameDay(record.date, now));
    const weekRecords = moduleRecords.filter((record) => isInCurrentWeek(record.date, now));
    const monthRecords = moduleRecords.filter((record) => isInCurrentMonth(record.date, now));
    const totalAmount = monthRecords.reduce((sum, record) => sum + Math.abs(record.amount ?? 0), 0);
    const lastLoggedAt = moduleRecords.map((record) => record.date).sort().at(-1);
    const config = moduleTargets[module];
    const categories = summarizeCategories(monthRecords);
    const status = moduleStatus(module, todayRecords.length, weekRecords.length, lastLoggedAt, now);

    const snapshot: ModuleSnapshot = {
      module,
      label: moduleLabels[module],
      status,
      todayCount: todayRecords.length,
      weekCount: weekRecords.length,
      monthCount: monthRecords.length,
      target: config.target,
      totalAmount,
      unit: config.unit,
      insight: moduleInsight(module, todayRecords, weekRecords, monthRecords, totalAmount, categories),
      nextAction: moduleNextAction(module, status, todayRecords.length, weekRecords.length),
      categories,
    };
    if (lastLoggedAt) snapshot.lastLoggedAt = lastLoggedAt;
    return snapshot;
  });
}

export function groupAttentionByIntent(items: AttentionItem[]) {
  return {
    mustDo: items.filter((item) => item.group === "now" || item.severity === "critical").slice(0, 6),
    delegate: items.filter((item) => item.group === "delegate").slice(0, 6),
    followUp: items.filter((item) => item.group === "follow_up").slice(0, 6),
    personal: items.filter((item) => ["money", "health", "learning", "planning", "data"].includes(item.group)).slice(0, 6),
  };
}

function workTaskToAttention(task: WorkTaskWithScore, identity: string, now: Date): AttentionItem {
  const missingFe = !task.feAssignee;
  const missingBe = !task.beAssignee;
  const staleDays = task.updatedAt ? Math.floor((now.getTime() - new Date(task.updatedAt).getTime()) / 864e5) : undefined;
  const evidence = [
    task.timeLabel,
    `${task.status} / ${task.priority}`,
    missingFe && missingBe ? "FE and BE missing" : missingFe ? "FE missing" : missingBe ? "BE missing" : "Owners assigned",
    task.status === "blocked" ? "Blocked" : "",
    staleDays !== undefined && staleDays >= 3 ? `No update for ${staleDays} days` : "",
    identity && isAssignedToMe(task, identity) ? "Assigned to you" : "",
  ].filter(Boolean);

  const item: AttentionItem = {
    id: `work:${task.id}`,
    area: "work",
    group: attentionGroupForTask(task, now),
    severity: severityForScore(task.score),
    score: task.score,
    title: task.title,
    detail: `${task.externalId}${task.client ? ` · ${task.client}` : ""}${task.project ? ` · ${task.project}` : ""}`,
    action: task.recommendedAction,
    evidence,
    sourceId: task.id,
  };
  if (task.sourceUrl) item.href = task.sourceUrl;
  return item;
}

function attentionGroupForTask(task: WorkTaskWithScore, now: Date): AttentionGroup {
  if (!task.feAssignee || !task.beAssignee) return "delegate";
  if (task.status === "blocked" || task.status === "waiting") return "follow_up";
  if (task.updatedAt) {
    const staleDays = Math.floor((now.getTime() - new Date(task.updatedAt).getTime()) / 864e5);
    if (staleDays >= 3) return "follow_up";
  }
  return "now";
}

function moduleToAttention(module: ModuleSnapshot): AttentionItem {
  const group: AttentionGroup =
    module.module === "finance" ? "money" :
      module.module === "workout" || module.module === "diet" ? "health" :
        module.module === "reading" ? "learning" : "planning";

  return {
    id: `module:${module.module}`,
    area: module.module,
    group,
    severity: module.status === "missing" ? "high" : "medium",
    score: module.status === "missing" ? 75 : 45,
    title: `${module.label} needs input`,
    detail: module.insight,
    action: module.nextAction,
    evidence: [
      `${module.todayCount} today`,
      `${module.weekCount} this week`,
      module.lastLoggedAt ? `Last logged ${formatDate(module.lastLoggedAt)}` : "No logs yet",
    ],
  };
}

function buildDataAttention(tasks: WorkTask[], records: ManualRecord[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (tasks.length === 0) {
    items.push({
      id: "data:work",
      area: "system",
      group: "data",
      severity: "high",
      score: 70,
      title: "Work data is empty",
      detail: "A CSV or JSON import is needed before work insights are trustworthy.",
      action: "Import a task export from your work system.",
      evidence: ["0 work tasks loaded"],
    });
  }
  if (records.length === 0) {
    items.push({
      id: "data:life",
      area: "system",
      group: "data",
      severity: "medium",
      score: 40,
      title: "Life data is empty",
      detail: "Finance, health, reading, goals, and habits need at least a few entries for trend insights.",
      action: "Log one finance, diet, workout, reading, and habit entry today.",
      evidence: [`Checked ${formatDate(now.toISOString())}`],
    });
  }
  return items;
}

function moduleStatus(module: ManualModule, todayCount: number, weekCount: number, lastLoggedAt: string | undefined, now: Date): ModuleSnapshot["status"] {
  const config = moduleTargets[module];
  if (config.daily && todayCount === 0) return "missing";
  if (weekCount < config.weeklyTarget) return "watch";
  if (!lastLoggedAt) return "missing";
  const daysSinceLog = (now.getTime() - new Date(lastLoggedAt).getTime()) / 864e5;
  if (daysSinceLog >= 7) return "missing";
  if (daysSinceLog >= 3) return "watch";
  return "good";
}

function moduleInsight(module: ManualModule, today: ManualRecord[], week: ManualRecord[], month: ManualRecord[], total: number, categories: ModuleSnapshot["categories"]): string {
  if (module === "finance") {
    const biggest = categories[0];
    return biggest ? `Month movement is Rs ${Math.round(total).toLocaleString("en-IN")}; biggest category is ${biggest.label}.` : "No money movement logged this month.";
  }
  if (module === "workout") return `${week.length} workout log(s) this week. Target is ${moduleTargets.workout.target}.`;
  if (module === "diet") return `${today.length} meal/water log(s) today and ${week.length} this week.`;
  if (module === "reading") {
    const pages = week.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return `${pages.toLocaleString("en-IN")} reading unit(s) logged this week.`;
  }
  if (module === "goals") return `${week.length} goal progress update(s) this week.`;
  return `${today.length} habit log(s) today and ${week.length} this week.`;
}

function moduleNextAction(module: ManualModule, status: ModuleSnapshot["status"], todayCount: number, weekCount: number): string {
  if (module === "finance") return status === "good" ? "Review category drift and upcoming bills." : "Log today's spending and flag anything unusual.";
  if (module === "workout") return weekCount >= 3 ? "Keep recovery and next session clear." : "Schedule or complete the next workout.";
  if (module === "diet") return todayCount > 0 ? "Check protein, water, and remaining calories." : "Log meals, water, and protein for today.";
  if (module === "reading") return todayCount > 0 ? "Capture one useful note or action item." : "Read 10 pages and log the book.";
  if (module === "goals") return status === "good" ? "Pick the next concrete action." : "Update one goal with progress and next action.";
  return todayCount > 0 ? "Close remaining daily habits." : "Log today's habit completion.";
}

function buildRisks(tasks: WorkTaskWithScore[], modules: ModuleSnapshot[], identity: string): string[] {
  const risks: string[] = [];
  const overdue = tasks.filter((task) => task.deadlineBand === "overdue").length;
  const missingBoth = tasks.filter((task) => !task.feAssignee && !task.beAssignee).length;
  const assignedCritical = tasks.filter((task) => identity && isAssignedToMe(task, identity) && task.score >= 140).length;
  const missingModules = modules.filter((module) => module.status === "missing");
  if (overdue > 0) risks.push(`${overdue} work task(s) are overdue.`);
  if (missingBoth > 0) risks.push(`${missingBoth} task(s) have both FE and BE missing.`);
  if (assignedCritical > 0) risks.push(`${assignedCritical} critical task(s) are tied to your ownership.`);
  if (missingModules.length > 0) risks.push(`${missingModules.map((module) => module.label).join(", ")} data is missing today.`);
  return risks.slice(0, 5);
}

function buildWins(tasks: WorkTaskWithScore[], modules: ModuleSnapshot[], identity: string): string[] {
  const wins: string[] = [];
  const clearOwnership = tasks.filter((task) => task.feAssignee && task.beAssignee && task.lead).length;
  const goodModules = modules.filter((module) => module.status === "good");
  if (clearOwnership > 0) wins.push(`${clearOwnership} work task(s) have FE, BE, and lead ownership.`);
  if (identity) wins.push(`${tasks.filter((task) => isAssignedToMe(task, identity)).length} task(s) match your configured work identity.`);
  if (goodModules.length > 0) wins.push(`${goodModules.map((module) => module.label).join(", ")} are current enough for review.`);
  return wins.slice(0, 5);
}

function buildDataGaps(tasks: WorkTask[], records: ManualRecord[], modules: ModuleSnapshot[]): string[] {
  const gaps: string[] = [];
  if (tasks.length === 0) gaps.push("Work tasks have not been imported yet.");
  for (const module of modules) {
    if (module.monthCount === 0) gaps.push(`${module.label} has no entries this month.`);
  }
  if (records.length > 0 && modules.every((module) => module.monthCount > 0)) gaps.push("No major data gaps in logged modules.");
  return gaps.slice(0, 6);
}

function summarizeCategories(records: ManualRecord[]): ModuleSnapshot["categories"] {
  const byCategory = new Map<string, { count: number; amount: number }>();
  for (const record of records) {
    const key = record.category ?? "Uncategorized";
    const current = byCategory.get(key) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Math.abs(record.amount ?? 0);
    byCategory.set(key, current);
  }
  return [...byCategory.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .slice(0, 5);
}

function severityForScore(score: number): AttentionSeverity {
  if (score >= 140) return "critical";
  if (score >= 90) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function isSameDay(value: string, now: Date) {
  return value.slice(0, 10) === now.toISOString().slice(0, 10);
}

function isInCurrentWeek(value: string, now: Date) {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const date = new Date(value);
  return date >= start && date < end;
}

function isInCurrentMonth(value: string, now: Date) {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
