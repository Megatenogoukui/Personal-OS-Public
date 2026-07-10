import { buildAttentionQueue, groupAttentionByIntent } from "./insights";
import type { DailyPlan, DailyPlanItem, ManualRecord, WorkTask } from "./types";

export function buildDailyPlan(tasks: WorkTask[], records: ManualRecord[], identity = "", now = new Date()): DailyPlan {
  const today = now.toISOString().slice(0, 10);
  const attention = buildAttentionQueue(tasks, records, identity, now);
  const grouped = groupAttentionByIntent(attention);
  const items: DailyPlanItem[] = [];

  for (const item of attention.filter((item) => item.area !== "goals").slice(0, 8)) {
    const planItem: DailyPlanItem = {
      id: item.id,
      area: item.area === "system" ? "review" : item.area,
      label: item.title,
      reason: `${item.action} ${item.evidence.length > 0 ? `Evidence: ${item.evidence.join(" · ")}.` : item.detail}`,
      status: "todo",
      priority: item.severity,
    };
    if (item.sourceId) planItem.sourceId = item.sourceId;
    items.push(planItem);
  }

  addIfMissing(items, records, "finance", today, "Review today's spending", "No finance review logged today.", "medium");
  addIfMissing(items, records, "workout", today, "Log or complete today's workout", "Workout consistency is part of the operating system.", "medium");
  addIfMissing(items, records, "diet", today, "Log meals and water", "Diet data is missing for today.", "medium");
  addIfMissing(items, records, "reading", today, "Read at least 10 pages", "Reading progress needs a daily input.", "low");
  addIfMissing(items, records, "habits", today, "Close daily habits", "Habit logs make the weekly review useful.", "low");

  items.push({
    id: "review:eod",
    area: "review",
    label: "End-of-day review",
    reason: "Capture what moved, what is blocked, and tomorrow's first action.",
    status: "todo",
    priority: "medium",
  });

  const critical = items.find((item) => item.priority === "critical") ?? items.find((item) => item.area === "work");
  const delegateIds = new Set(grouped.delegate.map((item) => item.id));
  const followUpIds = new Set(grouped.followUp.map((item) => item.id));
  const personalIds = new Set(grouped.personal.map((item) => item.id));
  const reviewItems = items.filter((item) => item.area === "review");
  const sections = [
    {
      id: "must_do" as const,
      title: "Must do today",
      intent: "Protect deadlines, overdue work, and the highest-risk ownership gaps.",
      items: items.filter((item) => item.priority === "critical" || item.priority === "high").slice(0, 8),
    },
    {
      id: "delegate" as const,
      title: "Delegate",
      intent: "Clear FE/BE ownership and avoid lead bottlenecks.",
      items: items.filter((item) => delegateIds.has(item.id)),
    },
    {
      id: "follow_up" as const,
      title: "Follow up",
      intent: "Unblock stale, blocked, or waiting tasks.",
      items: items.filter((item) => followUpIds.has(item.id)),
    },
    {
      id: "personal" as const,
      title: "Personal systems",
      intent: "Keep money, health, reading, and habits current enough for review.",
      items: items.filter((item) => item.area !== "goals" && (personalIds.has(item.id) || ["finance", "workout", "diet", "reading", "habits"].includes(item.area))),
    },
    {
      id: "review" as const,
      title: "Review",
      intent: "Close the day with blockers, decisions, and tomorrow's first move.",
      items: reviewItems,
    },
  ].map((section) => ({
    ...section,
    items: dedupeItems(section.items),
  })).filter((section) => section.items.length > 0);

  const criticalCount = items.filter((item) => item.priority === "critical").length;
  const highCount = items.filter((item) => item.priority === "high").length;
  return {
    date: today,
    focus: critical ? critical.label : "Keep the day clean: work, health, money, reading, habits, and review.",
    summary: `${criticalCount} critical item(s), ${highCount} high-priority item(s), ${grouped.delegate.length} delegation item(s), ${grouped.followUp.length} follow-up item(s).`,
    items,
    sections,
    generatedAt: now.toISOString(),
  };
}

function addIfMissing(
  items: DailyPlanItem[],
  records: ManualRecord[],
  module: ManualRecord["module"],
  date: string,
  label: string,
  reason: string,
  priority: DailyPlanItem["priority"],
) {
  const hasToday = records.some((record) => record.module === module && record.date.slice(0, 10) === date);
  if (hasToday) return;
  items.push({
    id: `${module}:today`,
    area: module === "workout" || module === "diet" ? module : module,
    label,
    reason,
    status: "todo",
    priority,
  });
}

function dedupeItems(items: DailyPlanItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
