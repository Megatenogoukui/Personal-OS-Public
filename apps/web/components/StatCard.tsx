import { cn } from "@/lib/utils";

export function StatCard({ label, value, helper, tone = "neutral" }: { label: string; value: string | number; helper?: string; tone?: "neutral" | "danger" | "warning" | "success" }) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        tone === "danger" && "border-danger/40",
        tone === "warning" && "border-warning/50",
        tone === "success" && "border-success/40",
      )}
    >
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
      {helper ? <div className="mt-2 text-xs leading-5 text-muted">{helper}</div> : null}
    </article>
  );
}

