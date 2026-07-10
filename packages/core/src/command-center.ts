import { buildDietSystem } from "./diet-plan";
import { buildFitnessSystem } from "./fitness-plan";
import { buildHabitAnalytics, ensureDefaultHabits, toISODate } from "./habits";
import { buildReadingAnalytics } from "./reading";
import type {
  DailyPlanItem,
  FinanceAccount,
  FinanceInvestment,
  FinanceTransaction,
  ManualRecord,
  StoredData,
} from "./types";
import { enrichWorkTasks, summarizeWork } from "./work";

export type CommandArea = "work" | "finance" | "workout" | "diet" | "reading" | "habits" | "review";

export type CommandPriority = DailyPlanItem["priority"];

export type CommandTone = "success" | "warning" | "danger" | "neutral";

export type CommandMetric = {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: CommandTone;
  href: string;
};

export type CommandAction = {
  id: string;
  area: CommandArea;
  priority: CommandPriority;
  title: string;
  detail: string;
  why: string;
  href: string;
};

export type CommandDomain = {
  id: CommandArea;
  label: string;
  href: string;
  score: number;
  status: "clear" | "watch" | "needs_action";
  metric: string;
  subMetric: string;
  summary: string;
  nextAction: string;
  tone: CommandTone;
};

export type CommandTimelineBlock = {
  id: string;
  time: string;
  area: CommandArea;
  priority: CommandPriority;
  title: string;
  detail: string;
  actions: string[];
  href: string;
};

export type CommandInsight = {
  id: string;
  area: CommandArea;
  title: string;
  detail: string;
  tone: CommandTone;
  href: string;
};

export type CommandCenter = {
  date: string;
  generatedAt: string;
  identity: string;
  headline: string;
  nextAction: CommandAction;
  focusScore: number;
  completionScore: number;
  metrics: CommandMetric[];
  actions: CommandAction[];
  domains: CommandDomain[];
  timeline: CommandTimelineBlock[];
  insights: CommandInsight[];
  analytics: {
    work: ReturnType<typeof summarizeWork>;
    finance: FinanceSummary;
    workout: WorkoutSummary;
    diet: DietSummary;
    reading: ReturnType<typeof buildReadingAnalytics>;
    habits: ReturnType<typeof buildHabitAnalytics>;
  };
};

export type FinanceSummary = {
  cash: number;
  creditOutstanding: number;
  investments: number;
  monthIncome: number;
  monthSpend: number;
  monthNet: number;
  savingsRate: number;
  dailyAverageSpend: number;
  projectedMonthSpend: number;
  upcomingBills: number;
  needsReview: number;
  topCategory: string;
};

export type WorkoutSummary = {
  todayTitle: string;
  todayType: string;
  stepsTarget: string;
  sessions7: number;
  sessions30: number;
  missed7: number;
  lastLoggedAt?: string;
  nextAction: string;
};

export type DietSummary = {
  todayLabel: string;
  morning: string;
  lunch: string;
  evening: string;
  dinner: string;
  caloriesTarget: string;
  proteinTarget: string;
  loggedToday: boolean;
  latestAdherence: number;
  outsideMeals7: number;
  nextAction: string;
};

const areaHref: Record<CommandArea, string> = {
  work: "/work",
  finance: "/finance",
  workout: "/workout",
  diet: "/diet",
  reading: "/reading",
  habits: "/habits",
  review: "/weekly-review",
};

export function buildCommandCenter(store: StoredData, identity = store.profile.workIdentity, now = new Date()): CommandCenter {
  const date = toISODate(now);
  const work = summarizeWork(store.workTasks, identity, now);
  const enrichedWork = enrichWorkTasks(store.workTasks, identity, now);
  const finance = buildFinanceSummary(store, now);
  const workout = buildWorkoutSummary(store.manualRecords, now, store.fitnessPlan);
  const diet = buildDietSummary(store.manualRecords, now, store.dietPlan);
  const reading = buildReadingAnalytics(store.readingBooks, store.readingLogs, date);
  const habits = buildHabitAnalytics(ensureDefaultHabits(store.habitDefinitions, now), store.habitLogs, date);

  const actions = buildActions({ work, enrichedWork, finance, workout, diet, reading, habits });
  if (!store.fitnessPlan) actions.unshift(action("setup:fitness", "workout", "high", "Configure your training plan", "The starter schedule is intentionally empty.", "Add your weekly split before relying on workout recommendations.", "/settings"));
  if (!store.dietPlan) actions.unshift(action("setup:diet", "diet", "high", "Configure your diet plan", "The starter meal structure has no personal targets.", "Add your own meals, targets, and practical alternatives.", "/settings"));
  if (!store.profile.configured) actions.unshift(action("setup:profile", "review", "critical", "Complete Personal OS setup", "Add your name, timezone, currency, and work identity.", "Your profile controls task matching and personal defaults across the dashboard.", "/settings"));
  const domains = buildDomains({ work, finance, workout, diet, reading, habits });
  const nextAction = actions[0] ?? {
    id: "review:start",
    area: "review" as const,
    priority: "medium" as const,
    title: "Start clean and keep the dashboard current",
    detail: "No urgent item is loaded yet.",
    why: "The system becomes useful when work, money, health, reading, and habits have current data.",
    href: "/planner",
  };
  const metrics = buildMetrics({ work, finance, workout, diet, reading, habits });
  const timeline = buildTimeline({ actions, workout, diet, reading, habits, finance });
  const insights = buildInsights({ work, finance, workout, diet, reading, habits });
  const completionScore = Math.round(domains.reduce((sum, item) => sum + item.score, 0) / Math.max(domains.length, 1));
  const focusScore = Math.max(0, Math.min(100, 100 - actions.filter((item) => item.priority === "critical").length * 18 - actions.filter((item) => item.priority === "high").length * 9));

  return {
    date,
    generatedAt: now.toISOString(),
    identity,
    headline: buildHeadline(nextAction, actions),
    nextAction,
    focusScore,
    completionScore,
    metrics,
    actions,
    domains,
    timeline,
    insights,
    analytics: { work, finance, workout, diet, reading, habits },
  };
}

function buildFinanceSummary(store: StoredData, now: Date): FinanceSummary {
  const monthTransactions = store.financeTransactions.filter((transaction) => isInCurrentMonth(transaction.date, now));
  const income = monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const spendTypes = new Set<FinanceTransaction["type"]>(["expense", "insurance_premium"]);
  const spend = monthTransactions.filter((transaction) => spendTypes.has(transaction.type)).reduce((sum, transaction) => sum + transaction.amount, 0);
  const daysPassed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cash = store.financeAccounts.filter((account) => account.type !== "credit_card" && account.type !== "investment").reduce((sum, account) => sum + account.balance, 0);
  const creditOutstanding = store.financeAccounts.filter((account) => account.type === "credit_card").reduce((sum, account) => sum + Math.max(0, account.balance), 0);
  const investments = store.financeInvestments.reduce((sum, investment) => sum + investment.currentValue, 0);
  const category = topExpenseCategory(monthTransactions, store.financeCategories);

  return {
    cash,
    creditOutstanding,
    investments,
    monthIncome: income,
    monthSpend: spend,
    monthNet: income - spend,
    savingsRate: income > 0 ? Math.round(((income - spend) / income) * 100) : 0,
    dailyAverageSpend: Math.round(spend / daysPassed),
    projectedMonthSpend: Math.round((spend / daysPassed) * daysInMonth),
    upcomingBills: countUpcomingBills(store.financeAccounts, store.financeInsurancePolicies, store.financeInvestments, now),
    needsReview: store.financeTransactions.filter((transaction) => transaction.needsReview).length,
    topCategory: category,
  };
}

function buildWorkoutSummary(records: ManualRecord[], now: Date, storedPlan: StoredData["fitnessPlan"]): WorkoutSummary {
  const fitness = buildFitnessSystem(now, storedPlan);
  const workoutRecords = records.filter((record) => record.module === "workout");
  const recent7 = workoutRecords.filter((record) => daysBetween(record.date, now) <= 7);
  const recent30 = workoutRecords.filter((record) => daysBetween(record.date, now) <= 30);
  const missed7 = recent7.filter((record) => record.status === "missed" || record.metadata?.missed === true).length;
  const lastLoggedAt = workoutRecords.map((record) => record.date).sort().at(-1);
  const todayLogged = workoutRecords.some((record) => record.date.slice(0, 10) === toISODate(now));
  const summary: WorkoutSummary = {
    todayTitle: fitness.today.title,
    todayType: fitness.today.type,
    stepsTarget: fitness.today.stepsTarget,
    sessions7: recent7.filter((record) => record.status !== "missed").length,
    sessions30: recent30.filter((record) => record.status !== "missed").length,
    missed7,
    nextAction: todayLogged ? "Use the logged session to recover, walk, and prepare tomorrow." : `Complete or mark ${fitness.today.title}.`,
  };
  if (lastLoggedAt) summary.lastLoggedAt = lastLoggedAt;
  return summary;
}

function buildDietSummary(records: ManualRecord[], now: Date, storedPlan: StoredData["dietPlan"]): DietSummary {
  const system = buildDietSystem(now, storedPlan);
  const dietRecords = records.filter((record) => record.module === "diet");
  const today = toISODate(now);
  const todayLog = dietRecords.find((record) => record.date.slice(0, 10) === today);
  const lastLog = dietRecords[0];
  const recent7 = dietRecords.filter((record) => daysBetween(record.date, now) <= 7);
  const outsideMeals7 = recent7.reduce((sum, record) => sum + numberFromMetadata(record, "outsideCount"), 0);
  return {
    todayLabel: system.today.label,
    morning: system.today.meals.filter((meal) => meal.slot === "pre_gym" || meal.slot === "post_gym" || meal.slot === "breakfast").map((meal) => meal.title).join(" · "),
    lunch: system.today.meals.find((meal) => meal.slot === "lunch")?.title ?? "Planned lunch",
    evening: system.today.eveningSnack,
    dinner: system.today.dinner,
    caloriesTarget: system.profile.calories,
    proteinTarget: system.profile.protein,
    loggedToday: Boolean(todayLog),
    latestAdherence: numberFromMetadata(todayLog ?? lastLog, "adherenceScore"),
    outsideMeals7,
    nextAction: todayLog ? "Check water, protein, and keep dinner portion controlled." : `Follow ${system.today.label} and log each meal honestly.`,
  };
}

function buildActions(input: {
  work: ReturnType<typeof summarizeWork>;
  enrichedWork: ReturnType<typeof enrichWorkTasks>;
  finance: FinanceSummary;
  workout: WorkoutSummary;
  diet: DietSummary;
  reading: ReturnType<typeof buildReadingAnalytics>;
  habits: ReturnType<typeof buildHabitAnalytics>;
}): CommandAction[] {
  const actions: CommandAction[] = [];

  for (const task of input.enrichedWork.slice(0, 6)) {
    if (task.score < 45) continue;
    const action: CommandAction = {
      id: `work:${task.id}`,
      area: "work",
      priority: task.score >= 140 ? "critical" : task.score >= 90 ? "high" : "medium",
      title: task.title,
      detail: `${task.externalId}${task.client ? ` · ${task.client}` : ""}${task.project ? ` · ${task.project}` : ""} · ${task.timeLabel}`,
      why: `${task.recommendedAction} ${task.timeLabel}.`,
      href: "/work",
    };
    actions.push(action);
  }

  if (input.work.total === 0) actions.push(action("work:connect", "work", "high", "Import work data", "Work is empty, so the dashboard cannot judge deadlines.", "Import a CSV or JSON export before trusting work priorities.", "/work"));
  if (input.finance.needsReview > 0) actions.push(action("finance:review", "finance", "high", "Review imported finance messages", `${input.finance.needsReview} transaction(s) need review.`, "Fix categories/accounts so spending analytics stay accurate.", "/finance"));
  if (input.finance.creditOutstanding > 0 && input.finance.upcomingBills > 0) actions.push(action("finance:card", "finance", "medium", "Check credit card bills", `${formatMoney(input.finance.creditOutstanding)} outstanding across cards.`, "Confirm upcoming bill dates and payment account.", "/finance"));
  if (!input.workout.lastLoggedAt || input.workout.sessions7 === 0) actions.push(action("workout:today", "workout", "medium", input.workout.nextAction, `${input.workout.todayTitle} · ${input.workout.stepsTarget}.`, "Training and steps are part of the fat-loss system.", "/workout"));
  if (!input.diet.loggedToday) actions.push(action("diet:log", "diet", "high", "Log and follow today's diet structure", `${input.diet.lunch} for lunch, ${input.diet.evening} in the evening.`, "Clean food today protects the weight-loss target.", "/diet"));
  if (input.reading.todayPages < input.reading.dailyTarget) actions.push(action("reading:target", "reading", "low", "Read and log pages", `${input.reading.dailyTarget - input.reading.todayPages} pages left for today's reading target.`, "Reading only counts when pages and one useful note are captured.", "/reading"));
  if (input.habits.mandatoryCount === 0) actions.push(action("habits:setup", "habits", "medium", "Create your core habits", "No mandatory habits are configured yet.", "A small mandatory baseline makes daily planning measurable.", "/habits"));
  else if (input.habits.mandatoryTodayRate < 100) actions.push(action("habits:close", "habits", "high", "Close mandatory habits", `${input.habits.mandatoryCompletedToday}/${input.habits.mandatoryCount} mandatory habits closed.`, "Your configured habits define the daily baseline.", "/habits"));
  actions.push(action("review:eod", "review", "medium", "End-of-day review", "Close blockers, spending, food, workout, reading, and habits.", "This creates tomorrow's clarity.", "/weekly-review"));

  return dedupeActions(actions).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function buildDomains(input: {
  work: ReturnType<typeof summarizeWork>;
  finance: FinanceSummary;
  workout: WorkoutSummary;
  diet: DietSummary;
  reading: ReturnType<typeof buildReadingAnalytics>;
  habits: ReturnType<typeof buildHabitAnalytics>;
}): CommandDomain[] {
  return [
    domain("work", "Work", "/work", scoreWork(input.work), `${input.work.dueSoon} due soon`, `${input.work.missingFe + input.work.missingBe} FE/BE gaps`, `${input.work.total} tasks loaded; ${input.work.overdue} overdue.`, input.work.total ? "Clear the top risk and delegation queue." : "Connect or import real work data."),
    domain("finance", "Finance", "/finance", scoreFinance(input.finance), formatMoney(input.finance.monthSpend), `${input.finance.savingsRate}% savings rate`, `Month net is ${formatMoney(input.finance.monthNet)}. Top spend: ${input.finance.topCategory}.`, input.finance.needsReview ? "Review imported transactions." : "Check bills, category drift, and SIPs."),
    domain("workout", "Workout", "/workout", scoreWorkout(input.workout), `${input.workout.sessions7} sessions`, input.workout.stepsTarget, `${input.workout.todayTitle} is today's training plan.`, input.workout.nextAction),
    domain("diet", "Diet", "/diet", scoreDiet(input.diet), input.diet.loggedToday ? "Logged" : "Missing", `${input.diet.latestAdherence || 0}% latest adherence`, `${input.diet.lunch}; evening ${input.diet.evening}.`, input.diet.nextAction),
    domain("reading", "Reading", "/reading", scoreReading(input.reading), `${input.reading.todayPages}/${input.reading.dailyTarget} pages`, `${input.reading.currentStreak}d streak`, `${input.reading.weekPages} pages this week; ${input.reading.notesCaptured} notes captured.`, input.reading.insights[0] ?? "Read, log pages, and capture one idea."),
    domain("habits", "Habits", "/habits", input.habits.mandatoryTodayRate, `${input.habits.mandatoryCompletedToday}/${input.habits.mandatoryCount}`, `${input.habits.overallStreak}d streak`, `${input.habits.rate30}% 30-day mandatory completion.`, input.habits.insights[0] ?? "Close mandatory habits today."),
  ];
}

function buildMetrics(input: {
  work: ReturnType<typeof summarizeWork>;
  finance: FinanceSummary;
  workout: WorkoutSummary;
  diet: DietSummary;
  reading: ReturnType<typeof buildReadingAnalytics>;
  habits: ReturnType<typeof buildHabitAnalytics>;
}): CommandMetric[] {
  return [
    metric("work", "Work critical", String(input.work.overdue + input.work.dueSoon), "Overdue or due within 48h", input.work.overdue > 0 ? "danger" : input.work.dueSoon > 0 ? "warning" : "success", "/work"),
    metric("delegation", "FE/BE gaps", String(input.work.missingFe + input.work.missingBe), "Lead ownership gaps", input.work.missingFe + input.work.missingBe > 0 ? "warning" : "success", "/work"),
    metric("cash", "Month net", formatMoney(input.finance.monthNet), "Income minus spend", input.finance.monthNet >= 0 ? "success" : "danger", "/finance"),
    metric("diet", "Diet today", input.diet.loggedToday ? "Logged" : "Missing", input.diet.nextAction, input.diet.loggedToday ? "success" : "warning", "/diet"),
    metric("fitness", "Training week", `${input.workout.sessions7}`, "Completed sessions in 7 days", input.workout.sessions7 >= 3 ? "success" : "warning", "/workout"),
    metric("habits", "Mandatory habits", `${input.habits.mandatoryTodayRate}%`, "Today completion", input.habits.mandatoryTodayRate === 100 ? "success" : "warning", "/habits"),
  ];
}

function buildTimeline(input: {
  actions: CommandAction[];
  workout: WorkoutSummary;
  diet: DietSummary;
  reading: ReturnType<typeof buildReadingAnalytics>;
  habits: ReturnType<typeof buildHabitAnalytics>;
  finance: FinanceSummary;
}): CommandTimelineBlock[] {
  const workCritical = input.actions.filter((item) => item.area === "work" && (item.priority === "critical" || item.priority === "high")).slice(0, 3);
  return [
    block("wake", "Morning", "habits", "high", input.habits.habits[0]?.name ?? "Review today's habits", "Start with the first habit in your configured routine.", input.habits.habits.slice(0, 3).map((habit) => habit.name).length ? input.habits.habits.slice(0, 3).map((habit) => habit.name) : ["Create a morning habit", "Set a movement target", "Add one learning habit"], "/habits"),
    block("gym", "Training", "workout", "high", input.workout.todayTitle, `${input.workout.todayType} · ${input.workout.stepsTarget}.`, ["Complete workout or mark missed", "Log sets, reps, and load", "Add recovery notes"], "/workout"),
    block("food-morning", "Morning meals", "diet", "high", input.diet.morning || "Follow your meal plan", "Use the configured meals and log any modification.", ["Follow the planned meal", "Record the actual portion", "Log changes honestly"], "/diet"),
    block("work-first", "Start work", "work", workCritical.length ? "critical" : "medium", workCritical[0]?.title ?? "Review work queue", workCritical[0]?.why ?? "Pick the highest-risk task from your imported work data.", workCritical.length ? workCritical.map((item) => item.title) : ["Check assigned tasks", "Check ownership gaps", "Check deadlines"], "/work"),
    block("lunch", "Lunch", "diet", "medium", input.diet.lunch, "Follow the planned lunch and log if modified or outside.", ["Eat the planned lunch", "Log calories and protein", "Record any substitution"], "/diet"),
    block("finance", "Afternoon", "finance", input.finance.needsReview ? "high" : "medium", "Finance quick review", `${input.finance.needsReview} needs review; projected spend ${formatMoney(input.finance.projectedMonthSpend)}.`, ["Review imported SMS transactions", "Check card/bill reminders", "Flag unusual spending"], "/finance"),
    block("evening", "Evening", "diet", "medium", input.diet.evening, "A planned snack reduces untracked choices.", ["Use the planned snack", "Finish remaining movement", "Log any alternative"], "/diet"),
    block("reading", "Night", "reading", "low", "Reading close", `${Math.max(0, input.reading.dailyTarget - input.reading.todayPages)} pages left today.`, ["Read pages", "Capture one note/highlight", "Log pages"], "/reading"),
    block("review", "Before sleep", "review", "medium", "End-of-day review", "Close the loop so tomorrow starts clear.", ["Mark habits", "Check diet/water", "Write tomorrow first action"], "/weekly-review"),
  ];
}

function buildInsights(input: {
  work: ReturnType<typeof summarizeWork>;
  finance: FinanceSummary;
  workout: WorkoutSummary;
  diet: DietSummary;
  reading: ReturnType<typeof buildReadingAnalytics>;
  habits: ReturnType<typeof buildHabitAnalytics>;
}): CommandInsight[] {
  const insights: CommandInsight[] = [];
  if (input.work.overdue > 0) insights.push(insight("work-overdue", "work", "Overdue work exists", `${input.work.overdue} work item(s) are overdue. Handle before routine work.`, "danger", "/work"));
  if (input.work.missingFe + input.work.missingBe > 0) insights.push(insight("work-owner", "work", "Delegation gap", `${input.work.missingFe + input.work.missingBe} FE/BE ownership gaps need lead action.`, "warning", "/work"));
  if (input.finance.projectedMonthSpend > input.finance.monthIncome && input.finance.monthIncome > 0) insights.push(insight("finance-spend", "finance", "Spending pressure", `Projected spend ${formatMoney(input.finance.projectedMonthSpend)} is above current income.`, "danger", "/finance"));
  if (input.finance.needsReview > 0) insights.push(insight("finance-review", "finance", "Finance data needs cleanup", `${input.finance.needsReview} imported transaction(s) need review.`, "warning", "/finance"));
  if (!input.diet.loggedToday) insights.push(insight("diet-missing", "diet", "Diet is not logged today", input.diet.nextAction, "warning", "/diet"));
  if (input.workout.sessions7 < 3) insights.push(insight("workout-low", "workout", "Training frequency is low", `${input.workout.sessions7} session(s) in the last 7 days.`, "warning", "/workout"));
  if (input.reading.todayPages < input.reading.dailyTarget) insights.push(insight("reading-target", "reading", "Reading target open", `${input.reading.dailyTarget - input.reading.todayPages} pages left.`, "neutral", "/reading"));
  if (input.habits.mandatoryTodayRate < 100) insights.push(insight("habits-open", "habits", "Mandatory habits open", `${input.habits.mandatoryCompletedToday}/${input.habits.mandatoryCount} completed today.`, "warning", "/habits"));
  if (insights.length === 0) insights.push(insight("clear", "review", "System is clean", "No major red flags. Execute the plan and close the day with review.", "success", "/planner"));
  return insights.slice(0, 8);
}

function action(id: string, area: CommandArea, priority: CommandPriority, title: string, detail: string, why: string, href: string): CommandAction {
  return { id, area, priority, title, detail, why, href };
}

function domain(id: CommandArea, label: string, href: string, score: number, metricValue: string, subMetric: string, summary: string, nextAction: string): CommandDomain {
  const tone = score >= 80 ? "success" : score >= 55 ? "warning" : "danger";
  return {
    id,
    label,
    href,
    score,
    status: score >= 80 ? "clear" : score >= 55 ? "watch" : "needs_action",
    metric: metricValue,
    subMetric,
    summary,
    nextAction,
    tone,
  };
}

function metric(id: string, label: string, value: string, helper: string, tone: CommandTone, href: string): CommandMetric {
  return { id, label, value, helper, tone, href };
}

function block(id: string, time: string, area: CommandArea, priority: CommandPriority, title: string, detail: string, actions: string[], href: string): CommandTimelineBlock {
  return { id, time, area, priority, title, detail, actions, href };
}

function insight(id: string, area: CommandArea, title: string, detail: string, tone: CommandTone, href: string): CommandInsight {
  return { id, area, title, detail, tone, href };
}

function buildHeadline(next: CommandAction, actions: CommandAction[]) {
  const critical = actions.filter((item) => item.priority === "critical").length;
  const high = actions.filter((item) => item.priority === "high").length;
  if (critical > 0) return `${critical} critical item${critical === 1 ? "" : "s"} before everything else.`;
  if (high > 0) return `${high} high-priority item${high === 1 ? "" : "s"} need attention today.`;
  return `Start with ${next.title}.`;
}

function scoreWork(work: ReturnType<typeof summarizeWork>) {
  if (work.total === 0) return 20;
  return clampScore(100 - work.overdue * 25 - work.dueSoon * 10 - (work.missingFe + work.missingBe) * 5 - work.blocked * 10);
}

function scoreFinance(finance: FinanceSummary) {
  return clampScore(80 + Math.min(20, finance.savingsRate) - finance.needsReview * 8 - (finance.creditOutstanding > 0 && finance.upcomingBills > 0 ? 10 : 0) - (finance.monthNet < 0 ? 20 : 0));
}

function scoreWorkout(workout: WorkoutSummary) {
  return clampScore(workout.sessions7 >= 4 ? 95 : workout.sessions7 >= 3 ? 85 : workout.sessions7 >= 1 ? 60 : 35);
}

function scoreDiet(diet: DietSummary) {
  return clampScore((diet.loggedToday ? 75 : 35) + Math.min(20, Math.round(diet.latestAdherence / 5)) - diet.outsideMeals7 * 4);
}

function scoreReading(reading: ReturnType<typeof buildReadingAnalytics>) {
  return clampScore((reading.todayPages >= reading.dailyTarget ? 80 : 45) + Math.min(20, reading.currentStreak * 4));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function priorityRank(priority: CommandPriority) {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function dedupeActions(actions: CommandAction[]) {
  const seen = new Set<string>();
  return actions.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function topExpenseCategory(transactions: FinanceTransaction[], categories: Array<{ id: string; name: string }>) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense" && transaction.type !== "insurance_premium") continue;
    const label = transaction.categoryId ? categoryNames.get(transaction.categoryId) ?? "Other" : "Other";
    totals.set(label, (totals.get(label) ?? 0) + transaction.amount);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No spend yet";
}

function countUpcomingBills(accounts: FinanceAccount[], insurancePolicies: Array<{ nextDueDate?: string; active: boolean }>, investments: FinanceInvestment[], now: Date) {
  const creditCards = accounts.filter((account) => account.type === "credit_card" && account.paymentDueDay && account.balance > 0);
  const cardBills = creditCards.filter((account) => daysUntilDay(account.paymentDueDay!, now) <= 10).length;
  const insurance = insurancePolicies.filter((policy) => policy.active && policy.nextDueDate && daysUntilDate(policy.nextDueDate, now) <= 14).length;
  const sips = investments.filter((investment) => investment.monthlySip && investment.nextSipDate && daysUntilDate(investment.nextSipDate, now) <= 7).length;
  return cardBills + insurance + sips;
}

function daysUntilDay(day: number, now: Date) {
  const target = new Date(now.getFullYear(), now.getMonth(), day);
  if (target.getTime() < startOfDay(now).getTime()) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - startOfDay(now).getTime()) / 86_400_000);
}

function daysUntilDate(value: string | undefined, now: Date) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(value.slice(0, 10));
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((target.getTime() - startOfDay(now).getTime()) / 86_400_000);
}

function isInCurrentMonth(value: string, now: Date) {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function daysBetween(value: string, now: Date) {
  const date = new Date(value.slice(0, 10));
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((startOfDay(now).getTime() - date.getTime()) / 86_400_000));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function numberFromMetadata(record: ManualRecord | undefined, key: string) {
  const value = record?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMoney(value: number) {
  const abs = Math.abs(Math.round(value));
  const formatted = `₹${abs.toLocaleString("en-IN")}`;
  return value < 0 ? `-${formatted}` : formatted;
}
