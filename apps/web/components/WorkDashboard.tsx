"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildAttentionQueue, enrichWorkTasks, isAssignedToMe, summarizeWork, type WorkTask, type WorkTaskWithScore } from "@personal-os/core";
import { AttentionQueue } from "./AttentionQueue";
import { StatCard } from "./StatCard";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "critical" | "assigned" | "dueSoon" | "overdue" | "missingFe" | "missingBe" | "missingBoth" | "blocked" | "stale";

export function WorkDashboard({ identity = "" }: { identity?: string }) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading work tasks...");
  const [importText, setImportText] = useState("");

  async function loadTasks() {
    const response = await fetch("/api/work/tasks", { cache: "no-store" });
    const body = (await response.json()) as { tasks: WorkTask[]; source: string };
    setTasks(body.tasks);
    setStatus(
      body.tasks.length > 0
        ? `Loaded ${body.tasks.length} live/imported task(s) from ${body.source}.`
        : "No work tasks found yet. Import a CSV or JSON export to begin.",
    );
  }

  async function importFromPaste() {
    try {
      const parsedTasks = parsePastedTasks(importText);
      if (parsedTasks.length === 0) {
        setStatus("Paste a JSON array/object or CSV export with at least one row.");
        return;
      }
      setStatus(`Importing ${parsedTasks.length} pasted task(s)...`);
      const response = await fetch("/api/work/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tasks: parsedTasks, source: "manual paste" }),
      });
      const body = (await response.json()) as { tasks?: WorkTask[]; imported?: number; message?: string };
      if (!response.ok) {
        setStatus(body.message ?? "Could not import pasted tasks.");
        return;
      }
      setTasks(body.tasks ?? []);
      setImportText("");
      setStatus(`Imported ${body.imported ?? parsedTasks.length} work task(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not parse pasted export.");
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const summary = useMemo(() => summarizeWork(tasks, identity), [identity, tasks]);
  const workAttention = useMemo(() => buildAttentionQueue(tasks, [], identity).filter((item) => item.area === "work"), [identity, tasks]);
  const enriched = useMemo(() => {
    const scored = enrichWorkTasks(tasks, identity);
    return scored.filter((task) => matchesFilter(task, filter, identity)).filter((task) => {
      const haystack = `${task.title} ${task.client ?? ""} ${task.project ?? ""} ${task.status} ${task.priority}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [filter, identity, search, tasks]);
  const allScored = useMemo(() => enrichWorkTasks(tasks, identity), [identity, tasks]);
  const lanes = useMemo(() => deadlineLanes(allScored), [allScored]);
  const teamLoad = useMemo(() => buildTeamLoad(allScored), [allScored]);
  const missingBoth = allScored.filter((task) => !task.feAssignee && !task.beAssignee).length;
  const hasNoTasks = tasks.length === 0;
  const nextAction = hasNoTasks ? "Import work data to activate priorities and deadline insights." : workAttention[0]?.action ?? "No urgent action from current work data.";

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Work management</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Work command center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{nextAction}</p>
          </div>
          <div>
            <div className="rounded-lg border bg-background px-3 py-3 text-sm leading-6 text-muted">{status}</div>
          </div>
        </div>
      </section>

      {hasNoTasks ? (
        <section className="rounded-lg border border-warning/40 bg-warning/10 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-1 text-warning" />
            <div>
              <h2 className="font-semibold">No work data imported</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Start with a CSV or JSON export from any project or ticket system. Your source stays optional and provider-neutral.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Assigned to me" value={summary.assignedToMe} helper="Lead/owner/assignee match" tone="success" />
        <StatCard label="Due soon" value={summary.dueSoon} helper="Within 48 hours" tone="warning" />
        <StatCard label="Overdue" value={summary.overdue} helper="Needs recovery" tone="danger" />
        <StatCard label="Missing FE" value={summary.missingFe} helper="Lead action" tone="warning" />
        <StatCard label="Missing BE" value={summary.missingBe} helper="Lead action" tone="warning" />
        <StatCard label="Missing both" value={missingBoth} helper="Highest delegation risk" tone={missingBoth > 0 ? "danger" : "success"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <AttentionQueue items={workAttention} title="Lead action queue" limit={5} empty="No work task needs attention from current data." />
        <section className="space-y-4">
          <article className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Deadline lanes</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {lanes.map((lane) => (
                <button key={lane.label} onClick={() => setFilter(lane.filter)} className="rounded-lg border bg-background p-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">{lane.label}</span>
                    <span className={cn("text-xl font-semibold", lane.tone === "danger" && "text-danger", lane.tone === "warning" && "text-warning")}>{lane.count}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">{lane.helper}</div>
                </button>
              ))}
            </div>
          </article>
          <article className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Team load</h2>
            <div className="mt-4 space-y-3">
              {teamLoad.slice(0, 5).map((person) => (
                <div key={person.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{person.name}</span>
                    <span className="text-muted">{person.count} active</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-lg bg-background">
                    <div className={cn("h-full rounded-lg", person.count >= 4 ? "bg-danger" : person.count >= 2 ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, person.count * 22)}%` }} />
                  </div>
                </div>
              ))}
              {teamLoad.length === 0 ? <div className="py-8 text-center text-sm text-muted">No team assignee data yet.</div> : null}
            </div>
          </article>
        </section>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-end">
          <label className="block text-sm">
            <span className="font-medium">Paste work export</span>
            <textarea
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={4}
              placeholder="Paste CSV headers like request_id,title,status,priority,deadline,fe_assignee,be_assignee,lead or paste JSON."
            />
          </label>
          <button onClick={importFromPaste} className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-semibold">
            <Upload size={16} />
            Import pasted tasks
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((item) => (
              <button key={item.key} onClick={() => setFilter(item.key)} className={cn("rounded-lg border px-3 py-2 text-sm", filter === item.key && "border-accent bg-accent text-white")}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex min-w-72 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <Search size={16} className="text-muted" />
            <input className="w-full bg-transparent outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search work..." />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="grid grid-cols-12 border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
          <div className="col-span-5">Task</div>
          <div className="col-span-2">Deadline</div>
          <div className="col-span-2">Owners</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-1 text-right">Score</div>
        </div>
        {enriched.map((task) => (
          <article key={task.id} className="grid grid-cols-1 gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2">
                {task.deadlineBand === "overdue" || task.deadlineBand === "critical" ? <AlertTriangle size={16} className="text-danger" /> : <CheckCircle2 size={16} className="text-success" />}
                <strong>{task.title}</strong>
              </div>
              <div className="mt-1 text-xs text-muted">
                {task.externalId} {task.client ? `- ${task.client}` : ""} {task.project ? `- ${task.project}` : ""}
              </div>
            </div>
            <div className="text-sm lg:col-span-2">
              <div className={cn(task.deadlineBand === "overdue" && "text-danger", task.deadlineBand === "critical" && "text-warning")}>{task.timeLabel}</div>
              <div className="text-xs text-muted">{task.status} / {task.priority}</div>
            </div>
            <div className="text-sm lg:col-span-2">
              <div>FE: {task.feAssignee || "Missing"}</div>
              <div>BE: {task.beAssignee || "Missing"}</div>
              <div className="text-xs text-muted">Lead: {task.lead || "Missing"}</div>
            </div>
            <div className="text-sm leading-6 text-muted lg:col-span-2">
              {task.recommendedAction}
              {task.sourceUrl ? (
                <a href={task.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-accent">
                  Open source <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
            <div className="text-right text-lg font-semibold lg:col-span-1">{task.score}</div>
          </article>
        ))}
        {enriched.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            {hasNoTasks ? "No imported work tasks yet." : "No tasks match this view."}
          </div>
        ) : null}
      </section>
    </div>
  );
}

const filterOptions: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "assigned", label: "Assigned" },
  { key: "dueSoon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "missingFe", label: "Missing FE" },
  { key: "missingBe", label: "Missing BE" },
  { key: "missingBoth", label: "Missing both" },
  { key: "blocked", label: "Blocked" },
  { key: "stale", label: "Stale" },
];

function matchesFilter(task: WorkTaskWithScore, filter: FilterKey, identity: string) {
  if (filter === "all") return true;
  if (filter === "critical") return task.score >= 140;
  if (filter === "assigned") return isAssignedToMe(task, identity);
  if (filter === "dueSoon") return ["critical", "high"].includes(task.deadlineBand);
  if (filter === "overdue") return task.deadlineBand === "overdue";
  if (filter === "missingFe") return !task.feAssignee;
  if (filter === "missingBe") return !task.beAssignee;
  if (filter === "missingBoth") return !task.feAssignee && !task.beAssignee;
  if (filter === "blocked") return task.status === "blocked";
  if (filter === "stale") {
    if (!task.updatedAt) return false;
    const ageHours = (Date.now() - new Date(task.updatedAt).getTime()) / 36e5;
    return ageHours >= 72;
  }
  return true;
}

function deadlineLanes(tasks: WorkTaskWithScore[]): Array<{ label: string; count: number; helper: string; filter: FilterKey; tone: "danger" | "warning" | "neutral" }> {
  return [
    { label: "Overdue", count: tasks.filter((task) => task.deadlineBand === "overdue").length, helper: "Reset expectation or close", filter: "overdue", tone: "danger" },
    { label: "24 hours", count: tasks.filter((task) => task.deadlineBand === "critical").length, helper: "Review progress now", filter: "dueSoon", tone: "warning" },
    { label: "48 hours", count: tasks.filter((task) => task.deadlineBand === "high").length, helper: "Confirm owner and path", filter: "dueSoon", tone: "warning" },
    { label: "7 days", count: tasks.filter((task) => task.deadlineBand === "upcoming").length, helper: "Prevent late escalation", filter: "all", tone: "neutral" },
  ];
}

function buildTeamLoad(tasks: WorkTaskWithScore[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "done" || task.status === "cancelled") continue;
    for (const person of [task.feAssignee, task.beAssignee, task.lead, ...(task.assignedTo ?? [])]) {
      if (!person || person.toLowerCase() === "n/a") continue;
      counts.set(person, (counts.get(person) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function parsePastedTasks(value: string): Array<Record<string, unknown>> {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
    if (parsed && typeof parsed === "object" && "tasks" in parsed && Array.isArray(parsed.tasks)) return parsed.tasks as Array<Record<string, unknown>>;
    if (parsed && typeof parsed === "object") return [parsed as Record<string, unknown>];
    return [];
  }
  const rows = parseCsv(trimmed);
  const [headers, ...data] = rows;
  if (!headers || headers.length === 0) return [];
  return data
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? ""])));
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
