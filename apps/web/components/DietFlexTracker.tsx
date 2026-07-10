"use client";

import { BarChart3, CheckCircle2, ClipboardList, Plus, RefreshCw, ShieldCheck, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type DietDay, type DietMeal, type DietMealSlot, type DietSystem, type ManualRecord } from "@personal-os/core";
import { cn, todayIso } from "@/lib/utils";

type DietSlotStatus = "planned" | "modified" | "outside" | "skipped";

type DietSlotInput = {
  status: DietSlotStatus;
  actual: string;
  calories: string;
  protein: string;
  notes: string;
};

type DietSlotLog = {
  slot: DietMealSlot;
  label: string;
  planned: string;
  status: DietSlotStatus;
  actual: string;
  calories?: number | undefined;
  protein?: number | undefined;
  notes?: string | undefined;
};

type DietDayLogMetadata = {
  kind: "diet_day_v1";
  day: string;
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string;
  slots: DietSlotLog[];
  caloriesTotal: number;
  proteinTotal: number;
  waterLiters?: number | undefined;
  weightKg?: number | undefined;
  adherenceScore: number;
  outsideCount: number;
  modifiedCount: number;
  skippedCount: number;
  notes?: string | undefined;
};

type DietDayLog = {
  id: string;
  date: string;
  title: string;
  notes?: string | undefined;
  metadata: DietDayLogMetadata;
};

const slotLabels: Record<DietMealSlot, string> = {
  pre_gym: "Morning",
  post_gym: "Post-gym",
  breakfast: "Office breakfast",
  lunch: "Lunch salad",
  evening: "Evening",
  dinner: "Dinner",
};

const statusOptions: Array<{ value: DietSlotStatus; label: string }> = [
  { value: "planned", label: "Followed plan" },
  { value: "modified", label: "Modified" },
  { value: "outside", label: "Ate outside" },
  { value: "skipped", label: "Skipped" },
];

const statusScore: Record<DietSlotStatus, number> = {
  planned: 100,
  modified: 75,
  outside: 55,
  skipped: 20,
};

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";
const primaryButtonClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:w-auto";

export function DietFlexTracker({ initialPlan }: { initialPlan: DietSystem }) {
  const plan = useMemo(() => initialPlan, [initialPlan]);
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [status, setStatus] = useState("Ready to log today's diet.");
  const [selectedDayName, setSelectedDayName] = useState(plan.today.day);
  const selectedDay = plan.week.find((day) => day.day === selectedDayName) ?? plan.today;
  const [date, setDate] = useState(todayIso());
  const [weight, setWeight] = useState("");
  const [water, setWater] = useState("");
  const [dayNotes, setDayNotes] = useState("");
  const [slotInputs, setSlotInputs] = useState<Record<DietMealSlot, DietSlotInput>>(() => buildEmptyInputs(selectedDay));

  async function loadRecords() {
    const response = await fetch("/api/manual/diet", { cache: "no-store" });
    if (!response.ok) {
      setStatus("Could not load diet logs.");
      return;
    }
    const body = (await response.json()) as { records: ManualRecord[] };
    setRecords(body.records);
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    setSlotInputs(buildEmptyInputs(selectedDay));
  }, [selectedDayName]);

  const dietLogs = useMemo(() => records.map(toDietDayLog).filter((log): log is DietDayLog => Boolean(log)), [records]);
  const summary = useMemo(() => buildDietSummary(dietLogs), [dietLogs]);
  const preview = useMemo(() => buildPreview(selectedDay, slotInputs), [selectedDay, slotInputs]);
  const tips = useMemo(() => buildDietTips(preview), [preview]);

  async function submitLog(event: React.FormEvent) {
    event.preventDefault();
    const slots = buildSlotLogs(selectedDay, slotInputs);
    const caloriesTotal = slots.reduce((sum, slot) => sum + (slot.calories ?? 0), 0);
    const proteinTotal = slots.reduce((sum, slot) => sum + (slot.protein ?? 0), 0);
    const outsideCount = slots.filter((slot) => slot.status === "outside").length;
    const modifiedCount = slots.filter((slot) => slot.status === "modified").length;
    const skippedCount = slots.filter((slot) => slot.status === "skipped").length;
    const adherenceScore = Math.round(slots.reduce((sum, slot) => sum + statusScore[slot.status], 0) / slots.length);

    const metadata: DietDayLogMetadata = {
      kind: "diet_day_v1",
      day: selectedDay.day,
      currentWeightKg: plan.profile.currentWeightKg,
      targetWeightKg: plan.profile.targetWeightKg,
      targetDate: plan.profile.targetDate,
      slots,
      caloriesTotal,
      proteinTotal,
      waterLiters: parseNumber(water) || undefined,
      weightKg: parseNumber(weight) || undefined,
      adherenceScore,
      outsideCount,
      modifiedCount,
      skippedCount,
      notes: dayNotes.trim() || undefined,
    };

    const response = await fetch("/api/manual/diet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        title: `${selectedDay.day} diet log`,
        amount: caloriesTotal || undefined,
        unit: "kcal",
        category: `${adherenceScore}% adherence`,
        status: outsideCount || modifiedCount || skippedCount ? "needs review" : "clean day",
        notes: dayNotes,
        metadata,
      }),
    });

    if (!response.ok) {
      setStatus("Could not save diet log.");
      return;
    }

    setStatus(`Saved diet log: ${adherenceScore}% adherence, ${proteinTotal || 0}g protein.`);
    setDayNotes("");
    setWater("");
    setSlotInputs(buildEmptyInputs(selectedDay));
    await loadRecords();
  }

  function updateSlot(slot: DietMealSlot, patch: Partial<DietSlotInput>) {
    setSlotInputs((current) => ({
      ...current,
      [slot]: { ...(current[slot] ?? emptySlotInput()), ...patch },
    }));
  }

  function updateSlotStatus(meal: DietMeal, nextStatus: DietSlotStatus) {
    setSlotInputs((current) => {
      const currentInput = current[meal.slot] ?? plannedSlotInput(meal);
      if (nextStatus === "planned") {
        return {
          ...current,
          [meal.slot]: { ...plannedSlotInput(meal), notes: currentInput.notes },
        };
      }
      if (nextStatus === "skipped") {
        return {
          ...current,
          [meal.slot]: { status: "skipped", actual: "Skipped", calories: "0", protein: "0", notes: currentInput.notes },
        };
      }
      return {
        ...current,
        [meal.slot]: { ...currentInput, status: nextStatus },
      };
    });
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "border-accent/20")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Daily diet control</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">Fixed structure, editable reality.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Your morning, shake, lunch rotation, evening rules, and dinner structure stay fixed. If life changes the meal, mark it as modified or outside and the weekly review still knows what happened.
            </p>
          </div>
          <div className="rounded-lg border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Current diet status</div>
            <div className="mt-2 text-sm font-medium leading-5">{status}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
              <span className="rounded-lg border bg-card px-2 py-1.5">{summary.loggedDays} days</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{summary.averageAdherence}% avg</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{summary.outsideMeals} outside</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<CheckCircle2 size={18} />} label="Today preview" value={`${preview.adherenceScore}%`} tone={preview.adherenceScore >= 80 ? "success" : "warning"} />
        <Metric icon={<Utensils size={18} />} label="Protein logged" value={`${preview.proteinTotal}g`} />
        <Metric icon={<BarChart3 size={18} />} label="Calories logged" value={`${preview.caloriesTotal || 0}`} />
        <Metric icon={<RefreshCw size={18} />} label="Modified meals" value={String(preview.modifiedCount)} tone={preview.modifiedCount ? "warning" : "success"} />
        <Metric icon={<ShieldCheck size={18} />} label="Outside meals" value={String(preview.outsideCount)} tone={preview.outsideCount ? "warning" : "success"} />
      </section>

      <form onSubmit={submitLog} className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Log today</div>
            <h2 className="mt-1 text-xl font-semibold">{selectedDay.day}: {selectedDay.label}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{selectedDay.trainingFocus} · Lunch is {selectedDay.lunchProtein} salad · Evening is {selectedDay.eveningSnack}</p>
          </div>
          <button className={primaryButtonClass}>
            <Plus size={16} />
            Save diet log
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_150px_130px_130px_minmax(220px,1fr)]">
          <Select label="Plan day" value={selectedDayName} onChange={setSelectedDayName} options={plan.week.map((day) => ({ value: day.day, label: `${day.day} - ${day.label}` }))} />
          <TextInput label="Date" type="date" value={date} onChange={setDate} />
          <TextInput label="Weight kg" value={weight} onChange={setWeight} inputMode="decimal" placeholder="91" />
          <TextInput label="Water L" value={water} onChange={setWater} inputMode="decimal" placeholder="3" />
          <TextInput label="Day notes" value={dayNotes} onChange={setDayNotes} placeholder="Hunger, cravings, outside food, digestion" />
        </div>

        <div className="mt-5 space-y-3">
          {selectedDay.meals.map((meal) => {
            const input = slotInputs[meal.slot] ?? emptySlotInput();
            return (
              <article key={meal.slot} className="rounded-lg border bg-surface p-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)] xl:items-start">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">{slotLabels[meal.slot]} · {meal.timing}</div>
                    <h3 className="mt-1 break-words text-base font-semibold">{meal.title}</h3>
                    <div className="mt-1 text-xs leading-5 text-muted">{meal.formula}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge>{meal.calories}</Badge>
                      <Badge>{meal.protein}</Badge>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-6">
                    <Select className="xl:col-span-2" compact label="Status" value={input.status} onChange={(value) => updateSlotStatus(meal, value as DietSlotStatus)} options={statusOptions} />
                    <TextInput className="xl:col-span-2" compact label="Actual eaten" value={input.actual} onChange={(value) => updateSlot(meal.slot, { actual: value })} placeholder={meal.title} />
                    <TextInput compact label="Kcal" value={input.calories} onChange={(value) => updateSlot(meal.slot, { calories: value })} inputMode="decimal" placeholder="0" />
                    <TextInput compact label="Protein" value={input.protein} onChange={(value) => updateSlot(meal.slot, { protein: value })} inputMode="decimal" placeholder="0" />
                    <TextInput className="sm:col-span-2 xl:col-span-6" compact label="Notes" value={input.notes} onChange={(value) => updateSlot(meal.slot, { notes: value })} placeholder="Portion, craving, outside place" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 lg:grid-cols-3">
          {tips.map((tip) => (
            <div key={tip} className="text-sm leading-6 text-muted">{tip}</div>
          ))}
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Real-life fallback rules</h2>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {plan.realLifeRules.map((rule) => (
              <div key={rule.scenario} className="rounded-lg border bg-surface p-3">
                <div className="text-sm font-semibold">{rule.scenario}</div>
                <div className="mt-2 text-xs leading-5 text-muted">{rule.action}</div>
                <div className="mt-2 rounded-lg border bg-card px-2 py-1.5 text-xs text-muted">{rule.nextStep}</div>
              </div>
            ))}
          </div>
        </article>

        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Recent diet logs</h2>
          </div>
          <div className="mt-4 max-h-[420px] overflow-y-auto divide-y rounded-lg border bg-surface px-3">
            {dietLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{log.date.slice(0, 10)} - {log.metadata.day}</div>
                  <Badge tone={log.metadata.adherenceScore >= 80 ? "success" : "warning"}>{log.metadata.adherenceScore}%</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {log.metadata.proteinTotal || 0}g protein, {log.metadata.caloriesTotal || 0} kcal, {log.metadata.outsideCount} outside, {log.metadata.modifiedCount} modified.
                </div>
                {log.metadata.notes ? <div className="mt-1 text-xs leading-5 text-muted">{log.metadata.notes}</div> : null}
              </div>
            ))}
            {dietLogs.length === 0 ? <div className="py-10 text-center text-sm text-muted">No structured diet logs yet. Save today once to start analytics.</div> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function buildEmptyInputs(day: DietDay): Record<DietMealSlot, DietSlotInput> {
  return Object.fromEntries(day.meals.map((meal) => [meal.slot, plannedSlotInput(meal)])) as Record<DietMealSlot, DietSlotInput>;
}

function emptySlotInput(): DietSlotInput {
  return { status: "planned", actual: "", calories: "", protein: "", notes: "" };
}

function plannedSlotInput(meal: DietMeal): DietSlotInput {
  return {
    status: "planned",
    actual: meal.title,
    calories: String(plannedCalories(meal)),
    protein: String(plannedProtein(meal)),
    notes: "",
  };
}

function buildSlotLogs(day: DietDay, inputs: Record<DietMealSlot, DietSlotInput>): DietSlotLog[] {
  return day.meals.map((meal) => {
    const input = inputs[meal.slot] ?? plannedSlotInput(meal);
    return {
      slot: meal.slot,
      label: slotLabels[meal.slot],
      planned: meal.title,
      status: input.status,
      actual: input.actual.trim() || meal.title,
      calories: parseNumber(input.calories) || undefined,
      protein: parseNumber(input.protein) || undefined,
      notes: input.notes.trim() || undefined,
    };
  });
}

function buildPreview(day: DietDay, inputs: Record<DietMealSlot, DietSlotInput>) {
  const slots = buildSlotLogs(day, inputs);
  const caloriesTotal = slots.reduce((sum, slot) => sum + (slot.calories ?? 0), 0);
  const proteinTotal = slots.reduce((sum, slot) => sum + (slot.protein ?? 0), 0);
  const outsideCount = slots.filter((slot) => slot.status === "outside").length;
  const modifiedCount = slots.filter((slot) => slot.status === "modified").length;
  const skippedCount = slots.filter((slot) => slot.status === "skipped").length;
  const adherenceScore = Math.round(slots.reduce((sum, slot) => sum + statusScore[slot.status], 0) / slots.length);
  return { caloriesTotal, proteinTotal, outsideCount, modifiedCount, skippedCount, adherenceScore };
}

function buildDietTips(preview: ReturnType<typeof buildPreview>) {
  const tips: string[] = [];
  if (preview.outsideCount > 0) tips.push("Outside meal logged: keep the next meal homemade and skip fried sides or sugary drinks.");
  if (preview.modifiedCount > 1) tips.push("Multiple modifications: keep the structure tomorrow and prep lunch protein before sleeping.");
  if (preview.skippedCount > 0) tips.push("Skipped meal: do not compensate with a binge. Return to the next planned meal.");
  if (preview.proteinTotal > 0 && preview.proteinTotal < 110) tips.push("Protein is low so far: cover it with shake, lunch salad, or evening snack. Do not force dinner protein.");
  if (preview.caloriesTotal > 2100) tips.push("Calories are above the target range. Fix portions at dinner, not by starving tomorrow.");
  if (tips.length === 0) tips.push("Clean structure today. Keep dinner controlled and hit water before bed.");
  return tips.slice(0, 3);
}

function buildDietSummary(logs: DietDayLog[]) {
  const recent = logs.filter((log) => daysBetween(log.date, todayIso()) <= 14);
  if (recent.length === 0) return { loggedDays: 0, averageAdherence: 0, outsideMeals: 0 };
  const averageAdherence = Math.round(recent.reduce((sum, log) => sum + log.metadata.adherenceScore, 0) / recent.length);
  const outsideMeals = recent.reduce((sum, log) => sum + log.metadata.outsideCount, 0);
  return { loggedDays: recent.length, averageAdherence, outsideMeals };
}

function toDietDayLog(record: ManualRecord): DietDayLog | null {
  const metadata = record.metadata;
  if (!metadata || metadata.kind !== "diet_day_v1" || !Array.isArray(metadata.slots)) return null;
  return {
    id: record.id,
    date: record.date,
    title: record.title,
    notes: record.notes,
    metadata: metadata as unknown as DietDayLogMetadata,
  };
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(dateA.slice(0, 10)).getTime();
  const b = new Date(dateB.slice(0, 10)).getTime();
  return Math.abs(Math.round((b - a) / 86_400_000));
}

function parseNumber(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function plannedNumber(value: string) {
  const matches = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter(Number.isFinite);
  if (matches.length === 0) return 0;
  if (matches.length === 1) return Math.round(matches[0]!);
  return Math.round((matches[0]! + matches[1]!) / 2);
}

function plannedCalories(meal: DietMeal) {
  if (meal.slot === "pre_gym") return 0;
  return plannedNumber(meal.calories);
}

function plannedProtein(meal: DietMeal) {
  if (meal.slot === "pre_gym" || meal.slot === "dinner") return 0;
  return plannedNumber(meal.protein);
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  compact = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  compact?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 text-sm", className)}>
      <span className={cn("text-muted", compact && "text-xs")}>{label}</span>
      <input
        className={cn("mt-1 w-full rounded-lg border bg-background px-3 outline-none transition focus:border-accent", compact ? "h-9 text-sm" : "h-10")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  compact = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 text-sm", className)}>
      <span className={cn("text-muted", compact && "text-xs")}>{label}</span>
      <select
        className={cn("mt-1 w-full rounded-lg border bg-background px-3 outline-none transition focus:border-accent", compact ? "h-9 text-sm" : "h-10")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
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
