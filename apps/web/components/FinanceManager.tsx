"use client";

import { Banknote, Bell, CalendarClock, CreditCard, Landmark, Pencil, PiggyBank, Plus, ShieldCheck, Trash2, TrendingUp, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceInsurancePolicy,
  FinanceInvestment,
  FinanceTransaction,
  FinanceTransactionType,
} from "@personal-os/core";
import { cn, formatCurrency, todayIso } from "@/lib/utils";

type FinancePayload = {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  insurancePolicies: FinanceInsurancePolicy[];
  investments: FinanceInvestment[];
};

type FinanceResponse = {
  finance?: FinancePayload;
  message?: string;
  appliedCount?: number;
};

type FinanceModal = "account" | "transaction" | "category" | "insurance" | "investment" | "fixedDeposit" | null;

const emptyFinance: FinancePayload = {
  accounts: [],
  transactions: [],
  categories: [],
  insurancePolicies: [],
  investments: [],
};

const accountTypes = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
  { value: "credit_card", label: "Credit card" },
  { value: "investment", label: "Investment account" },
];

const transactionTypes: Array<{ value: FinanceTransactionType; label: string; helper: string }> = [
  { value: "income", label: "Income", helper: "Adds money to selected account." },
  { value: "expense", label: "Expense", helper: "Cuts bank/cash balance or increases credit-card outstanding." },
  { value: "transfer", label: "Transfer", helper: "Moves money between accounts." },
  { value: "credit_card_payment", label: "Credit card payment", helper: "Cuts bank balance and reduces card outstanding." },
  { value: "investment_contribution", label: "Investment", helper: "Cuts source account and optionally adds to investment account." },
  { value: "insurance_premium", label: "Insurance premium", helper: "Logs premium and cuts selected account/card." },
];

const investmentTypes = [
  { value: "Mutual fund", label: "Mutual fund / SIP" },
  { value: "Fixed deposit", label: "Fixed deposit" },
  { value: "PPF", label: "PPF" },
  { value: "Stocks", label: "Stocks" },
  { value: "Other", label: "Other" },
];

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";
const primaryButtonClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:w-auto";
const secondaryButtonClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold shadow-sm transition hover:-translate-y-px hover:border-accent/50 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-auto";
const iconBadgeClass = "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent/15 bg-accent/10 text-accent";

export function FinanceManager() {
  const [finance, setFinance] = useState<FinancePayload>(emptyFinance);
  const [status, setStatus] = useState("Ready.");
  const [activeModal, setActiveModal] = useState<FinanceModal>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "bank",
    institution: "",
    balance: "",
    creditLimit: "",
    statementDay: "",
    paymentDueDay: "",
    last4: "",
  });
  const [transactionForm, setTransactionForm] = useState({
    type: "expense" as FinanceTransactionType,
    title: "",
    amount: "",
    accountId: "",
    toAccountId: "",
    categoryId: "",
    date: todayIso(),
    merchant: "",
    notes: "",
  });
  const [categoryForm, setCategoryForm] = useState({ name: "", type: "expense" });
  const [insuranceForm, setInsuranceForm] = useState({
    name: "",
    provider: "",
    policyType: "Health",
    premium: "",
    frequency: "yearly",
    nextDueDate: "",
    accountId: "",
    notes: "",
  });
  const [investmentForm, setInvestmentForm] = useState({
    name: "",
    schemeCode: "",
    investmentType: "Mutual fund",
    investedAmount: "",
    currentValue: "",
    units: "",
    monthlySip: "",
    sipDay: "",
    nextSipDate: "",
    startDate: "",
    maturityDate: "",
    interestRate: "",
    maturityAmount: "",
    accountId: "",
    notes: "",
  });

  async function loadFinance() {
    try {
      const response = await fetch("/api/finance", { cache: "no-store" });
      const body = await readFinanceResponse(response);
      if (!response.ok || !body.finance) {
        setStatus(body.message ?? "Could not load finance data. Restart the local server and try again.");
        return;
      }

      let nextFinance = body.finance;
      const sipResponse = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "apply_due_sips", payload: {} }),
      }).catch(() => null);
      if (sipResponse?.ok) {
        const sipBody = await readFinanceResponse(sipResponse);
        if (sipBody.finance) nextFinance = sipBody.finance;
        if ((sipBody.appliedCount ?? 0) > 0) setStatus(`Applied ${sipBody.appliedCount} due SIP contribution(s).`);
      }
      setFinance(nextFinance);
    } catch {
      setStatus("Could not load finance data. Restart the local server and try again.");
    }
  }

  async function save(action: string, payload: Record<string, unknown>, success: string) {
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const body = await readFinanceResponse(response);
      if (!response.ok || !body.finance) {
        setStatus(body.message ?? "Could not save finance data.");
        return false;
      }
      setFinance(body.finance);
      setStatus(success);
      return true;
    } catch {
      setStatus("Could not save finance data. Check the local server and try again.");
      return false;
    }
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  const accounts = finance.accounts;
  const creditCards = accounts.filter((account) => account.type === "credit_card");
  const spendingAccounts = accounts.filter((account) => account.type !== "investment");
  const investmentAccounts = accounts.filter((account) => account.type === "investment");
  const fixedDeposits = finance.investments.filter(isFixedDepositInvestment);
  const marketInvestments = finance.investments.filter((investment) => !isFixedDepositInvestment(investment));
  const summary = useMemo(() => buildSummary(finance), [finance]);
  const analytics = useMemo(() => buildFinanceAnalytics(finance, summary), [finance, summary]);
  const reminders = useMemo(() => buildReminders(finance), [finance]);
  const isFixedDeposit = /fixed deposit|^fd$/i.test(investmentForm.investmentType.trim());

  async function addAccount(event: FormEvent) {
    event.preventDefault();
    const action = editingAccountId ? "update_account" : "add_account";
    const saved = await save(action, editingAccountId ? { ...accountForm, id: editingAccountId } : accountForm, editingAccountId ? "Account updated." : "Account added.");
    if (saved) {
      resetAccountForm();
      setActiveModal(null);
    }
  }

  function editAccount(account: FinanceAccount) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      type: account.type,
      institution: account.institution ?? "",
      balance: String(account.balance || ""),
      creditLimit: account.creditLimit ? String(account.creditLimit) : "",
      statementDay: account.statementDay ? String(account.statementDay) : "",
      paymentDueDay: account.paymentDueDay ? String(account.paymentDueDay) : "",
      last4: account.last4 ?? "",
    });
    setStatus(`Editing ${account.name}.`);
    setActiveModal("account");
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountForm({ name: "", type: "bank", institution: "", balance: "", creditLimit: "", statementDay: "", paymentDueDay: "", last4: "" });
  }

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    const action = editingTransactionId ? "update_transaction" : "add_transaction";
    const saved = await save(action, editingTransactionId ? { ...transactionForm, id: editingTransactionId } : transactionForm, editingTransactionId ? "Transaction updated and balances adjusted." : "Transaction saved and balances updated.");
    if (saved) {
      resetTransactionForm();
      setActiveModal(null);
    }
  }

  function editTransaction(transaction: FinanceTransaction) {
    setEditingTransactionId(transaction.id);
    setTransactionForm({
      type: transaction.type,
      title: transaction.title,
      amount: String(transaction.amount || ""),
      accountId: transaction.accountId ?? "",
      toAccountId: transaction.toAccountId ?? "",
      categoryId: transaction.categoryId ?? "",
      date: transaction.date.slice(0, 10),
      merchant: transaction.merchant ?? "",
      notes: transaction.notes ?? "",
    });
    setStatus(`Editing ${transaction.title}.`);
    setActiveModal("transaction");
  }

  function resetTransactionForm() {
    setEditingTransactionId(null);
    setTransactionForm({
      type: "expense",
      title: "",
      amount: "",
      accountId: "",
      toAccountId: "",
      categoryId: "",
      date: todayIso(),
      merchant: "",
      notes: "",
    });
  }

  async function deleteTransaction(transaction: FinanceTransaction) {
    if (!window.confirm(`Delete ${transaction.title} (${formatCurrency(transaction.amount, transaction.currency)})?`)) return;
    await save("delete_transaction", { id: transaction.id }, "Transaction deleted and balance restored.");
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const saved = await save("add_category", categoryForm, "Category added.");
    if (saved) {
      setCategoryForm({ name: "", type: "expense" });
      setActiveModal(null);
    }
  }

  async function removeCategory(categoryId: string) {
    await save("remove_category", { categoryId }, "Category removed.");
  }

  async function addInsurance(event: FormEvent) {
    event.preventDefault();
    const saved = await save("add_insurance", insuranceForm, "Insurance policy added.");
    if (saved) {
      setInsuranceForm({ name: "", provider: "", policyType: "Health", premium: "", frequency: "yearly", nextDueDate: "", accountId: "", notes: "" });
      setActiveModal(null);
    }
  }

  async function addInvestment(event: FormEvent) {
    event.preventDefault();
    const action = editingInvestmentId ? "update_investment" : "add_investment";
    const saved = await save(
      action,
      editingInvestmentId ? { ...investmentForm, id: editingInvestmentId } : investmentForm,
      editingInvestmentId ? (isFixedDeposit ? "FD updated." : "Investment updated.") : isFixedDeposit ? "FD added." : "Investment added.",
    );
    if (saved) {
      resetInvestmentForm();
      setActiveModal(null);
    }
  }

  function editInvestment(investment: FinanceInvestment) {
    setEditingInvestmentId(investment.id);
    setInvestmentForm({
      name: investment.name,
      schemeCode: investment.schemeCode ?? "",
      investmentType: investment.investmentType,
      investedAmount: String(investment.investedAmount || ""),
      currentValue: String(investment.currentValue || ""),
      units: investment.units ? String(investment.units) : "",
      monthlySip: investment.monthlySip ? String(investment.monthlySip) : "",
      sipDay: investment.sipDay ? String(investment.sipDay) : "",
      nextSipDate: investment.nextSipDate ?? "",
      startDate: investment.startDate ?? "",
      maturityDate: investment.maturityDate ?? "",
      interestRate: investment.interestRate ? String(investment.interestRate) : "",
      maturityAmount: investment.maturityAmount ? String(investment.maturityAmount) : "",
      accountId: investment.accountId ?? "",
      notes: investment.notes ?? "",
    });
    setStatus(`Editing ${investment.name}.`);
    setActiveModal(isFixedDepositInvestment(investment) ? "fixedDeposit" : "investment");
  }

  function resetInvestmentForm(kind: "investment" | "fixedDeposit" = "investment") {
    setEditingInvestmentId(null);
    setInvestmentForm({
      name: "",
      schemeCode: "",
      investmentType: kind === "fixedDeposit" ? "Fixed deposit" : "Mutual fund",
      investedAmount: "",
      currentValue: "",
      units: "",
      monthlySip: "",
      sipDay: "",
      nextSipDate: "",
      startDate: "",
      maturityDate: "",
      interestRate: "",
      maturityAmount: "",
      accountId: "",
      notes: "",
    });
  }

  function openInvestmentModal() {
    resetInvestmentForm("investment");
    setActiveModal("investment");
  }

  function openFixedDepositModal() {
    resetInvestmentForm("fixedDeposit");
    setActiveModal("fixedDeposit");
  }

  async function applyDueSips() {
    const saved = await save("apply_due_sips", {}, "Due SIPs checked and applied.");
    if (!saved) return;
  }

  async function refreshInvestmentReturns(investmentId?: string) {
    await save("refresh_investment_returns", investmentId ? { investmentId } : {}, investmentId ? "Investment NAV refreshed." : "Investment NAVs refreshed.");
  }

  return (
    <div className="space-y-6">
      <section className={cn(panelClass, "overflow-hidden")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">Finance manager</div>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">Money, cards, SIPs, FDs, and bills in one clean view.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
              Track account-linked cashflow, upcoming payments, daily insights, and long-term investments without mixing them into one messy list.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">System status</div>
            <div className="text-sm font-medium leading-5">{status}</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-muted">
              <span className="rounded-lg border bg-card px-2 py-1.5">{accounts.length} accounts</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{finance.transactions.length} entries</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{finance.investments.length} assets</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Landmark size={18} />} label="Cash/accounts" value={formatCurrency(summary.cash)} />
        <Metric icon={<CreditCard size={18} />} label="Card outstanding" value={formatCurrency(summary.creditOutstanding)} danger={summary.creditOutstanding > 0} />
        <Metric icon={<TrendingUp size={18} />} label="Investments + FDs" value={formatCurrency(summary.investments)} />
        <Metric icon={<Banknote size={18} />} label="Month income" value={formatCurrency(summary.monthIncome)} success={summary.monthIncome > 0} />
        <Metric icon={<PiggyBank size={18} />} label="Month spend" value={formatCurrency(summary.monthSpend)} danger={summary.monthSpend > 0} />
      </section>

      <section className={cn(panelClass, "border-accent/20")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Daily finance analytics</div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">Money health and next improvements</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Generated today from your accounts, cards, investments, and this month&apos;s transactions.</p>
          </div>
          <div className={cn("rounded-lg border px-4 py-2 text-right text-sm font-semibold shadow-sm", analytics.score >= 75 ? "border-success/30 bg-success/10 text-success" : analytics.score >= 50 ? "border-warning/30 bg-warning/10 text-warning" : "border-danger/30 bg-danger/10 text-danger")}>
            <div className="text-[11px] uppercase tracking-widest">Score</div>
            <div className="text-lg">{analytics.score}/100</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Mini label="Net this month" value={formatCurrency(analytics.netCashflow)} />
          <Mini label="Savings rate" value={`${analytics.savingsRate}%`} />
          <Mini label="Daily avg spend" value={formatCurrency(analytics.dailyAverageSpend)} />
          <Mini label="Projected spend" value={formatCurrency(analytics.projectedMonthSpend)} />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-lg border bg-surface p-4">
            <h3 className="text-sm font-semibold">What this means</h3>
            <div className="mt-3 space-y-2">
              {analytics.insights.map((item) => (
                <div key={item} className="rounded-lg border bg-card px-3 py-2.5 text-sm leading-5 text-muted">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-surface p-4">
            <h3 className="text-sm font-semibold">Tips for improvement</h3>
            <div className="mt-3 space-y-2">
              {analytics.tips.map((item) => (
                <div key={item} className="rounded-lg border bg-card px-3 py-2.5 text-sm leading-5 text-muted">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-accent")}><Landmark size={18} /></span>
            <div>
              <h2 className="text-lg font-semibold">Accounts and cards</h2>
              <div className="text-xs text-muted">{accounts.length} total</div>
            </div>
          </div>
          <button type="button" onClick={() => { resetAccountForm(); setActiveModal("account"); }} className={primaryButtonClass}>
            <Plus size={16} />
            Add account/card
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <article key={account.id} className="rounded-lg border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{account.name}</div>
                  <div className="mt-1 text-xs capitalize text-muted">
                    {account.type.replace("_", " ")} {account.institution ? `- ${account.institution}` : ""} {account.last4 ? `- ${account.last4}` : ""}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className={cn("text-right font-semibold", account.type === "credit_card" && account.balance > 0 && "text-danger")}>
                    {formatCurrency(account.balance, account.currency)}
                  </div>
                  <button type="button" onClick={() => editAccount(account)} className="rounded-lg border bg-card p-2 text-muted shadow-sm transition hover:border-accent/50 hover:text-accent" aria-label={`Edit ${account.name}`}>
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              {account.type === "credit_card" ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Mini label="Limit" value={formatCurrency(account.creditLimit ?? 0, account.currency)} />
                  <Mini label="Available" value={formatCurrency(Math.max(0, (account.creditLimit ?? 0) - account.balance), account.currency)} />
                  <Mini label="Statement" value={account.statementDay ? `Day ${account.statementDay}` : "Not set"} />
                  <Mini label="Due" value={account.paymentDueDay ? `Day ${account.paymentDueDay}` : "Not set"} />
                </div>
              ) : null}
            </article>
          ))}
          {accounts.length === 0 ? <EmptyState text="No accounts yet. Add your bank account, cash wallet, or credit card first." /> : null}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-success")}><Banknote size={18} /></span>
            <div>
              <h2 className="text-lg font-semibold">Recent transactions</h2>
              <div className="text-xs text-muted">Latest 12</div>
            </div>
          </div>
          <button type="button" onClick={() => { resetTransactionForm(); setActiveModal("transaction"); }} className={primaryButtonClass}>
            <Plus size={16} />
            Add income/expense
          </button>
        </div>
        <div className="mt-4 max-h-[560px] overflow-y-auto rounded-lg border bg-surface px-3">
          <div className="divide-y">
          {finance.transactions.slice(0, 12).map((transaction) => (
            <article key={transaction.id} className="grid gap-3 py-3 transition hover:bg-card/60 md:grid-cols-[1fr_150px_132px_92px] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{transaction.title}</div>
                  {transaction.needsReview ? <Badge tone="warning">Needs review</Badge> : null}
                  {transaction.source === "iphone_message" ? <Badge>iPhone</Badge> : null}
                  {transaction.confidence !== undefined ? <Badge>{Math.round(transaction.confidence * 100)}%</Badge> : null}
                </div>
                <div className="mt-1 text-xs font-medium text-muted">{transaction.date.slice(0, 10)} - {labelFor(finance.categories, transaction.categoryId) ?? transaction.type.replaceAll("_", " ")}</div>
                {transaction.rawText ? (
                  <details className="mt-1 text-xs text-muted">
                    <summary className="cursor-pointer">Original message</summary>
                    <div className="mt-1 rounded-lg border bg-card p-2">{transaction.rawText}</div>
                  </details>
                ) : transaction.notes ? <div className="mt-1 text-sm text-muted">{transaction.notes}</div> : null}
              </div>
              <div className={cn("text-lg font-semibold md:text-right", transaction.type === "income" ? "text-success" : "text-danger")}>{formatSignedTransaction(transaction)}</div>
              <div className="rounded-lg border bg-card px-2 py-1.5 text-center text-xs font-semibold capitalize text-muted">{transaction.type.replaceAll("_", " ")}</div>
              <div className="flex items-center gap-2 md:justify-end">
                <button type="button" onClick={() => editTransaction(transaction)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted shadow-sm transition hover:border-accent/50 hover:text-accent" aria-label={`Edit ${transaction.title}`}>
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => void deleteTransaction(transaction)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted shadow-sm transition hover:border-danger/50 hover:text-danger" aria-label={`Delete ${transaction.title}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
          {finance.transactions.length === 0 ? <EmptyState text="No transactions yet. Add income or an expense after creating an account." /> : null}
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(280px,360px)_minmax(0,1fr)]">
        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-warning")}><Bell size={18} /></span>
            <h2 className="text-lg font-semibold">Credit card reminders</h2>
          </div>
          <div className="mt-4 space-y-3">
            {reminders.creditCards.map((reminder) => (
              <div key={reminder.id} className={cn("rounded-lg border bg-surface p-4 shadow-sm", reminder.days <= 7 && "border-warning/50 bg-warning/10")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{reminder.name}</div>
                    <div className="mt-1 text-xs text-muted">Due {reminder.dueDateLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-danger">{formatCurrency(reminder.outstanding)}</div>
                    <div className="mt-1 text-xs text-muted">{reminder.days} days</div>
                  </div>
                </div>
              </div>
            ))}
            {reminders.creditCards.length === 0 ? <EmptyState text="Add a credit card with due day to see bill reminders." /> : null}
          </div>
        </article>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Expense categories</h2>
            <button type="button" onClick={() => setActiveModal("category")} className={secondaryButtonClass}>
              <Plus size={16} />
              Add
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {finance.categories.map((category) => (
              <span key={category.id} className="inline-flex items-center gap-2 rounded-lg border bg-surface px-2.5 py-1.5 text-xs font-medium shadow-sm">
                {category.name}
                <button type="button" onClick={() => void removeCategory(category.id)} className="text-muted hover:text-danger" aria-label={`Remove ${category.name}`}>
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </section>

        <article className={panelClass}>
          <h2 className="text-lg font-semibold">Category spend this month</h2>
          <div className="mt-4 space-y-2">
            {summary.categorySpend.map((item) => (
              <div key={item.label} className="rounded-lg border bg-surface p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.label}</span>
                  <span className="font-semibold">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
            {summary.categorySpend.length === 0 ? <EmptyState text="No expense categories used this month." /> : null}
          </div>
        </article>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-success")}><ShieldCheck size={18} /></span>
            <div>
              <h2 className="text-lg font-semibold">Insurance</h2>
              <div className="text-xs text-muted">{finance.insurancePolicies.length} policies</div>
            </div>
          </div>
          <button type="button" onClick={() => setActiveModal("insurance")} className={primaryButtonClass}>
            <Plus size={16} />
            Add insurance
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {finance.insurancePolicies.map((policy) => (
            <article key={policy.id} className="rounded-lg border bg-surface p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{policy.name}</div>
                  <div className="mt-1 text-xs text-muted">{policy.provider || "No provider"} - {policy.policyType} - {policy.frequency.replace("_", " ")}</div>
                </div>
                <div className="text-right font-semibold">{formatCurrency(policy.premium, policy.currency)}</div>
              </div>
              {policy.nextDueDate ? <div className="mt-2 text-xs text-muted">Next due: {policy.nextDueDate.slice(0, 10)}</div> : null}
            </article>
          ))}
          {finance.insurancePolicies.length === 0 ? <EmptyState text="No insurance policies yet." /> : null}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-warning")}><CalendarClock size={18} /></span>
            <div>
              <h2 className="text-lg font-semibold">Fixed deposits</h2>
              <div className="text-xs text-muted">
                {fixedDeposits.length} FDs - {formatCurrency(summary.fixedDeposits)} current value
              </div>
            </div>
          </div>
          <button type="button" onClick={openFixedDepositModal} className={primaryButtonClass}>
            <Plus size={16} />
            Add FD
          </button>
        </div>

        {reminders.fixedDeposits.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reminders.fixedDeposits.slice(0, 3).map((reminder) => (
              <div key={reminder.id} className={cn("rounded-lg border bg-surface p-4 text-sm shadow-sm", reminder.days <= 30 && "border-warning/50 bg-warning/10")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{reminder.name}</div>
                    <div className="mt-1 text-xs text-muted">Matures {reminder.maturityDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(reminder.maturityAmount)}</div>
                    <div className="mt-1 text-xs text-muted">{fdDaysLabel(reminder.days)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fixedDeposits.map((investment) => (
            <article key={investment.id} className="rounded-lg border bg-surface p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{investment.name}</div>
                  <div className="mt-1 text-xs text-muted">
                    {investment.interestRate ? `${investment.interestRate}% interest` : "Interest not set"}
                    {investment.maturityDate ? ` - ${fdDaysLabel(daysUntilIso(investment.maturityDate))}` : ""}
                  </div>
                </div>
                <button type="button" onClick={() => editInvestment(investment)} className="rounded-lg border bg-card p-2 text-muted shadow-sm transition hover:border-accent/50 hover:text-accent" aria-label={`Edit ${investment.name}`}>
                  <Pencil size={14} />
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <Mini label="Principal" value={formatCurrency(investment.investedAmount, investment.currency)} />
                <Mini label="Current value" value={formatCurrency(investment.currentValue, investment.currency)} />
                <Mini label="Maturity value" value={investment.maturityAmount ? formatCurrency(investment.maturityAmount, investment.currency) : "Not set"} />
                <Mini label="Maturity date" value={investment.maturityDate ? investment.maturityDate.slice(0, 10) : "Not set"} />
                <Mini label="Start date" value={investment.startDate ? investment.startDate.slice(0, 10) : "Not set"} />
                <Mini label="Linked account" value={accountNameFor(accounts, investment.accountId)} />
              </div>
              {investment.notes ? <div className="mt-3 rounded-lg border bg-card p-2 text-xs text-muted">{investment.notes}</div> : null}
            </article>
          ))}
          {fixedDeposits.length === 0 ? <EmptyState text="No FDs yet. Add principal, rate, start date, maturity date, and linked bank account." /> : null}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(iconBadgeClass, "text-accent")}><TrendingUp size={18} /></span>
            <div>
              <h2 className="text-lg font-semibold">Investments</h2>
              <div className="text-xs text-muted">
                {marketInvestments.length} records - {formatCurrency(summary.marketInvestments)} current value
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void applyDueSips()} className={secondaryButtonClass}>Apply due SIPs</button>
            <button type="button" onClick={() => void refreshInvestmentReturns()} className={secondaryButtonClass}>Refresh returns</button>
            <button type="button" onClick={openInvestmentModal} className={primaryButtonClass}>
              <Plus size={16} />
              Add investment
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {marketInvestments.map((investment) => (
            <article key={investment.id} className="rounded-lg border bg-surface p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{investment.name}</div>
                  <div className="mt-1 text-xs text-muted">{investment.investmentType} - invested {formatCurrency(investment.investedAmount, investment.currency)}</div>
                  <div className="mt-1 text-xs text-muted">
                    {investment.schemeCode ? `Scheme ${investment.schemeCode}` : "No scheme code"} {investment.units ? `- ${investment.units} units` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(investment.currentValue, investment.currency)}</div>
                  <div className={cn("mt-1 text-xs", (investment.returnAmount ?? investment.currentValue - investment.investedAmount) >= 0 ? "text-success" : "text-danger")}>
                    {formatCurrency(investment.returnAmount ?? investment.currentValue - investment.investedAmount, investment.currency)}
                    {investment.returnPercent !== undefined ? ` (${investment.returnPercent}%)` : ""}
                  </div>
                </div>
              </div>
              {investment.monthlySip ? <div className="mt-2 text-xs text-muted">SIP: {formatCurrency(investment.monthlySip, investment.currency)} {investment.nextSipDate ? `on ${investment.nextSipDate.slice(0, 10)}` : ""}</div> : null}
              {investment.latestNav ? <div className="mt-1 text-xs text-muted">Latest NAV: {investment.latestNav} {investment.latestNavDate ? `as of ${investment.latestNavDate}` : ""}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => editInvestment(investment)} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
                  <Pencil size={13} />
                  Edit
                </button>
                <button type="button" onClick={() => void refreshInvestmentReturns(investment.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
                  Refresh NAV
                </button>
              </div>
            </article>
          ))}
          {marketInvestments.length === 0 ? <EmptyState text="No SIPs, mutual funds, PPF, or stocks yet." /> : null}
        </div>
      </section>

      {activeModal === "account" ? (
        <Modal title={editingAccountId ? "Edit account/card" : "Add account/card"} onClose={() => { resetAccountForm(); setActiveModal(null); }}>
          <form onSubmit={addAccount} className="grid gap-3">
            <TextInput label="Name" value={accountForm.name} onChange={(value) => setAccountForm({ ...accountForm, name: value })} placeholder="HDFC salary, SBI savings, Amex card" required />
            <Select label="Type" value={accountForm.type} onChange={(value) => setAccountForm({ ...accountForm, type: value })} options={accountTypes} />
            <TextInput label="Bank / issuer" value={accountForm.institution} onChange={(value) => setAccountForm({ ...accountForm, institution: value })} placeholder="HDFC, ICICI, SBI" />
            <TextInput label={accountForm.type === "credit_card" ? "Current outstanding" : editingAccountId ? "Current balance" : "Opening balance"} value={accountForm.balance} onChange={(value) => setAccountForm({ ...accountForm, balance: value })} placeholder="0" inputMode="decimal" />
            {accountForm.type === "credit_card" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Last 4" value={accountForm.last4} onChange={(value) => setAccountForm({ ...accountForm, last4: value })} placeholder="1234" inputMode="numeric" />
                <TextInput label="Limit" value={accountForm.creditLimit} onChange={(value) => setAccountForm({ ...accountForm, creditLimit: value })} placeholder="100000" inputMode="decimal" />
                <TextInput label="Statement day" value={accountForm.statementDay} onChange={(value) => setAccountForm({ ...accountForm, statementDay: value })} placeholder="18" inputMode="numeric" />
                <TextInput label="Due day" value={accountForm.paymentDueDay} onChange={(value) => setAccountForm({ ...accountForm, paymentDueDay: value })} placeholder="5" inputMode="numeric" />
              </div>
            ) : null}
            <button className={primaryButtonClass}>
              <Plus size={16} />
              {editingAccountId ? "Save changes" : "Add account"}
            </button>
          </form>
        </Modal>
      ) : null}

      {activeModal === "transaction" ? (
        <Modal title={editingTransactionId ? "Edit transaction" : "Add income/expense"} onClose={() => { resetTransactionForm(); setActiveModal(null); }}>
          <form onSubmit={addTransaction} className="grid gap-3">
            <Select label="Type" value={transactionForm.type} onChange={(value) => setTransactionForm({ ...transactionForm, type: value as FinanceTransactionType })} options={transactionTypes.map((item) => ({ value: item.value, label: item.label }))} />
            <div className="rounded-lg border bg-surface px-3 py-2 text-xs leading-5 text-muted">{transactionTypes.find((item) => item.value === transactionForm.type)?.helper}</div>
            <TextInput label="Title" value={transactionForm.title} onChange={(value) => setTransactionForm({ ...transactionForm, title: value })} placeholder="Salary, groceries, fuel, SIP, LIC premium" required />
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="Amount" value={transactionForm.amount} onChange={(value) => setTransactionForm({ ...transactionForm, amount: value })} placeholder="0" inputMode="decimal" required />
              <TextInput label="Date" value={transactionForm.date} onChange={(value) => setTransactionForm({ ...transactionForm, date: value })} type="date" />
            </div>
            <Select label={sourceAccountLabel(transactionForm.type)} value={transactionForm.accountId} onChange={(value) => setTransactionForm({ ...transactionForm, accountId: value })} options={accountOptions(spendingAccounts)} />
            {needsTargetAccount(transactionForm.type) ? (
              <Select label={targetAccountLabel(transactionForm.type)} value={transactionForm.toAccountId} onChange={(value) => setTransactionForm({ ...transactionForm, toAccountId: value })} options={accountOptions(transactionForm.type === "credit_card_payment" ? creditCards : transactionForm.type === "investment_contribution" ? investmentAccounts : accounts)} />
            ) : null}
            <Select label="Category" value={transactionForm.categoryId} onChange={(value) => setTransactionForm({ ...transactionForm, categoryId: value })} options={[{ value: "", label: "Auto category" }, ...finance.categories.map((category) => ({ value: category.id, label: `${category.name} (${category.type})` }))]} />
            <TextInput label="Merchant/person" value={transactionForm.merchant} onChange={(value) => setTransactionForm({ ...transactionForm, merchant: value })} placeholder="Optional" />
            <Textarea label="Notes" value={transactionForm.notes} onChange={(value) => setTransactionForm({ ...transactionForm, notes: value })} />
            <button className={primaryButtonClass}>
              <Plus size={16} />
              {editingTransactionId ? "Save transaction" : "Add transaction"}
            </button>
          </form>
        </Modal>
      ) : null}

      {activeModal === "category" ? (
        <Modal title="Add category" onClose={() => setActiveModal(null)}>
          <form onSubmit={addCategory} className="grid gap-3">
            <TextInput label="New category" value={categoryForm.name} onChange={(value) => setCategoryForm({ ...categoryForm, name: value })} placeholder="Fuel, rent, gifts, EMI" required />
            <Select label="Type" value={categoryForm.type} onChange={(value) => setCategoryForm({ ...categoryForm, type: value })} options={[
              { value: "income", label: "Income" },
              { value: "expense", label: "Expense" },
              { value: "investment", label: "Investment" },
              { value: "insurance", label: "Insurance" },
              { value: "transfer", label: "Transfer" },
              { value: "any", label: "Any" },
            ]} />
            <button className={primaryButtonClass}>
              <Plus size={16} />
              Add category
            </button>
          </form>
        </Modal>
      ) : null}

      {activeModal === "insurance" ? (
        <Modal title="Add insurance" onClose={() => setActiveModal(null)}>
          <form onSubmit={addInsurance} className="grid gap-3 md:grid-cols-2">
            <TextInput label="Policy name" value={insuranceForm.name} onChange={(value) => setInsuranceForm({ ...insuranceForm, name: value })} placeholder="Health insurance, term plan" required />
            <TextInput label="Provider" value={insuranceForm.provider} onChange={(value) => setInsuranceForm({ ...insuranceForm, provider: value })} placeholder="LIC, HDFC Ergo" />
            <TextInput label="Type" value={insuranceForm.policyType} onChange={(value) => setInsuranceForm({ ...insuranceForm, policyType: value })} placeholder="Health, term, vehicle" />
            <TextInput label="Premium" value={insuranceForm.premium} onChange={(value) => setInsuranceForm({ ...insuranceForm, premium: value })} inputMode="decimal" placeholder="0" />
            <Select label="Frequency" value={insuranceForm.frequency} onChange={(value) => setInsuranceForm({ ...insuranceForm, frequency: value })} options={[
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "half_yearly", label: "Half yearly" },
              { value: "yearly", label: "Yearly" },
              { value: "one_time", label: "One time" },
            ]} />
            <TextInput label="Next due date" value={insuranceForm.nextDueDate} onChange={(value) => setInsuranceForm({ ...insuranceForm, nextDueDate: value })} type="date" />
            <Select label="Payment account" value={insuranceForm.accountId} onChange={(value) => setInsuranceForm({ ...insuranceForm, accountId: value })} options={accountOptions(spendingAccounts, "Not linked")} />
            <Textarea label="Notes" value={insuranceForm.notes} onChange={(value) => setInsuranceForm({ ...insuranceForm, notes: value })} />
            <div className="md:col-span-2">
              <button className={primaryButtonClass}>
                <Plus size={16} />
                Add insurance
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {activeModal === "investment" || activeModal === "fixedDeposit" ? (
        <Modal
          title={editingInvestmentId ? (isFixedDeposit ? "Edit FD" : "Edit investment") : activeModal === "fixedDeposit" ? "Add FD" : "Add investment"}
          onClose={() => { resetInvestmentForm(); setActiveModal(null); }}
        >
          <form onSubmit={addInvestment} className="grid gap-3 md:grid-cols-2">
            <TextInput label="Name" value={investmentForm.name} onChange={(value) => setInvestmentForm({ ...investmentForm, name: value })} placeholder="Parag Parikh SIP, SBI FD, PPF" required />
            {activeModal === "fixedDeposit" ? (
              <Mini label="Type" value="Fixed deposit" />
            ) : (
              <Select label="Type" value={investmentForm.investmentType} onChange={(value) => setInvestmentForm({ ...investmentForm, investmentType: value })} options={investmentTypes} />
            )}
            {isFixedDeposit ? (
              <>
                <TextInput label="Principal amount" value={investmentForm.investedAmount} onChange={(value) => setInvestmentForm({ ...investmentForm, investedAmount: value, currentValue: investmentForm.currentValue || value })} inputMode="decimal" placeholder="0" />
                <TextInput label="Current value" value={investmentForm.currentValue} onChange={(value) => setInvestmentForm({ ...investmentForm, currentValue: value })} inputMode="decimal" placeholder="Leave blank to estimate" />
                <TextInput label="Interest rate %" value={investmentForm.interestRate} onChange={(value) => setInvestmentForm({ ...investmentForm, interestRate: value })} inputMode="decimal" placeholder="7.1" />
                <TextInput label="Maturity amount" value={investmentForm.maturityAmount} onChange={(value) => setInvestmentForm({ ...investmentForm, maturityAmount: value })} inputMode="decimal" placeholder="Leave blank to estimate" />
                <TextInput label="Start date" value={investmentForm.startDate} onChange={(value) => setInvestmentForm({ ...investmentForm, startDate: value })} type="date" />
                <TextInput label="Maturity date" value={investmentForm.maturityDate} onChange={(value) => setInvestmentForm({ ...investmentForm, maturityDate: value })} type="date" />
                <Select label="Linked bank account" value={investmentForm.accountId} onChange={(value) => setInvestmentForm({ ...investmentForm, accountId: value })} options={accountOptions(spendingAccounts, "Not linked")} />
              </>
            ) : (
              <>
                <TextInput label="Scheme code" value={investmentForm.schemeCode} onChange={(value) => setInvestmentForm({ ...investmentForm, schemeCode: value })} placeholder="MFapi/AMFI code, optional" />
                <TextInput label="Units" value={investmentForm.units} onChange={(value) => setInvestmentForm({ ...investmentForm, units: value })} inputMode="decimal" placeholder="Optional, best for NAV refresh" />
                <TextInput label="Invested amount" value={investmentForm.investedAmount} onChange={(value) => setInvestmentForm({ ...investmentForm, investedAmount: value })} inputMode="decimal" placeholder="0" />
                <TextInput label="Current value" value={investmentForm.currentValue} onChange={(value) => setInvestmentForm({ ...investmentForm, currentValue: value })} inputMode="decimal" placeholder="0" />
                <TextInput label="Monthly SIP" value={investmentForm.monthlySip} onChange={(value) => setInvestmentForm({ ...investmentForm, monthlySip: value })} inputMode="decimal" placeholder="0" />
                <TextInput label="SIP day" value={investmentForm.sipDay} onChange={(value) => setInvestmentForm({ ...investmentForm, sipDay: value })} inputMode="numeric" placeholder="3" />
                <TextInput label="Next SIP date" value={investmentForm.nextSipDate} onChange={(value) => setInvestmentForm({ ...investmentForm, nextSipDate: value })} type="date" />
                <Select label="SIP source account" value={investmentForm.accountId} onChange={(value) => setInvestmentForm({ ...investmentForm, accountId: value })} options={accountOptions(spendingAccounts, "Not linked")} />
              </>
            )}
            <Textarea label="Notes" value={investmentForm.notes} onChange={(value) => setInvestmentForm({ ...investmentForm, notes: value })} />
            <div className="md:col-span-2">
              <button className={primaryButtonClass}>
                <Plus size={16} />
                {editingInvestmentId ? (isFixedDeposit ? "Save FD" : "Save investment") : isFixedDeposit ? "Add FD" : "Add investment"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function buildSummary(finance: FinancePayload) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const cash = finance.accounts.filter((account) => ["bank", "cash", "wallet"].includes(account.type)).reduce((sum, account) => sum + account.balance, 0);
  const creditOutstanding = finance.accounts.filter((account) => account.type === "credit_card").reduce((sum, account) => sum + account.balance, 0);
  const investmentAccounts = finance.accounts.filter((account) => account.type === "investment").reduce((sum, account) => sum + account.balance, 0);
  const fixedDeposits = finance.investments.filter(isFixedDepositInvestment);
  const marketInvestments = finance.investments.filter((investment) => !isFixedDepositInvestment(investment));
  const investmentRecords = marketInvestments.reduce((sum, investment) => sum + investment.currentValue, 0);
  const fixedDepositRecords = fixedDeposits.reduce((sum, investment) => sum + investment.currentValue, 0);
  const monthTransactions = finance.transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
  const monthIncome = monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthSpend = monthTransactions.filter((transaction) => transaction.type === "expense" || transaction.type === "insurance_premium").reduce((sum, transaction) => sum + transaction.amount, 0);
  const categoryTotals = new Map<string, number>();
  for (const transaction of monthTransactions) {
    if (transaction.type !== "expense" && transaction.type !== "insurance_premium") continue;
    const label = labelFor(finance.categories, transaction.categoryId) ?? "Uncategorized";
    categoryTotals.set(label, (categoryTotals.get(label) ?? 0) + transaction.amount);
  }
  return {
    cash,
    creditOutstanding,
    investments: investmentAccounts + investmentRecords + fixedDepositRecords,
    marketInvestments: investmentAccounts + investmentRecords,
    fixedDeposits: fixedDepositRecords,
    monthIncome,
    monthSpend,
    categorySpend: [...categoryTotals.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6),
  };
}

function buildFinanceAnalytics(finance: FinancePayload, summary: ReturnType<typeof buildSummary>) {
  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const netCashflow = summary.monthIncome - summary.monthSpend;
  const savingsRate = summary.monthIncome > 0 ? Math.round((netCashflow / summary.monthIncome) * 100) : 0;
  const dailyAverageSpend = Math.round((summary.monthSpend / dayOfMonth) * 100) / 100;
  const projectedMonthSpend = Math.round(dailyAverageSpend * daysInMonth * 100) / 100;
  const topCategory = summary.categorySpend[0];
  const reviewCount = finance.transactions.filter((transaction) => transaction.needsReview).length;
  const creditLimit = finance.accounts.filter((account) => account.type === "credit_card").reduce((sum, account) => sum + (account.creditLimit ?? 0), 0);
  const creditUsePercent = creditLimit > 0 ? Math.round((summary.creditOutstanding / creditLimit) * 100) : 0;

  let score = 70;
  if (summary.monthIncome > 0 && savingsRate >= 25) score += 15;
  if (summary.monthIncome > 0 && savingsRate < 10) score -= 15;
  if (summary.monthSpend > summary.monthIncome && summary.monthIncome > 0) score -= 20;
  if (summary.creditOutstanding > 0) score -= creditUsePercent > 40 ? 15 : 6;
  if (reviewCount > 0) score -= 8;
  if (summary.cash < Math.max(5000, summary.monthSpend * 0.35)) score -= 8;
  score = Math.max(0, Math.min(100, score));

  const insights = [
    summary.monthIncome > 0
      ? `You are ${netCashflow >= 0 ? "positive" : "negative"} by ${formatCurrency(Math.abs(netCashflow))} this month.`
      : "No monthly income is logged yet, so savings rate and cashflow are incomplete.",
    `At the current pace, this month may end near ${formatCurrency(projectedMonthSpend)} in spending.`,
    topCategory ? `${topCategory.label} is your highest spend category at ${formatCurrency(topCategory.amount)}.` : "No category spend is available for this month yet.",
    summary.creditOutstanding > 0
      ? `Credit card outstanding is ${formatCurrency(summary.creditOutstanding)}${creditLimit > 0 ? `, about ${creditUsePercent}% of total card limit` : ""}.`
      : "No credit card outstanding is currently logged.",
  ];

  const tips: string[] = [];
  if (reviewCount > 0) tips.push(`Review ${reviewCount} imported transaction${reviewCount === 1 ? "" : "s"} so reports stay accurate.`);
  if (summary.monthIncome <= 0) tips.push("Log salary/income first; without income the dashboard cannot judge savings properly.");
  if (summary.monthIncome > 0 && savingsRate < 20) tips.push("Aim for a 20%+ savings rate this month by setting a weekly spend cap.");
  if (topCategory && summary.monthSpend > 0 && topCategory.amount / summary.monthSpend > 0.45) tips.push(`Your ${topCategory.label} spend is concentrated; set a small cap or split it into clearer subcategories.`);
  if (summary.creditOutstanding > 0) tips.push("Clear or schedule credit-card payments before the due date to avoid carrying balance.");
  if (dailyAverageSpend > 0) tips.push(`Use ${formatCurrency(dailyAverageSpend)} as today's baseline; spend below it to improve the month-end projection.`);
  if (tips.length < 3) tips.push("Keep adding account-linked transactions daily; the tips become sharper as the data improves.");

  return {
    score,
    netCashflow,
    savingsRate,
    dailyAverageSpend,
    projectedMonthSpend,
    insights,
    tips: tips.slice(0, 5),
  };
}

async function readFinanceResponse(response: Response): Promise<FinanceResponse> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as FinanceResponse;
  } catch {
    return {
      message: response.ok
        ? "Finance server returned an unreadable response."
        : "Finance server returned an error. Restart the local server and try again.",
    };
  }
}

function buildReminders(finance: FinancePayload) {
  return {
    creditCards: finance.accounts
      .filter((account) => account.type === "credit_card" && account.paymentDueDay)
      .map((account) => {
        const dueDate = nextDayOfMonth(account.paymentDueDay ?? 1);
        return {
          id: account.id,
          name: account.name,
          outstanding: account.balance,
          days: daysUntil(dueDate),
          dueDateLabel: dueDate.toISOString().slice(0, 10),
        };
      })
      .sort((a, b) => a.days - b.days),
    fixedDeposits: finance.investments
      .filter((investment) => isFixedDepositInvestment(investment) && investment.maturityDate)
      .map((investment) => ({
        id: investment.id,
        name: investment.name,
        maturityAmount: investment.maturityAmount ?? investment.currentValue,
        maturityDate: investment.maturityDate?.slice(0, 10) ?? "Not set",
        days: daysUntilIso(investment.maturityDate),
      }))
      .sort((a, b) => a.days - b.days),
  };
}

function isFixedDepositInvestment(investment: FinanceInvestment) {
  return /fixed deposit|^fd$/i.test(investment.investmentType.trim());
}

function accountOptions(accounts: FinanceAccount[], emptyLabel?: string) {
  return [
    { value: "", label: emptyLabel ?? (accounts.length ? "Choose account" : "Add account first") },
    ...accounts.map((account) => ({ value: account.id, label: `${account.name} (${account.type.replace("_", " ")})` })),
  ];
}

function needsTargetAccount(type: FinanceTransactionType) {
  return type === "transfer" || type === "credit_card_payment" || type === "investment_contribution";
}

function sourceAccountLabel(type: FinanceTransactionType) {
  if (type === "income") return "Add to account";
  if (type === "credit_card_payment") return "Pay from bank/account";
  if (type === "investment_contribution") return "Invest from account";
  return "Account/card";
}

function targetAccountLabel(type: FinanceTransactionType) {
  if (type === "credit_card_payment") return "Credit card";
  if (type === "investment_contribution") return "Investment account";
  return "To account";
}

function formatSignedTransaction(transaction: FinanceTransaction) {
  const sign = transaction.type === "income" ? "+" : transaction.type === "transfer" || transaction.type === "credit_card_payment" ? "" : "-";
  return `${sign}${formatCurrency(transaction.amount, transaction.currency)}`;
}

function labelFor(categories: FinanceCategory[], categoryId?: string) {
  return categories.find((category) => category.id === categoryId)?.name;
}

function nextDayOfMonth(day: number) {
  const now = new Date();
  const due = new Date(now.getFullYear(), now.getMonth(), Math.min(28, Math.max(1, day)));
  if (due < new Date(now.toDateString())) due.setMonth(due.getMonth() + 1);
  return due;
}

function daysUntil(date: Date) {
  const today = new Date(new Date().toDateString()).getTime();
  return Math.ceil((date.getTime() - today) / 86_400_000);
}

function daysUntilIso(value?: string) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return daysUntil(date);
}

function fdDaysLabel(days: number) {
  if (days < 0) return `Matured ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Matures today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function accountNameFor(accounts: FinanceAccount[], accountId?: string) {
  if (!accountId) return "Not linked";
  return accounts.find((account) => account.id === accountId)?.name ?? "Not linked";
}

function Metric({ icon, label, value, danger = false, success = false }: { icon: ReactNode; label: string; value: string; danger?: boolean; success?: boolean }) {
  return (
    <article className="min-h-[140px] rounded-lg border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={cn("inline-flex rounded-lg border bg-surface p-2 text-muted", danger && "border-danger/25 bg-danger/10 text-danger", success && "border-success/25 bg-success/10 text-success")}>{icon}</div>
      <div className="mt-4 break-words text-2xl font-semibold tracking-normal">{value}</div>
      <div className="mt-1 text-xs font-medium text-muted">{label}</div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[62px] rounded-lg border bg-card px-3 py-2.5 shadow-sm">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 break-words font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed bg-surface px-3 py-8 text-center text-sm leading-6 text-muted">{text}</div>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold", tone === "warning" ? "border-warning/40 bg-warning/10 text-warning" : "bg-surface text-muted")}>
      {children}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-6 backdrop-blur-md sm:py-10">
      <div className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lift">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-surface text-muted shadow-sm transition hover:border-danger/40 hover:text-danger" aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        className="mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition placeholder:text-muted/55 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        required={required}
      />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm md:col-span-2">
      <span className="font-medium text-muted">{label}</span>
      <textarea className="mt-1 min-h-24 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-muted/55 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15" value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-muted">{label}</span>
      <select className="mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
