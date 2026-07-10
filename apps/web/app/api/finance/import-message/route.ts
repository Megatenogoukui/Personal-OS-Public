import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { FinanceAccount, FinanceCategory, FinanceTransaction, FinanceTransactionType, StoredData } from "@personal-os/core";
import { addNotification, readStore, writeStore } from "@/lib/server/local-store";

export const runtime = "nodejs";

type ImportMessageBody = {
  text?: string;
  sender?: string;
  source?: string;
  receivedAt?: string;
  secret?: string;
};

type ParsedMessage = {
  type: FinanceTransactionType;
  title: string;
  amount: number;
  currency: string;
  date: string;
  merchant?: string;
  accountId?: string;
  categoryId?: string;
  confidence: number;
  notes: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as ImportMessageBody;
  const auth = authorize(request, body);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const text = stringValue(body.text);
  if (!text) {
    console.warn("finance_import_message_rejected", {
      reason: "missing_text",
      sender: safePreview(body.sender),
      keys: Object.keys(body),
    });
    return NextResponse.json({ message: "Message text is required." }, { status: 400 });
  }

  const store = await readStore();
  const importHash = hashMessage(text, body.sender);
  const existing = store.financeTransactions.find((transaction) => transaction.importHash === importHash);
  if (existing) {
    return NextResponse.json({ finance: financeSnapshot(store), transaction: existing, duplicate: true });
  }

  const parsed = parseFinanceMessage(text, store, body);
  if (!parsed) {
    console.warn("finance_import_message_rejected", {
      reason: "amount_not_found",
      sender: safePreview(body.sender),
      textLength: text.length,
    });
    return NextResponse.json({ message: "Could not find an amount in this message.", parsed: null }, { status: 400 });
  }

  const accounts = store.financeAccounts.map((account) => ({ ...account }));
  const account = parsed.accountId ? accounts.find((item) => item.id === parsed.accountId) : undefined;
  if (account) {
    adjustAccount(account, parsed.type === "income" ? parsed.amount : account.type === "credit_card" ? parsed.amount : -parsed.amount);
  }

  const now = new Date().toISOString();
  const transaction: FinanceTransaction = {
    id: `transaction:${crypto.randomUUID()}`,
    date: parsed.date,
    type: parsed.type,
    title: parsed.title,
    amount: parsed.amount,
    currency: parsed.currency,
    ...(account ? { accountId: account.id } : {}),
    ...(parsed.categoryId ? { categoryId: parsed.categoryId } : {}),
    ...(parsed.merchant ? { merchant: parsed.merchant } : {}),
    source: "iphone_message",
    needsReview: true,
    rawText: text,
    importHash,
    confidence: parsed.confidence,
    importedAt: now,
    notes: parsed.notes,
    createdAt: now,
    updatedAt: now,
  };

  const next = await writeStore({
    ...store,
    financeAccounts: accounts,
    financeTransactions: [transaction, ...store.financeTransactions],
  });

  await addNotification({
    area: "finance",
    priority: parsed.confidence >= 0.75 ? "medium" : "high",
    title: "Message transaction imported",
    body: `${transaction.title}: ${transaction.currency} ${transaction.amount.toLocaleString("en-IN")} needs review.`,
  });

  return NextResponse.json({ finance: financeSnapshot(next), transaction, parsed, duplicate: false, authWarning: auth.warning });
}

function authorize(request: Request, body: ImportMessageBody): { ok: true; warning?: string } | { ok: false; status: number; message: string } {
  const configured = process.env.FINANCE_IMPORT_SECRET;
  const provided = request.headers.get("x-personal-os-secret") ?? stringValue(body.secret);
  if (configured) {
    return provided === configured ? { ok: true } : { ok: false, status: 401, message: "Invalid finance import secret." };
  }
  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 500, message: "FINANCE_IMPORT_SECRET must be configured before message imports are allowed in production." };
  }
  return { ok: true, warning: "FINANCE_IMPORT_SECRET is not configured. Dev import accepted without token." };
}

function parseFinanceMessage(text: string, store: StoredData, body: ImportMessageBody): ParsedMessage | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const amount = parseAmount(normalized);
  if (!amount) return null;

  const type = inferType(normalized);
  const merchant = inferMerchant(normalized);
  const account = matchAccount(normalized, store.financeAccounts, body.sender);
  const category = inferCategory(normalized, merchant, type, store.financeCategories);
  const date = normalizeDate(body.receivedAt) ?? inferDate(normalized) ?? new Date().toISOString().slice(0, 10);
  const title = merchant || inferTitle(normalized, type);
  const confidence = scoreConfidence({ account, merchant, category, type, amount, normalized });

  return {
    type,
    title,
    amount,
    currency: inferCurrency(normalized),
    date,
    ...(merchant ? { merchant } : {}),
    ...(account ? { accountId: account.id } : {}),
    ...(category ? { categoryId: category.id } : {}),
    confidence,
    notes: [
      "Imported from iPhone message. Review account/category before treating as final.",
      `Sender: ${stringValue(body.sender) || "unknown"}.`,
      `Confidence: ${Math.round(confidence * 100)}%.`,
    ].join(" "),
  };
}

function parseAmount(text: string) {
  const patterns = [
    /(?:rs\.?|inr|₹)\s*[:.]?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    /([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:rs\.?|inr)/i,
    /\b(?:debited|debit|credited|credit|received|paid|spent|withdrawn|sent)\s+(?:by|for|of|with)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const amount = Number(match?.[1]?.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount * 100) / 100;
  }
  return null;
}

function inferType(text: string): FinanceTransactionType {
  if (/\b(credited|credit|received|deposited|refund|cashback|salary|cr)\b/i.test(text)) return "income";
  if (/\b(debited|debit|spent|paid|purchase|withdrawn|sent|dr|upi\/p2m|upi\/p2p)\b/i.test(text)) return "expense";
  return "expense";
}

function inferMerchant(text: string) {
  const cleaned = text.replace(/\s+/g, " ");
  const patterns = [
    /(?:\bat\b|\bto\b|\btowards\b|\bpaid to\b)\s+([A-Z0-9][A-Z0-9 .&'@_-]{2,70}?)(?=\s+(?:on|ref\s*no|refno|ref|rrn|upi|txn|transaction|available|avl|bal|balance|from|using)\b|[.;,]|$)/i,
    /(?:vpa|upi id)\s*[:\-]?\s*([a-z0-9._-]+@[a-z]+)/i,
    /(?:merchant|payee)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 .&'@_-]{2,70}?)(?=[.;,]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const merchant = cleanMerchant(match?.[1]);
    if (merchant) return merchant;
  }
  return undefined;
}

function cleanMerchant(value?: string) {
  const cleaned = stringValue(value)
    .replace(/\b(ref\s*no|refno|ref|rrn|txn|transaction|upi|id|no)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return undefined;
  return cleaned.slice(0, 80);
}

function inferTitle(text: string, type: FinanceTransactionType) {
  if (/upi/i.test(text)) return type === "income" ? "UPI received" : "UPI payment";
  if (/card/i.test(text)) return "Card transaction";
  if (/atm|withdraw/i.test(text)) return "ATM withdrawal";
  return type === "income" ? "Imported income" : "Imported expense";
}

function matchAccount(text: string, accounts: FinanceAccount[], sender?: string) {
  const lower = `${text} ${sender ?? ""}`.toLowerCase();
  const last4Matches = [...text.matchAll(/(?:xx+|x+\s*|ending\s+|ending\s+with\s+|no\.?\s*)?(\d{4})(?!\d)/gi)].map((match) => match[1]);
  const byLast4 = accounts.find((account) => account.last4 && last4Matches.includes(account.last4));
  if (byLast4) return byLast4;

  return accounts.find((account) => {
    const terms = accountSearchTerms(account);
    const compact = lower.replace(/[^a-z0-9]/g, "");
    return terms.some((term) => {
      const normalizedTerm = term.toLowerCase().trim();
      const compactTerm = normalizedTerm.replace(/[^a-z0-9]/g, "");
      return normalizedTerm.length >= 3 && (lower.includes(normalizedTerm) || compact.includes(compactTerm));
    });
  });
}

function accountSearchTerms(account: FinanceAccount) {
  const text = `${account.name} ${account.institution ?? ""}`.toLowerCase();
  const terms = [account.name, account.institution].filter(Boolean) as string[];
  const aliases: Array<[RegExp, string[]]> = [
    [/state bank of india|\bsbi\b/, ["sbi", "state bank", "statebankofindia"]],
    [/\bhdfc\b|hdfc bank/, ["hdfc", "hdfcbank"]],
    [/\bicici\b|icici bank/, ["icici", "icicibank"]],
    [/axis bank|\baxis\b/, ["axis", "axisbank"]],
    [/kotak/, ["kotak", "kotakbank"]],
    [/union bank|\bubi\b|\buboi\b|\bunionb\b/, ["union bank", "unionbank", "unionb", "ubi", "uboi"]],
    [/bank of baroda|\bbob\b/, ["bank of baroda", "bankofbaroda", "bob"]],
    [/idfc/, ["idfc", "idfcbank"]],
    [/yes bank/, ["yes bank", "yesbank"]],
    [/indusind/, ["indusind", "indusindbank"]],
  ];
  for (const [pattern, values] of aliases) {
    if (pattern.test(text)) terms.push(...values);
  }
  return [...new Set(terms)];
}

function inferCategory(text: string, merchant: string | undefined, type: FinanceTransactionType, categories: FinanceCategory[]) {
  if (type === "income") return categoryByName(categories, "Salary") ?? categoryByType(categories, "income");

  const haystack = `${text} ${merchant ?? ""}`.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ["Transfer", /\b(trf|transfer)\b/],
    ["Transport", /\b(petrol|fuel|diesel|uber|ola|metro|toll|parking|rapido)\b/],
    ["Food", /\b(food|restaurant|cafe|swiggy|zomato|pizza|kfc|mcd|blinkit|zepto|grocery|snack|dosa|egg|wrap|chocolate|kandori|kachori)\b/],
    ["Shopping", /\b(amazon|flipkart|myntra|shopping|dmart|mart|store)\b/],
    ["Bills", /\b(bill|electricity|recharge|airtel|jio|vi|broadband|gas|water)\b/],
    ["Health", /\b(pharmacy|medical|hospital|clinic|doctor|apollo)\b/],
    ["Subscription", /\b(netflix|spotify|youtube|subscription|apple\.com\/bill)\b/],
    ["Investment", /\b(sip|mutual fund|groww|zerodha|coin|investment)\b/],
  ];
  const matched = rules.find(([, pattern]) => pattern.test(haystack));
  return matched ? categoryByName(categories, matched[0]) : categoryByName(categories, "Other") ?? categoryByType(categories, "expense");
}

function categoryByName(categories: FinanceCategory[], name: string) {
  return categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
}

function categoryByType(categories: FinanceCategory[], type: FinanceCategory["type"]) {
  return categories.find((category) => category.type === type) ?? categories.find((category) => category.type === "any");
}

function inferDate(text: string) {
  const numericMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numericMatch) {
    const [, dayRaw, monthRaw, yearRaw] = numericMatch;
    return formatDateParts(dayRaw, monthRaw, yearRaw);
  }

  const compactMonthMatch = text.match(/\b(\d{1,2})[-\s]?([A-Z]{3,9})[-\s]?(\d{2,4})\b/i);
  if (!compactMonthMatch) return undefined;
  const [, dayRaw, monthNameRaw, yearRaw] = compactMonthMatch;
  const monthRaw = monthNumber(monthNameRaw);
  if (!monthRaw) return undefined;
  return formatDateParts(dayRaw, monthRaw, yearRaw);
}

function formatDateParts(dayRaw?: string, monthRaw?: string, yearRaw?: string) {
  if (!dayRaw || !monthRaw || !yearRaw) return undefined;
  const day = dayRaw.padStart(2, "0");
  const month = monthRaw.padStart(2, "0");
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${month}-${day}`;
}

function monthNumber(value?: string) {
  const key = stringValue(value).slice(0, 3).toLowerCase();
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  return months[key];
}

function normalizeDate(value?: string) {
  const raw = stringValue(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function scoreConfidence(input: {
  account: FinanceAccount | undefined;
  merchant: string | undefined;
  category: FinanceCategory | undefined;
  type: FinanceTransactionType;
  amount: number;
  normalized: string;
}) {
  let score = 0.45;
  if (input.amount > 0) score += 0.2;
  if (input.account) score += 0.15;
  if (input.merchant) score += 0.1;
  if (input.category) score += 0.05;
  if (/\b(debited|credited|spent|paid|received)\b/i.test(input.normalized)) score += 0.05;
  return Math.min(0.98, Math.round(score * 100) / 100);
}

function inferCurrency(text: string) {
  return /₹|rs\.?|inr/i.test(text) ? "INR" : "INR";
}

function adjustAccount(account: FinanceAccount, delta: number) {
  account.balance = Math.max(account.type === "credit_card" ? 0 : Number.NEGATIVE_INFINITY, Math.round((account.balance + delta) * 100) / 100);
  account.updatedAt = new Date().toISOString();
}

function hashMessage(text: string, sender?: string) {
  return createHash("sha256").update(`${sender ?? ""}\n${text.trim()}`).digest("hex").slice(0, 32);
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safePreview(value: unknown): string {
  return stringValue(value).replace(/\s+/g, " ").slice(0, 120);
}
