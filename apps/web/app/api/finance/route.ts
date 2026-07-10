import { NextResponse } from "next/server";
import { request as httpsRequest } from "node:https";
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceCategoryType,
  FinanceFrequency,
  FinanceInsurancePolicy,
  FinanceInvestment,
  FinanceTransaction,
  FinanceTransactionType,
  StoredData,
} from "@personal-os/core";
import { addNotification, readStore, writeStore } from "@/lib/server/local-store";

export const runtime = "nodejs";

type FinanceAction =
  | "add_account"
  | "update_account"
  | "add_transaction"
  | "update_transaction"
  | "delete_transaction"
  | "add_category"
  | "remove_category"
  | "add_insurance"
  | "add_investment"
  | "update_investment"
  | "apply_due_sips"
  | "refresh_investment_returns";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ finance: financeSnapshot(store) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { action?: FinanceAction; payload?: Record<string, unknown> };
  const store = await readStore();

  try {
    if (body.action === "add_account") {
      const account = createAccount(body.payload ?? {});
      const next = await writeStore({ ...store, financeAccounts: [account, ...store.financeAccounts] });
      return NextResponse.json({ finance: financeSnapshot(next), account });
    }

    if (body.action === "update_account") {
      const account = updateAccount(body.payload ?? {}, store.financeAccounts);
      const next = await writeStore({
        ...store,
        financeAccounts: store.financeAccounts.map((item) => item.id === account.id ? account : item),
      });
      return NextResponse.json({ finance: financeSnapshot(next), account });
    }

    if (body.action === "add_transaction") {
      const { transaction, accounts } = createTransaction(body.payload ?? {}, store.financeAccounts, store.financeCategories);
      const next = await writeStore({
        ...store,
        financeAccounts: accounts,
        financeTransactions: [transaction, ...store.financeTransactions],
      });
      await addNotification({
        area: "finance",
        priority: transaction.type === "expense" || transaction.type === "credit_card_payment" ? "medium" : "low",
        title: "Finance transaction logged",
        body: `${transaction.title}: ${transaction.currency} ${transaction.amount.toLocaleString("en-IN")}`,
      });
      return NextResponse.json({ finance: financeSnapshot(next), transaction });
    }

    if (body.action === "update_transaction") {
      const { transaction, accounts } = updateTransaction(body.payload ?? {}, store.financeAccounts, store.financeTransactions, store.financeCategories);
      const next = await writeStore({
        ...store,
        financeAccounts: accounts,
        financeTransactions: store.financeTransactions.map((item) => item.id === transaction.id ? transaction : item),
      });
      return NextResponse.json({ finance: financeSnapshot(next), transaction });
    }

    if (body.action === "delete_transaction") {
      const { transactionId, accounts } = deleteTransaction(body.payload ?? {}, store.financeAccounts, store.financeTransactions);
      const next = await writeStore({
        ...store,
        financeAccounts: accounts,
        financeTransactions: store.financeTransactions.filter((transaction) => transaction.id !== transactionId),
      });
      return NextResponse.json({ finance: financeSnapshot(next), deleted: transactionId });
    }

    if (body.action === "add_category") {
      const category = createCategory(body.payload ?? {});
      const next = await writeStore({ ...store, financeCategories: [category, ...store.financeCategories] });
      return NextResponse.json({ finance: financeSnapshot(next), category });
    }

    if (body.action === "remove_category") {
      const categoryId = stringValue(body.payload?.categoryId);
      if (!categoryId) return error("Choose a category to remove.");
      if (store.financeTransactions.some((transaction) => transaction.categoryId === categoryId)) {
        return error("This category is already used by transactions, so it cannot be removed.");
      }
      const next = await writeStore({
        ...store,
        financeCategories: store.financeCategories.filter((category) => category.id !== categoryId),
      });
      return NextResponse.json({ finance: financeSnapshot(next), removed: categoryId });
    }

    if (body.action === "add_insurance") {
      const policy = createInsurancePolicy(body.payload ?? {});
      const next = await writeStore({ ...store, financeInsurancePolicies: [policy, ...store.financeInsurancePolicies] });
      return NextResponse.json({ finance: financeSnapshot(next), policy });
    }

    if (body.action === "add_investment") {
      const investment = createInvestment(body.payload ?? {});
      const next = await writeStore({ ...store, financeInvestments: [investment, ...store.financeInvestments] });
      return NextResponse.json({ finance: financeSnapshot(next), investment });
    }

    if (body.action === "update_investment") {
      const investment = updateInvestment(body.payload ?? {}, store.financeInvestments);
      const next = await writeStore({
        ...store,
        financeInvestments: store.financeInvestments.map((item) => item.id === investment.id ? investment : item),
      });
      return NextResponse.json({ finance: financeSnapshot(next), investment });
    }

    if (body.action === "apply_due_sips") {
      const result = applyDueSips(store);
      const next = await writeStore(result.store);
      if (result.appliedCount > 0) {
        await addNotification({
          area: "finance",
          priority: "medium",
          title: "SIPs applied",
          body: `Applied ${result.appliedCount} due SIP contribution(s).`,
        });
      }
      return NextResponse.json({ finance: financeSnapshot(next), appliedCount: result.appliedCount });
    }

    if (body.action === "refresh_investment_returns") {
      const investmentId = stringValue(body.payload?.investmentId);
      const refreshed = await refreshInvestmentReturns(store, investmentId || undefined);
      const next = await writeStore(refreshed.store);
      return NextResponse.json({ finance: financeSnapshot(next), refreshedCount: refreshed.refreshedCount, messages: refreshed.messages });
    }

    return error("Unknown finance action.");
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not save finance data.");
  }
}

function financeSnapshot(store: StoredData) {
  return {
    accounts: store.financeAccounts,
    transactions: store.financeTransactions,
    categories: store.financeCategories,
    insurancePolicies: store.financeInsurancePolicies,
    investments: store.financeInvestments,
  };
}

function createAccount(payload: Record<string, unknown>): FinanceAccount {
  const now = new Date().toISOString();
  const type = enumValue<FinanceAccountType>(payload.type, ["bank", "cash", "wallet", "credit_card", "investment"], "bank");
  const name = stringValue(payload.name);
  if (!name) throw new Error("Account name is required.");
  return {
    id: `account:${crypto.randomUUID()}`,
    name,
    type,
    currency: stringValue(payload.currency) || "INR",
    balance: numberValue(payload.balance),
    ...optionalString("institution", payload.institution),
    ...optionalString("last4", payload.last4),
    ...optionalNumberField("creditLimit", payload.creditLimit),
    ...optionalNumberField("statementDay", payload.statementDay),
    ...optionalNumberField("paymentDueDay", payload.paymentDueDay),
    ...optionalString("notes", payload.notes),
    createdAt: now,
    updatedAt: now,
  };
}

function updateAccount(payload: Record<string, unknown>, accounts: FinanceAccount[]): FinanceAccount {
  const accountId = stringValue(payload.id);
  const existing = accounts.find((account) => account.id === accountId);
  if (!existing) throw new Error("Account not found.");

  const type = enumValue<FinanceAccountType>(payload.type, ["bank", "cash", "wallet", "credit_card", "investment"], existing.type);
  const name = stringValue(payload.name);
  if (!name) throw new Error("Account name is required.");

  return {
    id: existing.id,
    name,
    type,
    currency: stringValue(payload.currency) || existing.currency || "INR",
    balance: numberValue(payload.balance),
    ...optionalString("institution", payload.institution),
    ...optionalString("last4", payload.last4),
    ...optionalNumberField("creditLimit", payload.creditLimit),
    ...optionalNumberField("statementDay", payload.statementDay),
    ...optionalNumberField("paymentDueDay", payload.paymentDueDay),
    ...optionalString("notes", payload.notes),
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function createTransaction(
  payload: Record<string, unknown>,
  currentAccounts: FinanceAccount[],
  categories: FinanceCategory[],
  existing?: FinanceTransaction,
): { transaction: FinanceTransaction; accounts: FinanceAccount[] } {
  const now = new Date().toISOString();
  const type = enumValue<FinanceTransactionType>(
    payload.type,
    ["income", "expense", "transfer", "credit_card_payment", "investment_contribution", "insurance_premium"],
    "expense",
  );
  const title = stringValue(payload.title);
  const amount = numberValue(payload.amount);
  const accountId = stringValue(payload.accountId);
  const toAccountId = stringValue(payload.toAccountId);
  const categoryId = stringValue(payload.categoryId) || categoryForType(type, categories);

  if (!title) throw new Error("Transaction title is required.");
  if (amount <= 0) throw new Error("Amount must be greater than 0.");

  const accounts = currentAccounts.map((account) => ({ ...account }));
  validateTransactionAccounts(type, accountId, toAccountId, accounts);

  const transaction: FinanceTransaction = {
    id: existing?.id ?? `transaction:${crypto.randomUUID()}`,
    date: stringValue(payload.date) || now.slice(0, 10),
    type,
    title,
    amount,
    currency: stringValue(payload.currency) || accountFor(accounts, accountId)?.currency || accountFor(accounts, toAccountId)?.currency || existing?.currency || "INR",
    ...(accountId ? { accountId } : {}),
    ...(toAccountId ? { toAccountId } : {}),
    ...optionalString("categoryId", categoryId),
    ...optionalString("merchant", payload.merchant),
    ...optionalString("notes", payload.notes),
    ...(existing?.source ? { source: existing.source } : {}),
    ...(existing?.needsReview !== undefined ? { needsReview: existing.needsReview } : {}),
    ...(existing?.rawText ? { rawText: existing.rawText } : {}),
    ...(existing?.importHash ? { importHash: existing.importHash } : {}),
    ...(existing?.confidence !== undefined ? { confidence: existing.confidence } : {}),
    ...(existing?.importedAt ? { importedAt: existing.importedAt } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  applyTransactionImpact(accounts, transaction, 1);

  return { transaction, accounts };
}

function validateTransactionAccounts(type: FinanceTransactionType, accountId: string, toAccountId: string, accounts: FinanceAccount[]) {
  const account = accountFor(accounts, accountId);
  const toAccount = accountFor(accounts, toAccountId);

  if (type === "income" && !account) throw new Error("Choose the account where income should be added.");
  if ((type === "expense" || type === "insurance_premium") && !account) throw new Error("Choose the account/card used for the expense.");
  if (type === "transfer" && (!account || !toAccount)) throw new Error("Choose both from and to accounts for transfer.");
  if (type === "credit_card_payment") {
    if (!account || !toAccount) throw new Error("Choose bank account and credit card for payment.");
    if (toAccount.type !== "credit_card") throw new Error("Payment target must be a credit card.");
  }
  if (type === "investment_contribution" && !account) throw new Error("Choose the source account for investment.");
}

function applyTransactionImpact(accounts: FinanceAccount[], transaction: FinanceTransaction, direction: 1 | -1) {
  const account = accountFor(accounts, transaction.accountId);
  const toAccount = accountFor(accounts, transaction.toAccountId);
  const amount = transaction.amount * direction;

  if (transaction.type === "income") {
    if (account) adjustAccount(account, amount);
  } else if (transaction.type === "expense" || transaction.type === "insurance_premium") {
    if (account) adjustAccount(account, account.type === "credit_card" ? amount : -amount);
  } else if (transaction.type === "transfer") {
    if (account) adjustAccount(account, -amount);
    if (toAccount) adjustAccount(toAccount, amount);
  } else if (transaction.type === "credit_card_payment") {
    if (account) adjustAccount(account, -amount);
    if (toAccount) adjustAccount(toAccount, -amount);
  } else if (transaction.type === "investment_contribution") {
    if (account) adjustAccount(account, -amount);
    if (toAccount) adjustAccount(toAccount, amount);
  }
}

function accountFor(accounts: FinanceAccount[], accountId?: string) {
  return accountId ? accounts.find((account) => account.id === accountId) : undefined;
}

function updateTransaction(
  payload: Record<string, unknown>,
  currentAccounts: FinanceAccount[],
  currentTransactions: FinanceTransaction[],
  categories: FinanceCategory[],
): { transaction: FinanceTransaction; accounts: FinanceAccount[] } {
  const transactionId = stringValue(payload.id);
  const existing = currentTransactions.find((transaction) => transaction.id === transactionId);
  if (!existing) throw new Error("Transaction not found.");

  const accounts = currentAccounts.map((account) => ({ ...account }));
  applyTransactionImpact(accounts, existing, -1);
  const { transaction, accounts: updatedAccounts } = createTransaction({ ...payload, id: transactionId }, accounts, categories, existing);
  return { transaction, accounts: updatedAccounts };
}

function deleteTransaction(
  payload: Record<string, unknown>,
  currentAccounts: FinanceAccount[],
  currentTransactions: FinanceTransaction[],
): { transactionId: string; accounts: FinanceAccount[] } {
  const transactionId = stringValue(payload.id);
  const existing = currentTransactions.find((transaction) => transaction.id === transactionId);
  if (!existing) throw new Error("Transaction not found.");

  const accounts = currentAccounts.map((account) => ({ ...account }));
  applyTransactionImpact(accounts, existing, -1);
  return { transactionId, accounts };
}

function createCategory(payload: Record<string, unknown>): FinanceCategory {
  const now = new Date().toISOString();
  const name = stringValue(payload.name);
  if (!name) throw new Error("Category name is required.");
  return {
    id: `category:${crypto.randomUUID()}`,
    name,
    type: enumValue<FinanceCategoryType>(payload.type, ["income", "expense", "investment", "insurance", "transfer", "any"], "expense"),
    createdAt: now,
    updatedAt: now,
  };
}

function createInsurancePolicy(payload: Record<string, unknown>): FinanceInsurancePolicy {
  const now = new Date().toISOString();
  const name = stringValue(payload.name);
  if (!name) throw new Error("Insurance name is required.");
  return {
    id: `insurance:${crypto.randomUUID()}`,
    name,
    policyType: stringValue(payload.policyType) || "General",
    premium: numberValue(payload.premium),
    currency: stringValue(payload.currency) || "INR",
    frequency: enumValue<FinanceFrequency>(payload.frequency, ["monthly", "quarterly", "half_yearly", "yearly", "one_time"], "yearly"),
    ...optionalString("provider", payload.provider),
    ...optionalString("nextDueDate", payload.nextDueDate),
    ...optionalString("accountId", payload.accountId),
    ...optionalString("notes", payload.notes),
    active: booleanValue(payload.active, true),
    createdAt: now,
    updatedAt: now,
  };
}

function createInvestment(payload: Record<string, unknown>): FinanceInvestment {
  const now = new Date().toISOString();
  return buildInvestment(payload, {
    id: `investment:${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  });
}

function updateInvestment(payload: Record<string, unknown>, investments: FinanceInvestment[]): FinanceInvestment {
  const investmentId = stringValue(payload.id);
  const existing = investments.find((investment) => investment.id === investmentId);
  if (!existing) throw new Error("Investment not found.");

  return buildInvestment(payload, {
    existing,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

function buildInvestment(
  payload: Record<string, unknown>,
  context: { id: string; createdAt: string; updatedAt: string; existing?: FinanceInvestment },
): FinanceInvestment {
  const name = stringValue(payload.name);
  if (!name) throw new Error("Investment name is required.");
  const investmentType = stringValue(payload.investmentType) || context.existing?.investmentType || "Mutual fund";
  const investedAmount = numberValue(payload.investedAmount);
  const startDate = stringValue(payload.startDate);
  const maturityDate = stringValue(payload.maturityDate);
  const interestRate = optionalNumber(payload.interestRate);
  const maturityAmount = optionalNumber(payload.maturityAmount)
    ?? (isFixedDepositLike(investmentType) ? estimateFixedDepositValue(investedAmount, interestRate, startDate, maturityDate) : undefined);
  const currentValue = optionalNumber(payload.currentValue)
    ?? (isFixedDepositLike(investmentType) ? estimateFixedDepositValue(investedAmount, interestRate, startDate, new Date().toISOString().slice(0, 10)) : undefined)
    ?? investedAmount;
  const returnAmount = roundMoney(currentValue - investedAmount);
  return {
    id: context.id,
    name,
    ...optionalString("schemeCode", payload.schemeCode),
    investmentType,
    investedAmount,
    currentValue,
    currency: stringValue(payload.currency) || context.existing?.currency || "INR",
    ...optionalNumberField("units", payload.units),
    ...optionalNumberField("monthlySip", payload.monthlySip),
    ...optionalNumberField("sipDay", payload.sipDay),
    ...optionalString("nextSipDate", payload.nextSipDate),
    ...optionalString("startDate", startDate),
    ...optionalString("maturityDate", maturityDate),
    ...(interestRate !== undefined ? { interestRate } : {}),
    ...(maturityAmount !== undefined ? { maturityAmount } : {}),
    ...optionalString("accountId", payload.accountId),
    ...optionalString("notes", payload.notes),
    ...(context.existing?.lastSipAppliedDate ? { lastSipAppliedDate: context.existing.lastSipAppliedDate } : {}),
    ...(context.existing?.latestNav ? { latestNav: context.existing.latestNav } : {}),
    ...(context.existing?.latestNavDate ? { latestNavDate: context.existing.latestNavDate } : {}),
    returnAmount,
    returnPercent: investedAmount > 0 ? roundMoney((returnAmount / investedAmount) * 100) : 0,
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
  };
}

function isFixedDepositLike(value: string) {
  return /fixed deposit|^fd$/i.test(value.trim());
}

function estimateFixedDepositValue(principal: number, annualRate: number | undefined, startDate: string, endDate: string) {
  if (principal <= 0 || !annualRate || annualRate <= 0 || !startDate || !endDate) return undefined;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return undefined;

  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const compoundsPerYear = 4;
  const value = principal * ((1 + (annualRate / 100) / compoundsPerYear) ** (compoundsPerYear * years));
  return roundMoney(value);
}

function applyDueSips(store: StoredData): { store: StoredData; appliedCount: number } {
  const today = new Date(new Date().toDateString());
  const accounts = store.financeAccounts.map((account) => ({ ...account }));
  const transactions = [...store.financeTransactions];
  let appliedCount = 0;

  const investments = store.financeInvestments.map((investment) => {
    if (!investment.monthlySip || investment.monthlySip <= 0 || !investment.nextSipDate) return investment;

    let nextDate = new Date(investment.nextSipDate);
    if (Number.isNaN(nextDate.getTime())) return investment;

    let updated: FinanceInvestment = { ...investment };
    while (nextDate <= today) {
      const sipAmount = investment.monthlySip;
      const nav = updated.latestNav && updated.latestNav > 0 ? updated.latestNav : undefined;
      const addedUnits = nav ? sipAmount / nav : 0;
      const sourceAccount = updated.accountId ? accounts.find((account) => account.id === updated.accountId) : undefined;
      if (sourceAccount) adjustAccount(sourceAccount, -sipAmount);

      updated = recalculateInvestmentReturns({
        ...updated,
        investedAmount: roundMoney(updated.investedAmount + sipAmount),
        currentValue: roundMoney(updated.currentValue + sipAmount),
        ...(addedUnits > 0 ? { units: roundMoney((updated.units ?? 0) + addedUnits) } : {}),
        lastSipAppliedDate: toDateInput(nextDate),
        nextSipDate: toDateInput(addMonths(nextDate, 1, updated.sipDay)),
        updatedAt: new Date().toISOString(),
      });

      transactions.unshift({
        id: `transaction:${crypto.randomUUID()}`,
        date: toDateInput(nextDate),
        type: "investment_contribution",
        title: `SIP: ${updated.name}`,
        amount: sipAmount,
        currency: updated.currency,
        ...(sourceAccount ? { accountId: sourceAccount.id } : {}),
        ...optionalString("categoryId", categoryForType("investment_contribution", store.financeCategories)),
        notes: "Automatically applied monthly SIP.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      appliedCount += 1;
      nextDate = new Date(updated.nextSipDate ?? addMonths(nextDate, 1, updated.sipDay));
    }
    return updated;
  });

  return {
    store: {
      ...store,
      financeAccounts: accounts,
      financeInvestments: investments,
      financeTransactions: transactions,
    },
    appliedCount,
  };
}

async function refreshInvestmentReturns(store: StoredData, investmentId?: string): Promise<{ store: StoredData; refreshedCount: number; messages: string[] }> {
  const messages: string[] = [];
  let refreshedCount = 0;
  const targetIds = new Set(investmentId ? [investmentId] : store.financeInvestments.map((investment) => investment.id));
  const investments: FinanceInvestment[] = [];

  for (const investment of store.financeInvestments) {
    if (!targetIds.has(investment.id) || !isMutualFundLike(investment)) {
      investments.push(investment);
      continue;
    }

    const nav = await fetchLatestNav(investment);
    if (!nav) {
      messages.push(`Could not find NAV for ${investment.name}. Add scheme code or refine the name.`);
      investments.push(investment);
      continue;
    }

    let units = investment.units;
    if ((!units || units <= 0) && investment.currentValue > 0 && nav.nav > 0) {
      units = investment.currentValue / nav.nav;
    }

    const currentValue = units && units > 0 ? roundMoney(units * nav.nav) : investment.currentValue;
    const updated = recalculateInvestmentReturns({
      ...investment,
      schemeCode: String(nav.schemeCode),
      latestNav: nav.nav,
      latestNavDate: nav.date,
      ...(units ? { units: roundMoney(units) } : {}),
      currentValue,
      updatedAt: new Date().toISOString(),
    });
    investments.push(updated);
    refreshedCount += 1;
  }

  return {
    store: { ...store, financeInvestments: investments },
    refreshedCount,
    messages,
  };
}

function recalculateInvestmentReturns(investment: FinanceInvestment): FinanceInvestment {
  const returnAmount = roundMoney(investment.currentValue - investment.investedAmount);
  return {
    ...investment,
    returnAmount,
    returnPercent: investment.investedAmount > 0 ? roundMoney((returnAmount / investment.investedAmount) * 100) : 0,
  };
}

function isMutualFundLike(investment: FinanceInvestment) {
  return /mutual|fund|sip/i.test(`${investment.investmentType} ${investment.name}`) || Boolean(investment.schemeCode);
}

async function fetchLatestNav(investment: FinanceInvestment): Promise<{ schemeCode: string | number; nav: number; date: string } | null> {
  const base = process.env.MFAPI_BASE_URL ?? "https://api.mfapi.in";
  let schemeCode = investment.schemeCode;
  if (!schemeCode) {
    const results = await getJson<Array<{ schemeCode?: string | number; schemeName?: string }>>(`${base}/mf/search?q=${encodeURIComponent(investment.name)}`);
    if (!results) return null;
    schemeCode = String(results[0]?.schemeCode ?? "");
  }
  if (!schemeCode) return null;

  const payload = await getJson<{ meta?: { scheme_code?: string | number }; data?: Array<{ nav?: string; date?: string }> }>(`${base}/mf/${encodeURIComponent(schemeCode)}/latest`);
  if (!payload) return null;
  const latest = payload.data?.[0];
  const nav = Number(latest?.nav);
  if (!Number.isFinite(nav) || nav <= 0) return null;
  return {
    schemeCode: payload.meta?.scheme_code ?? schemeCode,
    nav,
    date: latest?.date ?? new Date().toISOString().slice(0, 10),
  };
}

async function getJson<T>(url: string): Promise<T | null> {
  if (url.startsWith("https://")) {
    return getHttpsJson<T>(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function getHttpsJson<T>(url: string): Promise<T | null> {
  return new Promise((resolve) => {
    const request = httpsRequest(url, {
      method: "GET",
      timeout: 25000,
      headers: {
        accept: "application/json",
        "user-agent": "personal-os/1.0",
      },
    }, (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        resolve(null);
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          resolve(null);
        }
      });
    });

    request.on("timeout", () => request.destroy(new Error("MFapi request timed out.")));
    request.on("error", () => resolve(null));
    request.end();
  });
}

function adjustAccount(account: FinanceAccount, delta: number) {
  account.balance = Math.max(account.type === "credit_card" ? 0 : Number.NEGATIVE_INFINITY, roundMoney(account.balance + delta));
  account.updatedAt = new Date().toISOString();
}

function categoryForType(type: FinanceTransactionType, categories: FinanceCategory[]) {
  const categoryType = type === "income" ? "income" : type === "investment_contribution" ? "investment" : type === "insurance_premium" ? "insurance" : type === "transfer" || type === "credit_card_payment" ? "transfer" : "expense";
  return categories.find((category) => category.type === categoryType)?.id ?? categories.find((category) => category.type === "any")?.id;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(number) ? roundMoney(number) : 0;
}

function optionalNumber(value: unknown): number | undefined {
  const number = numberValue(value);
  return number > 0 ? number : undefined;
}

function optionalString<K extends string>(key: K, value: unknown): { [P in K]?: string } {
  const string = stringValue(value);
  return string ? { [key]: string } as { [P in K]?: string } : {};
}

function optionalNumberField<K extends string>(key: K, value: unknown): { [P in K]?: number } {
  const number = optionalNumber(value);
  return number !== undefined ? { [key]: number } as { [P in K]?: number } : {};
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function addMonths(date: Date, months: number, preferredDay?: number) {
  const next = new Date(date);
  const day = Math.min(28, Math.max(1, preferredDay ?? date.getDate()));
  next.setMonth(next.getMonth() + months, day);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function error(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}
