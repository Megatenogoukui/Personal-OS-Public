import type { FinanceCategory, StoredData } from "./types";

const createdAt = "2026-01-01T00:00:00.000Z";

export const defaultFinanceCategories: FinanceCategory[] = [
  category("Salary", "income"),
  category("Freelance", "income"),
  category("Food", "expense"),
  category("Transport", "expense"),
  category("Shopping", "expense"),
  category("Bills", "expense"),
  category("Subscription", "expense"),
  category("Health", "expense"),
  category("Insurance", "insurance"),
  category("Investment", "investment"),
  category("Transfer", "transfer"),
  category("Other", "any"),
];

export const emptyStoredData: StoredData = {
  profile: {
    displayName: "",
    workIdentity: "",
    timezone: "UTC",
    currency: "USD",
    configured: false,
  },
  workTasks: [],
  manualRecords: [],
  habitDefinitions: [],
  habitLogs: [],
  readingBooks: [],
  readingLogs: [],
  financeAccounts: [],
  financeTransactions: [],
  financeCategories: defaultFinanceCategories,
  financeInsurancePolicies: [],
  financeInvestments: [],
  dailyPlans: [],
  weeklyReviews: [],
  notifications: [],
};

function category(name: string, type: FinanceCategory["type"]): FinanceCategory {
  return {
    id: `category:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    type,
    createdAt,
    updatedAt: createdAt,
  };
}
