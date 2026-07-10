"use client";

import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Dumbbell,
  Flame,
  Footprints,
  Pencil,
  Plus,
  Salad,
  Sunrise,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HabitAnalytics, HabitDefinition, HabitKind } from "@personal-os/core";
import { cn, todayIso } from "@/lib/utils";

type HabitApiResponse = {
  habits: HabitDefinition[];
  analytics: HabitAnalytics;
};

type HabitFormState = {
  id?: string;
  name: string;
  kind: HabitKind;
  targetValue: string;
  unit: string;
  category: string;
  mandatory: boolean;
  notes: string;
};

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";
const primaryButtonClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:w-auto";
const secondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-45";

const emptyForm: HabitFormState = {
  name: "",
  kind: "check",
  targetValue: "1",
  unit: "done",
  category: "Personal",
  mandatory: false,
  notes: "",
};

const chartColors = {
  accent: "#0f8f84",
  success: "#17915a",
  warning: "#d97706",
  muted: "#64748b",
};

export function HabitsTracker() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [data, setData] = useState<HabitApiResponse | null>(null);
  const [status, setStatus] = useState("Loading habits.");
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<HabitFormState>(emptyForm);

  async function load(date = selectedDate) {
    const response = await fetch(`/api/habits?date=${date}`, { cache: "no-store" });
    if (!response.ok) {
      setStatus("Could not load habits.");
      return;
    }
    const body = (await response.json()) as HabitApiResponse;
    setData(body);
    setStatus("Ready.");
  }

  useEffect(() => {
    void load(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!data) return;
    setValueInputs(Object.fromEntries(data.analytics.habits.map((habit) => [habit.id, String(habit.todayLog?.value ?? (habit.kind === "number" ? 0 : habit.completedToday ? habit.targetValue : 0))])));
    setNotesInputs(Object.fromEntries(data.analytics.habits.map((habit) => [habit.id, habit.todayLog?.notes ?? ""])));
  }, [data]);

  const analytics = data?.analytics;
  const habits = analytics?.habits ?? [];
  const mandatoryHabits = habits.filter((habit) => habit.mandatory);
  const optionalHabits = habits.filter((habit) => !habit.mandatory);
  const habitRateData = habits.map((habit) => ({ name: compactHabitName(habit.name), rate: habit.rate30, streak: habit.currentStreak }));

  async function toggleHabit(habit: HabitDefinition & { completedToday: boolean }) {
    const completed = !habit.completedToday;
    await saveHabitLog(habit, completed ? habit.targetValue : 0, completed, notesInputs[habit.id] ?? "");
  }

  async function saveNumberHabit(habit: HabitDefinition) {
    const value = parseNumber(valueInputs[habit.id]);
    await saveHabitLog(habit, value, value >= habit.targetValue, notesInputs[habit.id] ?? "");
  }

  async function saveHabitLog(habit: HabitDefinition, value: number, completed: boolean, notes: string) {
    const response = await fetch("/api/habits", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "log",
        habitId: habit.id,
        date: selectedDate,
        value,
        completed,
        notes,
      }),
    });
    if (!response.ok) {
      setStatus("Could not save habit.");
      return;
    }
    setStatus(completed ? `${habit.name} completed.` : `${habit.name} reopened.`);
    const body = (await response.json()) as HabitApiResponse;
    setData(body);
  }

  function openAddForm() {
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditForm(habit: HabitDefinition) {
    setForm({
      id: habit.id,
      name: habit.name,
      kind: habit.kind,
      targetValue: String(habit.targetValue),
      unit: habit.unit,
      category: habit.category,
      mandatory: habit.mandatory,
      notes: habit.notes ?? "",
    });
    setFormOpen(true);
  }

  async function saveHabit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      name: form.name,
      kind: form.kind,
      targetValue: parseNumber(form.targetValue) || 1,
      unit: form.unit,
      category: form.category,
      mandatory: form.mandatory,
      notes: form.notes,
    };
    const response = await fetch("/api/habits", {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form.id ? { type: "habit", id: form.id, patch: payload } : payload),
    });
    if (!response.ok) {
      setStatus("Could not save habit definition.");
      return;
    }
    setStatus(form.id ? "Habit updated." : "Habit added.");
    setFormOpen(false);
    const body = (await response.json()) as HabitApiResponse;
    setData(body);
  }

  async function deleteHabit() {
    if (!form.id) return;
    const response = await fetch(`/api/habits?id=${encodeURIComponent(form.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("Mandatory habits cannot be deleted.");
      return;
    }
    setStatus("Habit deleted.");
    setFormOpen(false);
    const body = (await response.json()) as HabitApiResponse;
    setData(body);
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "border-accent/20")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Habit operating system</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Mandatory habits, streaks, and daily close.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Build a small mandatory baseline, then add optional habits without weakening the routine you can sustain.
            </p>
          </div>
          <div className="rounded-lg border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Current status</div>
            <div className="mt-2 text-sm font-medium leading-5">{status}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics?.mandatoryCompletedToday ?? 0}/{analytics?.mandatoryCount ?? 5} today</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics?.overallStreak ?? 0} streak</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics?.rate30 ?? 0}% 30d</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<CheckCircle2 size={18} />} label="Mandatory today" value={`${analytics?.mandatoryCompletedToday ?? 0}/${analytics?.mandatoryCount ?? 5}`} tone={(analytics?.mandatoryTodayRate ?? 0) === 100 ? "success" : "warning"} />
        <Metric icon={<Flame size={18} />} label="Overall streak" value={`${analytics?.overallStreak ?? 0}d`} tone={(analytics?.overallStreak ?? 0) > 0 ? "success" : "warning"} />
        <Metric icon={<Target size={18} />} label="Best overall" value={`${analytics?.bestOverallStreak ?? 0}d`} />
        <Metric icon={<BarChart3 size={18} />} label="7-day rate" value={`${analytics?.rate7 ?? 0}%`} />
        <Metric icon={<BarChart3 size={18} />} label="30-day rate" value={`${analytics?.rate30 ?? 0}%`} />
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Track today</div>
            <h2 className="mt-1 text-xl font-semibold">Daily mandatory close</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Track each habit for {selectedDate}. The overall streak only moves when every mandatory habit is done.</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <input className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-accent" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            <button type="button" className={primaryButtonClass} onClick={openAddForm}>
              <Plus size={16} />
              Add habit
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {mandatoryHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              value={valueInputs[habit.id] ?? ""}
              notes={notesInputs[habit.id] ?? ""}
              onValueChange={(value) => setValueInputs((current) => ({ ...current, [habit.id]: value }))}
              onNotesChange={(value) => setNotesInputs((current) => ({ ...current, [habit.id]: value }))}
              onToggle={() => void toggleHabit(habit)}
              onSaveNumber={() => void saveNumberHabit(habit)}
              onEdit={() => openEditForm(habit)}
            />
          ))}
        </div>
      </section>

      {optionalHabits.length > 0 ? (
        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <Target size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Optional habits</h2>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {optionalHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                value={valueInputs[habit.id] ?? ""}
                notes={notesInputs[habit.id] ?? ""}
                onValueChange={(value) => setValueInputs((current) => ({ ...current, [habit.id]: value }))}
                onNotesChange={(value) => setNotesInputs((current) => ({ ...current, [habit.id]: value }))}
                onToggle={() => void toggleHabit(habit)}
                onSaveNumber={() => void saveNumberHabit(habit)}
                onEdit={() => openEditForm(habit)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">30-day completion</h2>
          </div>
          <div className="mt-4 h-[300px]">
            {analytics ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dayStats} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                  <Bar dataKey="mandatoryCompleted" fill={chartColors.accent} radius={[4, 4, 0, 0]} name="Mandatory done" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Loading habit chart." />}
          </div>
        </article>

        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-warning" />
            <h2 className="text-lg font-semibold">Mandatory rate trend</h2>
          </div>
          <div className="mt-4 h-[300px]">
            {analytics ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dayStats} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                  <Line type="monotone" dataKey="mandatoryRate" stroke={chartColors.warning} strokeWidth={3} dot={{ r: 2 }} name="Mandatory rate %" />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Loading trend." />}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Per-habit analytics</h2>
          </div>
          <div className="mt-4 h-[320px]">
            {habitRateData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={habitRateData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={92} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                  <Bar dataKey="rate" fill={chartColors.success} radius={[0, 4, 4, 0]} name="30-day rate %" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Track habits to see rates." />}
          </div>
        </article>

        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <Target size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Insights</h2>
          </div>
          <div className="mt-4 space-y-2">
            {(analytics?.insights.length ? analytics.insights : ["Track the mandatory habits today to start analytics."]).map((insight) => (
              <div key={insight} className="rounded-lg border bg-surface px-3 py-2 text-sm leading-6 text-muted">{insight}</div>
            ))}
          </div>
        </article>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-md">
          <form onSubmit={saveHabit} className="w-full max-w-2xl rounded-lg border bg-card p-5 shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{form.id ? "Edit habit" : "Add habit"}</div>
                <h2 className="mt-1 text-xl font-semibold">{form.id ? form.name : "New habit"}</h2>
              </div>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm" onClick={() => setFormOpen(false)} aria-label="Close habit form">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TextInput label="Habit name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Meditation, sleep by 11" required />
              <Select label="Type" value={form.kind} onChange={(value) => setForm((current) => ({ ...current, kind: value as HabitKind, targetValue: value === "check" ? "1" : current.targetValue, unit: value === "check" ? "done" : current.unit }))} options={[{ value: "check", label: "Done / not done" }, { value: "number", label: "Number target" }]} />
              <TextInput label="Target" value={form.targetValue} onChange={(value) => setForm((current) => ({ ...current, targetValue: value }))} inputMode="decimal" placeholder="1" required />
              <TextInput label="Unit" value={form.unit} onChange={(value) => setForm((current) => ({ ...current, unit: value }))} placeholder="done, steps, pages" required />
              <TextInput label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} placeholder="Health, Learning" required />
              <label className="flex min-h-[66px] items-center gap-3 rounded-lg border bg-surface px-3 text-sm">
                <input type="checkbox" checked={form.mandatory} onChange={(event) => setForm((current) => ({ ...current, mandatory: event.target.checked }))} />
                Mandatory for overall streak
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm text-muted">Notes</span>
                <textarea className="mt-1 min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-accent" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Rule, cue, or what counts as done" />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <div>
                {form.id && !form.mandatory ? (
                  <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 text-sm font-semibold text-danger" onClick={() => void deleteHabit()}>
                    <Trash2 size={16} />
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setFormOpen(false)}>Cancel</button>
                <button className={primaryButtonClass}>{form.id ? "Save habit" : "Add habit"}</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function HabitCard({
  habit,
  value,
  notes,
  onValueChange,
  onNotesChange,
  onToggle,
  onSaveNumber,
  onEdit,
}: {
  habit: HabitDefinition & {
    completedToday: boolean;
    currentStreak: number;
    bestStreak: number;
    rate7: number;
    rate30: number;
  };
  value: string;
  notes: string;
  onValueChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onToggle: () => void;
  onSaveNumber: () => void;
  onEdit: () => void;
}) {
  const Icon = iconForHabit(habit);
  return (
    <article className={cn("rounded-lg border bg-surface p-4", habit.completedToday ? "border-success/35 bg-success/10" : habit.mandatory ? "border-warning/30" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-card text-muted", habit.completedToday && "text-success")}>
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold">{habit.name}</h3>
              {habit.mandatory ? <Badge tone="warning">Mandatory</Badge> : <Badge>Optional</Badge>}
              {habit.completedToday ? <Badge tone="success">Done</Badge> : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted">{habit.notes || `${habit.targetValue.toLocaleString("en-IN")} ${habit.unit}`}</div>
          </div>
        </div>
        <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card shadow-sm transition hover:border-accent/50 hover:text-accent" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
          <Pencil size={15} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MiniMetric label="Current" value={`${habit.currentStreak}d`} />
        <MiniMetric label="Best" value={`${habit.bestStreak}d`} />
        <MiniMetric label="7 days" value={`${habit.rate7}%`} />
        <MiniMetric label="30 days" value={`${habit.rate30}%`} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        {habit.kind === "number" ? (
          <>
            <TextInput label={`${habit.unit} today`} value={value} onChange={onValueChange} inputMode="decimal" placeholder={String(habit.targetValue)} />
            <TextInput label="Notes" value={notes} onChange={onNotesChange} placeholder="Walk, treadmill, commute" />
            <button type="button" className={cn(primaryButtonClass, "md:w-auto")} onClick={onSaveNumber}>
              Save
            </button>
          </>
        ) : (
          <>
            <TextInput label="Notes" value={notes} onChange={onNotesChange} placeholder="Time, context, blocker" />
            <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted">
              Target: {habit.targetValue.toLocaleString("en-IN")} {habit.unit}
            </div>
            <button type="button" className={cn(primaryButtonClass, habit.completedToday && "bg-success hover:bg-success/90", "md:w-auto")} onClick={onToggle}>
              {habit.completedToday ? "Completed" : "Mark done"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Metric({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "success" | "warning" }) {
  return (
    <article className={cn("rounded-lg border bg-card p-4 shadow-sm", tone === "success" && "border-success/30 bg-success/10", tone === "warning" && "border-warning/30 bg-warning/10")}>
      <div className={cn("text-muted", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{icon}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-lg border bg-card px-2 py-1 text-xs font-medium text-muted",
      tone === "success" && "border-success/30 bg-success/10 text-success",
      tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
    )}>
      {children}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="text-muted">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none transition focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        required={required}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="text-muted">{label}</span>
      <select className="mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none transition focus:border-accent" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border bg-surface text-sm text-muted">{text}</div>
  );
}

function iconForHabit(habit: HabitDefinition) {
  const name = habit.name.toLowerCase();
  if (name.includes("wake")) return Sunrise;
  if (name.includes("gym")) return Dumbbell;
  if (name.includes("food")) return Salad;
  if (name.includes("read")) return BookOpen;
  if (name.includes("step")) return Footprints;
  return CheckCircle2;
}

function compactHabitName(name: string) {
  return name.replace("Wake up ", "Wake ").replace("Clean food", "Food");
}

function parseNumber(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
