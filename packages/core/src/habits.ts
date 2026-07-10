import type { HabitDefinition, HabitLog, ISODateString } from "./types";

export type HabitWithStats = HabitDefinition & {
  todayLog?: HabitLog;
  completedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  completedLast7: number;
  completedLast30: number;
  rate7: number;
  rate30: number;
  lastCompletedAt?: ISODateString;
};

export type HabitDayStat = {
  date: ISODateString;
  label: string;
  completed: number;
  mandatoryCompleted: number;
  total: number;
  mandatoryTotal: number;
  rate: number;
  mandatoryRate: number;
  allMandatoryComplete: boolean;
};

export type HabitAnalytics = {
  date: ISODateString;
  activeCount: number;
  mandatoryCount: number;
  completedToday: number;
  mandatoryCompletedToday: number;
  todayRate: number;
  mandatoryTodayRate: number;
  overallStreak: number;
  bestOverallStreak: number;
  rate7: number;
  rate30: number;
  dayStats: HabitDayStat[];
  habits: HabitWithStats[];
  insights: string[];
};

export const defaultHabitDefinitions: HabitDefinition[] = [];

export function ensureDefaultHabits(habits: HabitDefinition[], now = new Date()): HabitDefinition[] {
  const byId = new Map(habits.map((item) => [item.id, item]));
  const timestamp = now.toISOString();
  for (const defaultHabit of defaultHabitDefinitions) {
    if (!byId.has(defaultHabit.id)) {
      byId.set(defaultHabit.id, { ...defaultHabit, createdAt: timestamp, updatedAt: timestamp });
    }
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function buildHabitAnalytics(habits: HabitDefinition[], logs: HabitLog[], date = toISODate(new Date())): HabitAnalytics {
  const activeHabits = habits.filter((habit) => habit.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const mandatoryHabits = activeHabits.filter((habit) => habit.mandatory);
  const dayStats = buildDayStats(activeHabits, logs, date, 30);
  const today = dayStats[dayStats.length - 1] ?? emptyDayStat(date, activeHabits);
  const habitsWithStats = activeHabits.map((habit) => buildHabitStats(habit, logs, date));
  const overallStreak = countOverallStreak(dayStats);
  const bestOverallStreak = countBestOverallStreak(dayStats);
  const last7 = dayStats.slice(-7);
  const rate7 = average(last7.map((day) => day.mandatoryRate));
  const rate30 = average(dayStats.map((day) => day.mandatoryRate));

  return {
    date,
    activeCount: activeHabits.length,
    mandatoryCount: mandatoryHabits.length,
    completedToday: today.completed,
    mandatoryCompletedToday: today.mandatoryCompleted,
    todayRate: today.rate,
    mandatoryTodayRate: today.mandatoryRate,
    overallStreak,
    bestOverallStreak,
    rate7,
    rate30,
    dayStats,
    habits: habitsWithStats,
    insights: buildInsights(habitsWithStats, today, overallStreak, rate7, rate30),
  };
}

export function toISODate(date: Date): ISODateString {
  return date.toISOString().slice(0, 10);
}

export function shiftISODate(date: ISODateString, deltaDays: number): ISODateString {
  const next = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return toISODate(next);
}

export function habitLogId(habitId: string, date: ISODateString) {
  return `habit-log:${habitId}:${date.slice(0, 10)}`;
}

function buildHabitStats(habit: HabitDefinition, logs: HabitLog[], date: ISODateString): HabitWithStats {
  const byDate = logsByDate(logs.filter((log) => log.habitId === habit.id));
  const todayLog = byDate.get(date);
  const completedDates = new Set([...byDate.values()].filter((log) => log.completed).map((log) => log.date.slice(0, 10)));
  const lastCompletedAt = [...completedDates].sort().at(-1);
  const completedLast7 = countCompletedInWindow(completedDates, date, 7);
  const completedLast30 = countCompletedInWindow(completedDates, date, 30);
  const result: HabitWithStats = {
    ...habit,
    completedToday: Boolean(todayLog?.completed),
    currentStreak: countCurrentStreak(completedDates, date),
    bestStreak: countBestStreak(completedDates),
    completedLast7,
    completedLast30,
    rate7: Math.round((completedLast7 / 7) * 100),
    rate30: Math.round((completedLast30 / 30) * 100),
  };
  if (todayLog) result.todayLog = todayLog;
  if (lastCompletedAt) result.lastCompletedAt = lastCompletedAt;
  return result;
}

function buildDayStats(habits: HabitDefinition[], logs: HabitLog[], date: ISODateString, days: number): HabitDayStat[] {
  const byHabitAndDate = new Map(logs.map((log) => [`${log.habitId}:${log.date.slice(0, 10)}`, log]));
  const mandatory = habits.filter((habit) => habit.mandatory);
  return Array.from({ length: days }, (_, index) => {
    const day = shiftISODate(date, index - days + 1);
    const completed = habits.filter((habit) => byHabitAndDate.get(`${habit.id}:${day}`)?.completed).length;
    const mandatoryCompleted = mandatory.filter((habit) => byHabitAndDate.get(`${habit.id}:${day}`)?.completed).length;
    const rate = habits.length ? Math.round((completed / habits.length) * 100) : 0;
    const mandatoryRate = mandatory.length ? Math.round((mandatoryCompleted / mandatory.length) * 100) : 0;
    return {
      date: day,
      label: day.slice(5),
      completed,
      mandatoryCompleted,
      total: habits.length,
      mandatoryTotal: mandatory.length,
      rate,
      mandatoryRate,
      allMandatoryComplete: mandatory.length > 0 && mandatoryCompleted === mandatory.length,
    };
  });
}

function emptyDayStat(date: ISODateString, habits: HabitDefinition[]): HabitDayStat {
  const mandatoryTotal = habits.filter((habit) => habit.mandatory).length;
  return {
    date,
    label: date.slice(5),
    completed: 0,
    mandatoryCompleted: 0,
    total: habits.length,
    mandatoryTotal,
    rate: 0,
    mandatoryRate: 0,
    allMandatoryComplete: false,
  };
}

function countCurrentStreak(completedDates: Set<string>, date: ISODateString) {
  let streak = 0;
  let cursor = date;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

function countBestStreak(completedDates: Set<string>) {
  const dates = [...completedDates].sort();
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of dates) {
    current = previous && shiftISODate(previous, 1) === date ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

function countOverallStreak(days: HabitDayStat[]) {
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (!days[index]?.allMandatoryComplete) break;
    streak += 1;
  }
  return streak;
}

function countBestOverallStreak(days: HabitDayStat[]) {
  let best = 0;
  let current = 0;
  for (const day of days) {
    current = day.allMandatoryComplete ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function countCompletedInWindow(completedDates: Set<string>, date: ISODateString, days: number) {
  let count = 0;
  for (let offset = 0; offset < days; offset += 1) {
    if (completedDates.has(shiftISODate(date, -offset))) count += 1;
  }
  return count;
}

function logsByDate(logs: HabitLog[]) {
  const byDate = new Map<string, HabitLog>();
  for (const log of logs) byDate.set(log.date.slice(0, 10), log);
  return byDate;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildInsights(habits: HabitWithStats[], today: HabitDayStat, overallStreak: number, rate7: number, rate30: number) {
  const missingMandatory = habits.filter((habit) => habit.mandatory && !habit.completedToday);
  const weakest = [...habits].sort((a, b) => a.rate30 - b.rate30)[0];
  const insights: string[] = [];
  if (missingMandatory.length === 0 && habits.length > 0) {
    insights.push(`All mandatory habits are closed today. Overall streak is ${overallStreak} day${overallStreak === 1 ? "" : "s"}.`);
  } else if (missingMandatory.length > 0) {
    insights.push(`Close ${missingMandatory.map((habit) => habit.name).join(", ")} to finish today's mandatory system.`);
  }
  if (weakest && weakest.rate30 < 70) {
    insights.push(`${weakest.name} is the weakest 30-day habit at ${weakest.rate30}%. Make it easier or move it earlier in the day.`);
  }
  if (rate7 < rate30) {
    insights.push(`Last 7 days (${rate7}%) are below the 30-day baseline (${rate30}%). Tighten the routine this week.`);
  }
  if (today.mandatoryRate >= 80 && today.mandatoryRate < 100) {
    insights.push("You are close today. Finish the last mandatory habit before adding optional work.");
  }
  return insights.slice(0, 4);
}
