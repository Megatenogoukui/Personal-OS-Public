import type { DietSystem } from "./diet-plan";
import type { FitnessSystem } from "./fitness-plan";

export type ISODateString = string;

export type PersonalOSProfile = {
  displayName: string;
  workIdentity: string;
  timezone: string;
  currency: string;
  configured: boolean;
};

export type WorkStatus =
  | "new"
  | "todo"
  | "in_progress"
  | "blocked"
  | "waiting"
  | "review"
  | "qa"
  | "done"
  | "cancelled"
  | "unknown";

export type WorkPriority = "low" | "medium" | "high" | "critical" | "unknown";

export type WorkTask = {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  client?: string;
  project?: string;
  status: WorkStatus;
  priority: WorkPriority;
  deadline?: ISODateString;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  assignedTo?: string[];
  feAssignee?: string | null;
  beAssignee?: string | null;
  lead?: string | null;
  sourceUrl?: string;
  raw?: Record<string, unknown>;
  lastSyncedAt?: ISODateString;
};

export type DeadlineBand = "overdue" | "critical" | "high" | "upcoming" | "normal" | "none";

export type WorkTaskWithScore = WorkTask & {
  score: number;
  deadlineBand: DeadlineBand;
  timeLabel: string;
  recommendedAction: string;
};

export type ManualModule = "finance" | "workout" | "diet" | "reading" | "goals" | "habits";

export type ManualRecord = {
  id: string;
  module: ManualModule;
  date: ISODateString;
  title: string;
  amount?: number;
  unit?: string;
  category?: string;
  status?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type HabitKind = "check" | "number";

export type HabitDefinition = {
  id: string;
  name: string;
  kind: HabitKind;
  targetValue: number;
  unit: string;
  category: string;
  mandatory: boolean;
  active: boolean;
  sortOrder: number;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type HabitLog = {
  id: string;
  habitId: string;
  date: ISODateString;
  completed: boolean;
  value: number;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ReadingBookStatus = "want_to_read" | "reading" | "finished" | "paused";

export type ReadingBookPriority = "low" | "medium" | "high";

export type ReadingBook = {
  id: string;
  title: string;
  author?: string;
  category?: string;
  status: ReadingBookStatus;
  totalPages: number;
  currentPage: number;
  startDate?: ISODateString;
  targetDate?: ISODateString;
  finishedDate?: ISODateString;
  rating?: number;
  priority: ReadingBookPriority;
  notes?: string;
  keyLessons?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ReadingLog = {
  id: string;
  bookId?: string;
  date: ISODateString;
  pagesRead: number;
  minutesRead: number;
  fromPage?: number;
  toPage?: number;
  note?: string;
  highlight?: string;
  actionItem?: string;
  source?: "manual" | "imported";
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FinanceAccountType = "bank" | "cash" | "wallet" | "credit_card" | "investment";

export type FinanceAccount = {
  id: string;
  name: string;
  type: FinanceAccountType;
  currency: string;
  balance: number;
  institution?: string;
  last4?: string;
  creditLimit?: number;
  statementDay?: number;
  paymentDueDay?: number;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FinanceCategoryType = "income" | "expense" | "investment" | "insurance" | "transfer" | "any";

export type FinanceCategory = {
  id: string;
  name: string;
  type: FinanceCategoryType;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FinanceTransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "credit_card_payment"
  | "investment_contribution"
  | "insurance_premium";

export type FinanceTransaction = {
  id: string;
  date: ISODateString;
  type: FinanceTransactionType;
  title: string;
  amount: number;
  currency: string;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  merchant?: string;
  source?: "manual" | "iphone_message" | "sms" | "email" | "csv" | "system";
  needsReview?: boolean;
  rawText?: string;
  importHash?: string;
  confidence?: number;
  importedAt?: ISODateString;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FinanceFrequency = "monthly" | "quarterly" | "half_yearly" | "yearly" | "one_time";

export type FinanceInsurancePolicy = {
  id: string;
  name: string;
  provider?: string;
  policyType: string;
  premium: number;
  currency: string;
  frequency: FinanceFrequency;
  nextDueDate?: ISODateString;
  accountId?: string;
  notes?: string;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FinanceInvestment = {
  id: string;
  name: string;
  schemeCode?: string;
  investmentType: string;
  investedAmount: number;
  currentValue: number;
  currency: string;
  units?: number;
  monthlySip?: number;
  sipDay?: number;
  nextSipDate?: ISODateString;
  lastSipAppliedDate?: ISODateString;
  startDate?: ISODateString;
  maturityDate?: ISODateString;
  interestRate?: number;
  maturityAmount?: number;
  latestNav?: number;
  latestNavDate?: string;
  returnAmount?: number;
  returnPercent?: number;
  accountId?: string;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DailyPlanItem = {
  id: string;
  area: "work" | "finance" | "workout" | "diet" | "reading" | "goals" | "habits" | "review";
  label: string;
  reason: string;
  status: "todo" | "done" | "skipped" | "deferred" | "blocked" | "delegated";
  priority: "low" | "medium" | "high" | "critical";
  sourceId?: string;
};

export type DailyPlanSection = {
  id: "must_do" | "delegate" | "follow_up" | "personal" | "review";
  title: string;
  intent: string;
  items: DailyPlanItem[];
};

export type DailyPlan = {
  date: ISODateString;
  focus: string;
  summary: string;
  items: DailyPlanItem[];
  sections: DailyPlanSection[];
  generatedAt: ISODateString;
};

export type AttentionSeverity = "low" | "medium" | "high" | "critical";

export type AttentionGroup =
  | "now"
  | "delegate"
  | "follow_up"
  | "money"
  | "health"
  | "learning"
  | "planning"
  | "data";

export type AttentionItem = {
  id: string;
  area: DailyPlanItem["area"] | "system";
  group: AttentionGroup;
  severity: AttentionSeverity;
  score: number;
  title: string;
  detail: string;
  action: string;
  evidence: string[];
  href?: string;
  sourceId?: string;
};

export type ModuleSnapshot = {
  module: ManualModule;
  label: string;
  status: "good" | "watch" | "missing";
  todayCount: number;
  weekCount: number;
  monthCount: number;
  target: string;
  totalAmount: number;
  unit: string;
  lastLoggedAt?: ISODateString;
  insight: string;
  nextAction: string;
  categories: Array<{ label: string; count: number; amount: number }>;
};

export type OperatingSnapshot = {
  generatedAt: ISODateString;
  nextAction: string;
  attention: AttentionItem[];
  modules: ModuleSnapshot[];
  risks: string[];
  wins: string[];
  dataGaps: string[];
};

export type WeeklyReview = {
  weekStart: ISODateString;
  weekEnd: ISODateString;
  summary: string;
  work: string[];
  finance: string[];
  health: string[];
  reading: string[];
  planning: string[];
  nextWeekFocus: string[];
  generatedAt: ISODateString;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  area: DailyPlanItem["area"] | "system";
  priority: DailyPlanItem["priority"];
  scheduledFor?: ISODateString;
  readAt?: ISODateString;
  createdAt: ISODateString;
};

export type StoredData = {
  profile: PersonalOSProfile;
  dietPlan?: DietSystem;
  fitnessPlan?: FitnessSystem;
  workTasks: WorkTask[];
  manualRecords: ManualRecord[];
  habitDefinitions: HabitDefinition[];
  habitLogs: HabitLog[];
  readingBooks: ReadingBook[];
  readingLogs: ReadingLog[];
  financeAccounts: FinanceAccount[];
  financeTransactions: FinanceTransaction[];
  financeCategories: FinanceCategory[];
  financeInsurancePolicies: FinanceInsurancePolicy[];
  financeInvestments: FinanceInvestment[];
  dailyPlans: DailyPlan[];
  weeklyReviews: WeeklyReview[];
  notifications: AppNotification[];
};
