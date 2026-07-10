import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import type { AttentionItem, AttentionSeverity } from "@personal-os/core";
import { cn } from "@/lib/utils";

export function AttentionQueue({ items, title = "Attention queue", limit = 8, empty = "Nothing urgent right now." }: { items: AttentionItem[]; title?: string; limit?: number; empty?: string }) {
  const visible = items.slice(0, limit);
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-lg border bg-background px-2 py-1 text-xs text-muted">{items.length} active</span>
      </div>
      <div className="mt-4 divide-y">
        {visible.map((item) => (
          <article key={item.id} className="py-3">
            <div className="grid gap-3 md:grid-cols-[1fr_150px] md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.severity === "critical" || item.severity === "high" ? <AlertTriangle size={16} className={severityText(item.severity)} /> : <CheckCircle2 size={16} className="text-success" />}
                  <SeverityPill severity={item.severity} />
                  <span className="rounded-lg border bg-background px-2 py-1 text-xs capitalize text-muted">{item.group.replace("_", " ")}</span>
                </div>
                <div className="mt-2 font-medium">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-muted">{item.detail}</div>
                <div className="mt-2 text-sm font-medium">{item.action}</div>
                {item.evidence.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.evidence.slice(0, 4).map((piece) => (
                      <span key={piece} className="rounded-lg border bg-background px-2 py-1 text-xs text-muted">{piece}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold">{item.score}</span>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium text-accent">
                    Open <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-muted">
                    Next <ArrowRight size={13} />
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
        {visible.length === 0 ? <div className="py-10 text-center text-sm text-muted">{empty}</div> : null}
      </div>
    </section>
  );
}

export function SeverityPill({ severity }: { severity: AttentionSeverity }) {
  return (
    <span className={cn("rounded-lg border px-2 py-1 text-xs font-medium capitalize", severityPill(severity))}>
      {severity}
    </span>
  );
}

function severityPill(severity: AttentionSeverity) {
  if (severity === "critical") return "border-danger/40 bg-danger/10 text-danger";
  if (severity === "high") return "border-warning/50 bg-warning/10 text-warning";
  if (severity === "medium") return "border-accent/40 bg-accent/10 text-accent";
  return "bg-background text-muted";
}

function severityText(severity: AttentionSeverity) {
  if (severity === "critical") return "text-danger";
  if (severity === "high") return "text-warning";
  return "text-success";
}
