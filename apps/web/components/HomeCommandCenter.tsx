import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  CreditCard,
  Dumbbell,
  Flame,
  Landmark,
  ListChecks,
  ShieldCheck,
  Target,
  TrendingUp,
  Utensils,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { CommandAction, CommandCenter, CommandDomain, CommandInsight, CommandMetric, CommandTimelineBlock, CommandTone } from "@personal-os/core";
import { cn } from "@/lib/utils";

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";

const areaIcon = {
  work: Workflow,
  finance: Landmark,
  workout: Dumbbell,
  diet: Utensils,
  reading: BookOpen,
  habits: ListChecks,
  review: CheckCircle2,
};

export function HomeCommandCenter({ center }: { center: CommandCenter }) {
  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "overflow-hidden border-accent/20 bg-[linear-gradient(135deg,rgba(15,143,132,0.11),rgba(255,255,255,0)_45%),linear-gradient(180deg,rgba(15,23,42,0.03),rgba(255,255,255,0))]")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <Target size={14} />
              Operating dashboard
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-normal sm:text-4xl">{center.headline}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              This page combines work, finance, workout, diet, reading, and habits into one priority system. Start with the first action, then move through the timeline.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/planner" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90">
                Open full planner
                <ArrowUpRight size={16} />
              </Link>
              <Link href={center.nextAction.href} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
                Do first action
              </Link>
            </div>
          </div>
          <article className="rounded-lg border bg-card/85 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Do first</div>
                <h2 className="mt-2 text-xl font-semibold">{center.nextAction.title}</h2>
              </div>
              <PriorityBadge priority={center.nextAction.priority} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{center.nextAction.detail}</p>
            <p className="mt-3 rounded-lg border bg-surface px-3 py-2 text-sm leading-6 text-muted">{center.nextAction.why}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <ScoreTile label="Focus score" value={`${center.focusScore}`} tone={center.focusScore >= 80 ? "success" : center.focusScore >= 55 ? "warning" : "danger"} />
              <ScoreTile label="System score" value={`${center.completionScore}`} tone={center.completionScore >= 80 ? "success" : center.completionScore >= 55 ? "warning" : "danger"} />
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {center.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Priority queue</div>
              <h2 className="mt-1 text-2xl font-semibold">What needs clarity now</h2>
            </div>
            <Link href="/planner" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
              Planner
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {center.actions.slice(0, 7).map((item, index) => <ActionRow key={item.id} action={item} index={index + 1} />)}
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-accent" />
            <h2 className="text-2xl font-semibold">Today plan preview</h2>
          </div>
          <div className="mt-5 space-y-3">
            {center.timeline.slice(0, 7).map((block) => <TimelineMini key={block.id} block={block} />)}
          </div>
        </section>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">All systems</div>
            <h2 className="mt-1 text-2xl font-semibold">Work, money, health, learning, habits</h2>
          </div>
          <div className="rounded-lg border bg-surface px-3 py-2 text-sm font-semibold text-muted">Generated {new Date(center.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {center.domains.map((domain) => <DomainCard key={domain.id} domain={domain} />)}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-accent" />
            <h2 className="text-xl font-semibold">Analytics snapshot</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AnalyticsTile icon={<Workflow size={17} />} label="Work load" value={`${center.analytics.work.total} tasks`} helper={`${center.analytics.work.overdue} overdue, ${center.analytics.work.dueSoon} due soon`} />
            <AnalyticsTile icon={<CreditCard size={17} />} label="Money pressure" value={center.analytics.finance.projectedMonthSpend.toLocaleString("en-IN")} helper={`Projected spend; ${center.analytics.finance.savingsRate}% savings rate`} />
            <AnalyticsTile icon={<Dumbbell size={17} />} label="Training" value={`${center.analytics.workout.sessions7}/3`} helper={`Weekly sessions; today ${center.analytics.workout.todayTitle}`} />
            <AnalyticsTile icon={<Utensils size={17} />} label="Diet" value={center.analytics.diet.loggedToday ? "Logged" : "Missing"} helper={`${center.analytics.diet.latestAdherence || 0}% latest adherence`} />
            <AnalyticsTile icon={<BookOpen size={17} />} label="Reading" value={`${center.analytics.reading.todayPages}/${center.analytics.reading.dailyTarget}`} helper={`${center.analytics.reading.weekPages} pages this week`} />
            <AnalyticsTile icon={<ListChecks size={17} />} label="Habits" value={`${center.analytics.habits.mandatoryTodayRate}%`} helper={`${center.analytics.habits.overallStreak} day streak`} />
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <h2 className="text-xl font-semibold">Insights and corrections</h2>
          </div>
          <div className="mt-4 space-y-3">
            {center.insights.map((item) => <InsightRow key={item.id} insight={item} />)}
          </div>
        </section>
      </section>
    </div>
  );
}

function MetricCard({ metric }: { metric: CommandMetric }) {
  return (
    <Link href={metric.href} className={cn("block rounded-lg border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift", toneBorder(metric.tone))}>
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-surface", toneText(metric.tone))}>
        {metric.id.includes("work") || metric.id.includes("delegation") ? <Workflow size={18} /> : metric.id === "cash" ? <Landmark size={18} /> : metric.id === "fitness" ? <Dumbbell size={18} /> : metric.id === "diet" ? <Utensils size={18} /> : <ListChecks size={18} />}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-normal">{metric.value}</div>
      <div className="mt-1 text-sm font-medium text-muted">{metric.label}</div>
      <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{metric.helper}</div>
    </Link>
  );
}

function ActionRow({ action, index }: { action: CommandAction; index: number }) {
  const Icon = areaIcon[action.area];
  return (
    <Link href={action.href} className="grid gap-3 rounded-lg border bg-surface p-3 transition hover:border-accent/40 hover:bg-card sm:grid-cols-[42px_minmax(0,1fr)_92px] sm:items-start">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-muted">
        {index}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon size={15} className="text-accent" />
          <h3 className="break-words text-sm font-semibold">{action.title}</h3>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">{action.detail}</p>
        <p className="mt-2 text-xs font-medium leading-5 text-muted">{action.why}</p>
      </div>
      <PriorityBadge priority={action.priority} />
    </Link>
  );
}

function TimelineMini({ block }: { block: CommandTimelineBlock }) {
  const Icon = areaIcon[block.area];
  return (
    <Link href={block.href} className="grid gap-3 rounded-lg border bg-surface p-3 transition hover:border-accent/40 hover:bg-card sm:grid-cols-[72px_minmax(0,1fr)]">
      <div className="text-sm font-semibold text-accent">{block.time}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon size={15} className="text-muted" />
          <div className="font-semibold">{block.title}</div>
          <PriorityBadge priority={block.priority} compact />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">{block.detail}</p>
      </div>
    </Link>
  );
}

function DomainCard({ domain }: { domain: CommandDomain }) {
  const Icon = areaIcon[domain.id];
  return (
    <Link href={domain.href} className="rounded-lg border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card", toneText(domain.tone))}><Icon size={18} /></span>
          <div>
            <h3 className="font-semibold">{domain.label}</h3>
            <div className="mt-1 text-xs text-muted">{domain.metric}</div>
          </div>
        </div>
        <div className={cn("rounded-lg border px-2.5 py-1.5 text-sm font-semibold", toneSoft(domain.tone))}>{domain.score}</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full", domain.tone === "success" ? "bg-success" : domain.tone === "warning" ? "bg-warning" : "bg-danger")} style={{ width: `${domain.score}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{domain.summary}</p>
      <div className="mt-3 rounded-lg border bg-card px-3 py-2 text-xs leading-5 text-muted">{domain.nextAction}</div>
    </Link>
  );
}

function InsightRow({ insight }: { insight: CommandInsight }) {
  const Icon = areaIcon[insight.area];
  return (
    <Link href={insight.href} className={cn("flex gap-3 rounded-lg border bg-surface p-3 transition hover:bg-card", toneBorder(insight.tone))}>
      <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card", toneText(insight.tone))}><Icon size={16} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{insight.title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{insight.detail}</span>
      </span>
    </Link>
  );
}

function AnalyticsTile({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className="mt-3 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs leading-5 text-muted">{helper}</div>
    </div>
  );
}

function ScoreTile({ label, value, tone }: { label: string; value: string; tone: CommandTone }) {
  return (
    <div className={cn("rounded-lg border bg-surface px-3 py-2", toneBorder(tone))}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold", toneText(tone))}>{value}</div>
    </div>
  );
}

function PriorityBadge({ priority, compact = false }: { priority: CommandAction["priority"]; compact?: boolean }) {
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold capitalize",
      compact && "px-1.5 py-0.5 text-[11px]",
      priority === "critical" && "border-danger/30 bg-danger/10 text-danger",
      priority === "high" && "border-warning/30 bg-warning/10 text-warning",
      priority === "medium" && "border-accent/30 bg-accent/10 text-accent",
      priority === "low" && "bg-card text-muted",
    )}>
      {priority}
    </span>
  );
}

function toneText(tone: CommandTone) {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  return "text-muted";
}

function toneBorder(tone: CommandTone) {
  if (tone === "success") return "border-success/25";
  if (tone === "warning") return "border-warning/30";
  if (tone === "danger") return "border-danger/25";
  return "border-border/70";
}

function toneSoft(tone: CommandTone) {
  if (tone === "success") return "border-success/25 bg-success/10 text-success";
  if (tone === "warning") return "border-warning/30 bg-warning/10 text-warning";
  if (tone === "danger") return "border-danger/25 bg-danger/10 text-danger";
  return "bg-card text-muted";
}
