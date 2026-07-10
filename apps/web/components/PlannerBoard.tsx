"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleSlash,
  Clock3,
  CreditCard,
  Dumbbell,
  ListChecks,
  RefreshCcw,
  Send,
  ShieldAlert,
  Utensils,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CommandAction, CommandArea, CommandCenter, CommandPriority, CommandTimelineBlock } from "@personal-os/core";
import { cn } from "@/lib/utils";

type ItemStatus = "todo" | "done" | "deferred" | "blocked" | "skipped";

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";

const areaIcon: Record<CommandArea, React.ComponentType<{ size?: number; className?: string }>> = {
  work: Workflow,
  finance: CreditCard,
  workout: Dumbbell,
  diet: Utensils,
  reading: BookOpen,
  habits: ListChecks,
  review: CheckCircle2,
};

const areaLabel: Record<CommandArea, string> = {
  work: "Work",
  finance: "Finance",
  workout: "Workout",
  diet: "Diet",
  reading: "Reading",
  habits: "Habits",
  review: "Review",
};

export function PlannerBoard({ center }: { center: CommandCenter }) {
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const completedCount = Object.values(statuses).filter((status) => status === "done").length;
  const actionable = center.actions.filter((item) => item.area !== "review");
  const grouped = useMemo(() => ({
    critical: actionable.filter((item) => item.priority === "critical"),
    high: actionable.filter((item) => item.priority === "high"),
    medium: actionable.filter((item) => item.priority === "medium"),
    low: actionable.filter((item) => item.priority === "low"),
  }), [actionable]);

  function updateStatus(id: string, status: ItemStatus) {
    setStatuses((current) => ({ ...current, [id]: status }));
  }

  function resetLocalProgress() {
    setStatuses({});
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "border-accent/20 bg-[linear-gradient(135deg,rgba(15,143,132,0.10),rgba(255,255,255,0)_48%)]")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Clock3 size={14} />
              Daily planner
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-normal sm:text-4xl">Your entire day, ordered by priority.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Start with critical work and open habits, keep food/training on track, review money, read at night, and close the day with a clean review.
            </p>
          </div>
          <article className="rounded-lg border bg-card/85 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Today&apos;s first move</div>
                <h2 className="mt-2 text-xl font-semibold">{center.nextAction.title}</h2>
              </div>
              <PriorityBadge priority={center.nextAction.priority} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{center.nextAction.why}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Mini label="Critical" value={String(grouped.critical.length)} tone={grouped.critical.length ? "danger" : "success"} />
              <Mini label="High" value={String(grouped.high.length)} tone={grouped.high.length ? "warning" : "success"} />
              <Mini label="Done" value={String(completedCount)} tone={completedCount ? "success" : "neutral"} />
            </div>
            <button type="button" onClick={resetLocalProgress} className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
              <RefreshCcw size={14} />
              Reset local ticks
            </button>
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PlannerMetric label="System score" value={`${center.completionScore}`} helper="Average of all life systems" tone={scoreTone(center.completionScore)} />
        <PlannerMetric label="Focus score" value={`${center.focusScore}`} helper="Lower when urgent items pile up" tone={scoreTone(center.focusScore)} />
        <PlannerMetric label="Work load" value={`${center.analytics.work.dueSoon}`} helper="Due within 48 hours" tone={center.analytics.work.dueSoon ? "warning" : "success"} />
        <PlannerMetric label="Diet" value={center.analytics.diet.loggedToday ? "Logged" : "Open"} helper={center.analytics.diet.nextAction} tone={center.analytics.diet.loggedToday ? "success" : "warning"} />
        <PlannerMetric label="Habits" value={`${center.analytics.habits.mandatoryTodayRate}%`} helper="Mandatory close rate today" tone={center.analytics.habits.mandatoryTodayRate === 100 ? "success" : "warning"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-accent" />
            <h2 className="text-2xl font-semibold">Full-day timeline</h2>
          </div>
          <div className="mt-5 space-y-3">
            {center.timeline.map((block) => (
              <TimelineBlock key={block.id} block={block} status={statuses[block.id] ?? "todo"} onStatus={(status) => updateStatus(block.id, status)} />
            ))}
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <h2 className="text-2xl font-semibold">Priority stack</h2>
          </div>
          <div className="mt-5 space-y-4">
            <PriorityGroup title="Critical" items={grouped.critical} statuses={statuses} onStatus={updateStatus} empty="No critical item right now." />
            <PriorityGroup title="High" items={grouped.high} statuses={statuses} onStatus={updateStatus} empty="No high-priority item right now." />
            <PriorityGroup title="Medium" items={grouped.medium.slice(0, 5)} statuses={statuses} onStatus={updateStatus} empty="No medium item right now." />
          </div>
        </section>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">System checklist</div>
            <h2 className="mt-1 text-2xl font-semibold">What “done today” means</h2>
          </div>
          <Link href="/" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
            Home
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {center.domains.map((domain) => {
            const Icon = areaIcon[domain.id];
            return (
              <Link key={domain.id} href={domain.href} className="rounded-lg border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-accent"><Icon size={18} /></span>
                    <div>
                      <h3 className="font-semibold">{domain.label}</h3>
                      <div className="mt-1 text-xs text-muted">{domain.subMetric}</div>
                    </div>
                  </div>
                  <span className={cn("rounded-lg border px-2.5 py-1.5 text-sm font-semibold", domain.score >= 80 ? "border-success/25 bg-success/10 text-success" : domain.score >= 55 ? "border-warning/30 bg-warning/10 text-warning" : "border-danger/25 bg-danger/10 text-danger")}>{domain.score}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{domain.nextAction}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TimelineBlock({ block, status, onStatus }: { block: CommandTimelineBlock; status: ItemStatus; onStatus: (status: ItemStatus) => void }) {
  const Icon = areaIcon[block.area];
  return (
    <article className={cn("rounded-lg border bg-surface p-4", status === "done" && "border-success/30 bg-success/10")}>
      <div className="grid gap-4 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
        <div>
          <div className="text-lg font-semibold text-accent">{block.time}</div>
          <div className="mt-1 text-xs font-medium text-muted">{areaLabel[block.area]}</div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Icon size={16} className="text-muted" />
                <h3 className={cn("break-words text-base font-semibold", status === "done" && "text-muted")}>{block.title}</h3>
                <PriorityBadge priority={block.priority} />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{block.detail}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <StatusButton label="Done" icon={<Check size={14} />} active={status === "done"} onClick={() => onStatus("done")} />
              <StatusButton label="Defer" icon={<Send size={14} />} active={status === "deferred"} onClick={() => onStatus("deferred")} />
              <StatusButton label="Block" icon={<ShieldAlert size={14} />} active={status === "blocked"} onClick={() => onStatus("blocked")} />
              <Link href={block.href} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border bg-card px-2 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
                Open
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {block.actions.map((item) => <div key={item} className="rounded-lg border bg-card px-3 py-2 text-xs leading-5 text-muted">{item}</div>)}
          </div>
        </div>
      </div>
    </article>
  );
}

function PriorityGroup({ title, items, statuses, onStatus, empty }: { title: string; items: CommandAction[]; statuses: Record<string, ItemStatus>; onStatus: (id: string, status: ItemStatus) => void; empty: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
        <span className="rounded-lg border bg-surface px-2 py-1 text-xs text-muted">{items.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item) => <ActionCard key={item.id} item={item} status={statuses[item.id] ?? "todo"} onStatus={(status) => onStatus(item.id, status)} />)}
        {items.length === 0 ? <div className="rounded-lg border border-dashed bg-surface px-3 py-6 text-center text-sm text-muted">{empty}</div> : null}
      </div>
    </div>
  );
}

function ActionCard({ item, status, onStatus }: { item: CommandAction; status: ItemStatus; onStatus: (status: ItemStatus) => void }) {
  const Icon = areaIcon[item.area];
  return (
    <article className={cn("rounded-lg border bg-surface p-3", status === "done" && "border-success/30 bg-success/10")}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={15} className="text-accent" />
        <h4 className="font-semibold">{item.title}</h4>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">{item.why}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusButton label="Done" icon={<Check size={14} />} active={status === "done"} onClick={() => onStatus("done")} />
        <StatusButton label="Defer" icon={<Send size={14} />} active={status === "deferred"} onClick={() => onStatus("deferred")} />
        <StatusButton label="Skip" icon={<CircleSlash size={14} />} active={status === "skipped"} onClick={() => onStatus("skipped")} />
        <Link href={item.href} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border bg-card px-2 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
          Open
        </Link>
      </div>
    </article>
  );
}

function StatusButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-8 items-center justify-center gap-1 rounded-lg border bg-card px-2 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent", active && "border-accent bg-accent text-white hover:text-white")}>
      {icon}
      {label}
    </button>
  );
}

function PlannerMetric({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-soft", tone === "success" && "border-success/25 bg-success/5", tone === "warning" && "border-warning/25 bg-warning/5", tone === "danger" && "border-danger/25 bg-danger/5")}>
      <div className={cn("text-2xl font-semibold", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{value}</div>
      <div className="mt-1 text-sm font-medium text-muted">{label}</div>
      <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{helper}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <div className={cn("rounded-lg border bg-surface px-3 py-2", tone === "success" && "border-success/25 bg-success/10", tone === "warning" && "border-warning/25 bg-warning/10", tone === "danger" && "border-danger/25 bg-danger/10")}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: CommandPriority }) {
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-semibold capitalize",
      priority === "critical" && "border-danger/30 bg-danger/10 text-danger",
      priority === "high" && "border-warning/30 bg-warning/10 text-warning",
      priority === "medium" && "border-accent/30 bg-accent/10 text-accent",
      priority === "low" && "bg-card text-muted",
    )}>{priority}</span>
  );
}

function scoreTone(score: number) {
  if (score >= 80) return "success";
  if (score >= 55) return "warning";
  return "danger";
}
