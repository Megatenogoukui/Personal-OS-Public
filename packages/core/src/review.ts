import { buildModuleSnapshots, buildOperatingSnapshot } from "./insights";
import { summarizeWork } from "./work";
import type { ManualModule, ManualRecord, WeeklyReview, WorkTask } from "./types";

export function buildWeeklyReview(tasks: WorkTask[], records: ManualRecord[], identity = "", now = new Date()): WeeklyReview {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const scopedRecords = records.filter((record) => {
    const date = new Date(record.date);
    return date >= start && date <= end;
  });
  const work = summarizeWork(tasks, identity, now);
  const operating = buildOperatingSnapshot(tasks, records, identity, now);
  const modules = buildModuleSnapshots(records, now);
  const byModule = groupByModule(scopedRecords);
  const financeSpend = (byModule.finance ?? []).reduce((sum, item) => sum + Math.abs(item.amount ?? 0), 0);
  const workouts = byModule.workout?.length ?? 0;
  const meals = byModule.diet?.length ?? 0;
  const reading = byModule.reading?.reduce((sum, item) => sum + (item.amount ?? 0), 0) ?? 0;
  const missingModules = modules.filter((module) => module.status === "missing").map((module) => module.label);
  const watchModules = modules.filter((module) => module.status === "watch").map((module) => module.label);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    summary: `${operating.nextAction} This week has ${work.overdue} overdue work task(s), ${work.dueSoon} due-soon task(s), Rs ${Math.round(financeSpend).toLocaleString()} tracked spend, ${workouts} workout log(s), and ${reading} reading unit(s).`,
    work: [
      `${work.assignedToMe} task(s) match your configured work identity.`,
      `${work.missingFe} active task(s) are missing FE.`,
      `${work.missingBe} active task(s) are missing BE.`,
      `${work.blocked} task(s) are blocked.`,
      ...operating.risks.filter((item) => item.toLowerCase().includes("work") || item.toLowerCase().includes("task")),
    ],
    finance: [
      `${byModule.finance?.length ?? 0} finance entries logged.`,
      `Tracked spend or movement: Rs ${Math.round(financeSpend).toLocaleString()}.`,
      modules.find((module) => module.module === "finance")?.insight ?? "Finance snapshot unavailable.",
    ],
    health: [
      `${workouts} workout entries logged.`,
      `${meals} diet entries logged.`,
      modules.find((module) => module.module === "workout")?.insight ?? "Workout snapshot unavailable.",
      modules.find((module) => module.module === "diet")?.insight ?? "Diet snapshot unavailable.",
    ],
    reading: [
      `${byModule.reading?.length ?? 0} reading sessions logged.`,
      `${reading} pages/minutes tracked depending on your entry unit.`,
      modules.find((module) => module.module === "reading")?.nextAction ?? "Read and log one useful note.",
    ],
    planning: [
      `${byModule.habits?.length ?? 0} habit entries logged.`,
      `${byModule.goals?.length ?? 0} goal progress entries logged.`,
      missingModules.length > 0 ? `Missing today: ${missingModules.join(", ")}.` : "No required daily module is completely missing.",
      watchModules.length > 0 ? `Watch: ${watchModules.join(", ")}.` : "No weekly module is in watch state.",
    ],
    nextWeekFocus: [
      work.overdue > 0 ? "Recover overdue work first." : "Keep urgent work visible before it becomes overdue.",
      work.missingFe + work.missingBe > 0 ? "Assign FE/BE earlier in the request lifecycle." : "Maintain clear ownership on new requests.",
      workouts < 3 ? "Schedule workouts before work pressure fills the day." : "Keep training consistency stable.",
      operating.dataGaps[0] ?? "Keep all modules current enough for next week's review.",
    ],
    generatedAt: now.toISOString(),
  };
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function groupByModule(records: ManualRecord[]): Partial<Record<ManualModule, ManualRecord[]>> {
  return records.reduce<Partial<Record<ManualModule, ManualRecord[]>>>((acc, record) => {
    acc[record.module] = [...(acc[record.module] ?? []), record];
    return acc;
  }, {});
}
