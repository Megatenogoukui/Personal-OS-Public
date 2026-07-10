import type { ModuleSnapshot } from "@personal-os/core";
import { formatCurrency, cn } from "@/lib/utils";

export function ModuleHealthGrid({ modules, limit }: { modules: ModuleSnapshot[]; limit?: number }) {
  const visible = typeof limit === "number" ? modules.slice(0, limit) : modules;
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((module) => (
        <article key={module.module} className={cn("rounded-lg border bg-card p-4 shadow-sm", module.status === "missing" && "border-danger/40", module.status === "watch" && "border-warning/50", module.status === "good" && "border-success/40")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted">{module.label}</div>
              <div className="mt-1 text-lg font-semibold">{moduleStatusText(module.status)}</div>
            </div>
            <span className={cn("rounded-lg border px-2 py-1 text-xs capitalize", module.status === "missing" && "border-danger/40 text-danger", module.status === "watch" && "border-warning/50 text-warning", module.status === "good" && "border-success/40 text-success")}>
              {module.status}
            </span>
          </div>
          <div className="mt-3 text-sm leading-6 text-muted">{module.insight}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Metric label="Today" value={module.todayCount} />
            <Metric label="Week" value={module.weekCount} />
            <Metric label="Month" value={module.monthCount} />
          </div>
          <div className="mt-3 rounded-lg border bg-background px-3 py-2 text-sm">{module.nextAction}</div>
          {module.module === "finance" || module.totalAmount > 0 ? (
            <div className="mt-2 text-xs text-muted">Month total: {module.module === "finance" ? formatCurrency(module.totalAmount) : `${module.totalAmount.toLocaleString("en-IN")} ${module.unit}`}</div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function ModuleBreakdown({ module }: { module: ModuleSnapshot }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{module.label} breakdown</h2>
        <span className="rounded-lg border bg-background px-2 py-1 text-xs text-muted">{module.target}</span>
      </div>
      <div className="mt-4 space-y-3">
        {module.categories.map((category) => {
          const denominator = Math.max(module.totalAmount, 1);
          const percent = Math.min(100, Math.round((category.amount / denominator) * 100));
          return (
            <div key={category.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{category.label}</span>
                <span className="text-muted">{category.count} entry(s)</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-lg bg-background">
                <div className="h-full rounded-lg bg-accent" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
        {module.categories.length === 0 ? <div className="py-8 text-center text-sm text-muted">No category data this month.</div> : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background px-2 py-2">
      <div className="font-semibold">{value}</div>
      <div className="mt-1 text-muted">{label}</div>
    </div>
  );
}

function moduleStatusText(status: ModuleSnapshot["status"]) {
  if (status === "good") return "Current";
  if (status === "watch") return "Watch";
  return "Needs input";
}
