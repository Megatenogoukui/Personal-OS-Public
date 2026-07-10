"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildModuleSnapshots, type ManualModule as ModuleKey, type ManualRecord } from "@personal-os/core";
import { ModuleBreakdown, ModuleHealthGrid } from "./ModuleHealth";
import { formatCurrency, todayIso } from "@/lib/utils";

const moduleConfig: Record<ModuleKey, { title: string; eyebrow: string; amountLabel: string; unit: string; placeholder: string; categories: string[] }> = {
  finance: {
    title: "Money tracker",
    eyebrow: "Finance",
    amountLabel: "Amount",
    unit: "INR",
    placeholder: "Food, salary, subscription, bill, investment",
    categories: ["Income", "Food", "Transport", "Shopping", "Subscription", "Investment", "Bills", "Other"],
  },
  workout: {
    title: "Training log",
    eyebrow: "Workout",
    amountLabel: "Duration",
    unit: "min",
    placeholder: "Push day, pull day, legs, cardio",
    categories: ["Push", "Pull", "Legs", "Cardio", "Core", "Mobility", "Rest"],
  },
  diet: {
    title: "Diet log",
    eyebrow: "Diet",
    amountLabel: "Calories",
    unit: "kcal",
    placeholder: "Meal, protein, water, snack",
    categories: ["Breakfast", "Lunch", "Snack", "Dinner", "Water", "Protein"],
  },
  reading: {
    title: "Reading tracker",
    eyebrow: "Reading",
    amountLabel: "Pages",
    unit: "pages",
    placeholder: "Book title or highlight",
    categories: ["Book", "Article", "Notes", "Highlight", "Action item"],
  },
  goals: {
    title: "Goals tracker",
    eyebrow: "Goals",
    amountLabel: "Progress",
    unit: "%",
    placeholder: "Goal progress or next action",
    categories: ["Work", "Finance", "Health", "Reading", "Personal"],
  },
  habits: {
    title: "Habit tracker",
    eyebrow: "Habits",
    amountLabel: "Count",
    unit: "count",
    placeholder: "Habit completed or missed",
    categories: ["Done", "Skipped", "Deferred", "Blocked"],
  },
};

export function ManualModule({ module }: { module: ModuleKey }) {
  const config = moduleConfig[module]!;
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(config.categories[0] ?? "Other");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Ready.");

  async function load() {
    const response = await fetch(`/api/manual/${module}`, { cache: "no-store" });
    const body = (await response.json()) as { records: ManualRecord[] };
    setRecords(body.records);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/manual/${module}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date: todayIso(),
        title,
        amount: amount ? Number(amount) : undefined,
        unit: config.unit,
        category,
        notes,
      }),
    });
    if (!response.ok) {
      setStatus("Could not save entry.");
      return;
    }
    setTitle("");
    setAmount("");
    setNotes("");
    setStatus("Saved.");
    await load();
  }

  useEffect(() => {
    void load();
  }, [module]);

  const total = records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
  const snapshot = useMemo(() => buildModuleSnapshots(records).find((item) => item.module === module), [module, records]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-xs uppercase tracking-widest text-muted">{config.eyebrow}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">{config.title}</h1>
        {snapshot ? <p className="mt-2 text-sm leading-6 text-muted">{snapshot.nextAction}</p> : null}
      </section>
      {snapshot ? <ModuleHealthGrid modules={[snapshot]} /> : null}
      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Quick add</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-muted">Title</span>
              <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-accent" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={config.placeholder} required />
            </label>
            <label className="block text-sm">
              <span className="text-muted">{config.amountLabel}</span>
              <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-accent" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Category</span>
              <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-accent" value={category} onChange={(event) => setCategory(event.target.value)}>
                {config.categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Notes</span>
              <textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-accent" value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} />
            </label>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              <Plus size={16} />
              Add entry
            </button>
            <div className="text-sm text-muted">{status}</div>
          </div>
        </form>
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent entries</h2>
            <div className="rounded-lg border bg-background px-3 py-2 text-sm">
              Total: {module === "finance" ? formatCurrency(total) : `${total.toLocaleString()} ${config.unit}`}
            </div>
          </div>
          <div className="mt-4 divide-y">
            {records.map((record) => (
              <article key={record.id} className="grid gap-2 py-3 md:grid-cols-[1fr_140px_120px] md:items-center">
                <div>
                  <div className="font-medium">{record.title}</div>
                  <div className="text-xs text-muted">{record.date.slice(0, 10)} - {record.category ?? "Uncategorized"}</div>
                  {record.notes ? <div className="mt-1 text-sm text-muted">{record.notes}</div> : null}
                </div>
                <div className="text-sm">{record.amount ?? 0} {record.unit}</div>
                <div className="rounded-lg border bg-background px-2 py-1 text-center text-xs text-muted">{record.status ?? "logged"}</div>
              </article>
            ))}
            {records.length === 0 ? <div className="py-12 text-center text-sm text-muted">No entries yet.</div> : null}
          </div>
        </section>
      </section>
      {snapshot ? <ModuleBreakdown module={snapshot} /> : null}
    </div>
  );
}
