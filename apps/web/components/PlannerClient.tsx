"use client";

import { Check, CircleSlash, RefreshCcw, Send, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { DailyPlan, DailyPlanItem } from "@personal-os/core";
import { cn } from "@/lib/utils";

export function PlannerClient() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [status, setStatus] = useState("Generate today's plan.");

  async function generate() {
    setStatus("Generating...");
    const response = await fetch("/api/planner/daily", { method: "POST" });
    const body = (await response.json()) as { plan: DailyPlan };
    setPlan(body.plan);
    setStatus("Plan generated from current dashboard data.");
  }

  function setItemStatus(id: string, nextStatus: DailyPlanItem["status"]) {
    setPlan((current) => {
      if (!current) return current;
      const update = (item: DailyPlanItem): DailyPlanItem => item.id === id ? { ...item, status: nextStatus } : item;
      return {
        ...current,
        items: current.items.map(update),
        sections: current.sections.map((section) => ({
          ...section,
          items: section.items.map(update),
        })),
      };
    });
  }

  useEffect(() => {
    void generate();
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Daily planner</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">What should I do today?</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{status}</p>
          </div>
          <button onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            <RefreshCcw size={16} />
            Regenerate
          </button>
        </div>
      </section>
      {plan ? (
        <section className="space-y-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted">Today's focus</div>
            <div className="mt-1 text-xl font-semibold">{plan.focus}</div>
            <div className="mt-2 text-sm text-muted">{plan.summary}</div>
          </div>
          {plan.sections.map((section) => (
            <section key={section.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                  <div className="mt-1 text-sm text-muted">{section.intent}</div>
                </div>
                <span className="rounded-lg border bg-background px-2 py-1 text-xs text-muted">{section.items.length}</span>
              </div>
              <div className="mt-4 divide-y">
                {section.items.map((item) => (
                  <article key={`${section.id}:${item.id}`} className="grid gap-3 py-3 lg:grid-cols-[120px_1fr_280px] lg:items-center">
                    <span className={cn("rounded-lg border px-2 py-1 text-center text-xs capitalize", item.priority === "critical" && "border-danger text-danger", item.priority === "high" && "border-warning text-warning", item.status === "done" && "border-success text-success")}>{item.priority}</span>
                    <div>
                      <div className={cn("font-medium", item.status === "done" && "text-muted")}>{item.label}</div>
                      <div className="mt-1 text-sm leading-6 text-muted">{item.reason}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <ActionButton label="Done" icon={<Check size={14} />} active={item.status === "done"} onClick={() => setItemStatus(item.id, "done")} />
                      <ActionButton label="Defer" icon={<Send size={14} />} active={item.status === "deferred"} onClick={() => setItemStatus(item.id, "deferred")} />
                      <ActionButton label="Block" icon={<ShieldAlert size={14} />} active={item.status === "blocked"} onClick={() => setItemStatus(item.id, "blocked")} />
                      <ActionButton label="Skip" icon={<CircleSlash size={14} />} active={item.status === "skipped"} onClick={() => setItemStatus(item.id, "skipped")} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ActionButton({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs", active && "border-accent bg-accent text-white")}>
      {icon}
      {label}
    </button>
  );
}
