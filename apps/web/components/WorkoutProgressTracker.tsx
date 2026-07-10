"use client";

import { Activity, BarChart3, Dumbbell, Flame, LineChart as LineChartIcon, Plus, Trophy } from "lucide-react";
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
import { type FitnessSystem, type ManualRecord, type TrainingDay, type TrainingExercise } from "@personal-os/core";
import { cn, todayIso } from "@/lib/utils";

type ExerciseInput = {
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
  notes: string;
};

type ExerciseLog = {
  exerciseName: string;
  muscleGroups: string[];
  plannedSets: string;
  plannedReps: string;
  setCount: number;
  repsPerSet: number;
  weightKg: number;
  rpe?: number | undefined;
  notes?: string | undefined;
  totalReps: number;
  volumeKg: number;
  estimatedOneRepMax: number;
  prs: string[];
  previous?: ExerciseSnapshot | undefined;
};

type ExerciseSnapshot = {
  date: string;
  setCount: number;
  repsPerSet: number;
  weightKg: number;
  volumeKg: number;
  estimatedOneRepMax: number;
  rpe?: number | undefined;
};

type WorkoutSessionMetadata = {
  kind: "workout_session_v1";
  day: string;
  title: string;
  type: TrainingDay["type"];
  missed?: boolean;
  missedReason?: string;
  rescheduleAdvice?: string;
  durationMinutes?: number;
  energy?: string;
  sleepHours?: number;
  steps?: number;
  exercises: ExerciseLog[];
};

type WorkoutSession = {
  id: string;
  date: string;
  title: string;
  notes?: string | undefined;
  metadata: WorkoutSessionMetadata;
};

type ExerciseBest = {
  exerciseName: string;
  sessions: number;
  bestWeight: number;
  bestVolume: number;
  bestEstimatedOneRepMax: number;
  last?: ExerciseSnapshot;
  history: Array<ExerciseSnapshot & { prs: string[] }>;
};

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";
const primaryButtonClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/25 sm:w-auto";
const secondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-45";

const chartColors = {
  accent: "#0f8f84",
  success: "#17915a",
  warning: "#d97706",
  danger: "#dc2626",
  slate: "#64748b",
};

export function WorkoutProgressTracker({ initialFitness }: { initialFitness: FitnessSystem }) {
  const fitness = useMemo(() => initialFitness, [initialFitness]);
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [status, setStatus] = useState("Ready to log today's training.");
  const [selectedDayName, setSelectedDayName] = useState(fitness.today.day);
  const selectedDay = fitness.week.find((day) => day.day === selectedDayName) ?? fitness.today;
  const [date, setDate] = useState(todayIso());
  const [duration, setDuration] = useState("");
  const [energy, setEnergy] = useState("Good");
  const [sleepHours, setSleepHours] = useState("");
  const [steps, setSteps] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [missedReason, setMissedReason] = useState("");
  const [exerciseInputs, setExerciseInputs] = useState<Record<string, ExerciseInput>>(() => buildEmptyInputs(selectedDay));
  const [selectedExercise, setSelectedExercise] = useState(selectedDay.exercises[0]?.name ?? "");
  const [lastSavedPrs, setLastSavedPrs] = useState<ExerciseLog[]>([]);

  async function loadRecords() {
    const response = await fetch("/api/manual/workout", { cache: "no-store" });
    if (!response.ok) {
      setStatus("Could not load workout logs.");
      return;
    }
    const body = (await response.json()) as { records: ManualRecord[] };
    setRecords(body.records);
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    setExerciseInputs(buildEmptyInputs(selectedDay));
    setSelectedExercise(selectedDay.exercises[0]?.name ?? "");
  }, [selectedDayName]);

  const sessions = useMemo(() => records.map(toWorkoutSession).filter((session): session is WorkoutSession => Boolean(session)), [records]);
  const exerciseBests = useMemo(() => buildExerciseBests(sessions), [sessions]);
  const exerciseOptions = useMemo(() => buildExerciseOptions(fitness.week, sessions), [fitness.week, sessions]);
  const analytics = useMemo(() => buildWorkoutAnalytics(sessions), [sessions]);
  const bodyPartData = useMemo(() => buildBodyPartData(sessions), [sessions]);
  const selectedExerciseHistory = exerciseBests.get(selectedExercise)?.history ?? [];
  const selectedExerciseChartData = selectedExerciseHistory.map((item) => ({
    date: item.date.slice(5),
    e1rm: Math.round(item.estimatedOneRepMax * 10) / 10,
    volume: Math.round(item.volumeKg),
    weight: item.weightKg,
  }));

  async function submitSession(event: React.FormEvent) {
    event.preventDefault();
    const exercises = buildExerciseLogs(selectedDay, exerciseInputs, exerciseBests);
    if (exercises.length === 0) {
      setStatus("Add sets/reps/weight for at least one exercise before saving.");
      return;
    }

    const prEntries = exercises.filter((exercise) => exercise.prs.length > 0);
    const durationValue = parseNumber(duration);
    const payload = {
      date,
      title: `${selectedDay.day} - ${selectedDay.title}`,
      amount: durationValue,
      unit: "min",
      category: selectedDay.title,
      notes: sessionNotes,
      metadata: {
        kind: "workout_session_v1",
        day: selectedDay.day,
        title: selectedDay.title,
        type: selectedDay.type,
        durationMinutes: durationValue,
        energy,
        sleepHours: parseNumber(sleepHours),
        steps: parseNumber(steps),
        exercises,
      } satisfies WorkoutSessionMetadata,
    };

    const response = await fetch("/api/manual/workout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus("Could not save workout session.");
      return;
    }

    setLastSavedPrs(prEntries);
    setStatus(prEntries.length > 0 ? `${prEntries.length} new PR signal${prEntries.length === 1 ? "" : "s"} saved.` : "Workout saved. Keep the next session clean and repeatable.");
    setDuration("");
    setSleepHours("");
    setSteps("");
    setSessionNotes("");
    setExerciseInputs(buildEmptyInputs(selectedDay));
    await loadRecords();
  }

  async function markWorkoutMissed() {
    const advice = buildMissedWorkoutAdvice(selectedDay, fitness.tomorrow);
    const response = await fetch("/api/manual/workout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        title: `${selectedDay.day} - ${selectedDay.title} missed`,
        amount: 0,
        unit: "min",
        category: selectedDay.title,
        status: "missed",
        notes: missedReason,
        metadata: {
          kind: "workout_session_v1",
          day: selectedDay.day,
          title: selectedDay.title,
          type: selectedDay.type,
          missed: true,
          missedReason,
          rescheduleAdvice: advice,
          exercises: [],
        } satisfies WorkoutSessionMetadata,
      }),
    });

    if (!response.ok) {
      setStatus("Could not mark workout as missed.");
      return;
    }

    setStatus(`Missed workout saved. ${advice}`);
    setMissedReason("");
    setLastSavedPrs([]);
    await loadRecords();
  }

  function updateExercise(name: string, patch: Partial<ExerciseInput>) {
    setExerciseInputs((current) => ({
      ...current,
      [name]: { ...(current[name] ?? emptyExerciseInput()), ...patch },
    }));
  }

  function copyLast(exercise: TrainingExercise) {
    const last = exerciseBests.get(exercise.name)?.last;
    if (!last) return;
    updateExercise(exercise.name, {
      sets: String(last.setCount || ""),
      reps: String(last.repsPerSet || ""),
      weight: last.weightKg ? String(last.weightKg) : "",
      rpe: last.rpe ? String(last.rpe) : "",
    });
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "border-accent/20")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Progressive overload tracker</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">Exercises stay fixed. Performance is logged every session.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Enter what you actually did today. The app shows your previous performance, detects new PRs, and turns the data into exercise and body-part analytics.
            </p>
          </div>
          <div className="rounded-lg border bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Current training status</div>
            <div className="mt-2 text-sm font-medium leading-5">{status}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics.sessions30Days} sessions</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics.totalSets30Days} sets</span>
              <span className="rounded-lg border bg-card px-2 py-1.5">{analytics.prCount30Days} PRs</span>
            </div>
          </div>
        </div>
      </section>

      {lastSavedPrs.length > 0 ? (
        <section className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <Trophy size={18} />
            <h2 className="text-lg font-semibold">New PR saved</h2>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {lastSavedPrs.map((exercise) => (
              <div key={exercise.exerciseName} className="rounded-lg border bg-card px-3 py-2 text-sm">
                <div className="font-semibold">{exercise.exerciseName}</div>
                <div className="mt-1 text-xs text-muted">{exercise.prs.join(", ")}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <form onSubmit={submitSession} className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Log today's work</div>
              <h2 className="mt-1 text-xl font-semibold">{selectedDay.day}: {selectedDay.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{selectedDay.focus}</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button type="button" className={secondaryButtonClass} onClick={() => void markWorkoutMissed()}>
                Mark missed
              </button>
              <button className={primaryButtonClass}>
                <Plus size={16} />
                Save workout
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_150px_130px_140px_130px]">
            <Select label="Training day" value={selectedDayName} onChange={setSelectedDayName} options={fitness.week.map((day) => ({ value: day.day, label: `${day.day} - ${day.title}` }))} />
            <TextInput label="Date" type="date" value={date} onChange={setDate} />
            <TextInput label="Duration min" value={duration} onChange={setDuration} inputMode="numeric" placeholder="60" />
            <Select label="Energy" value={energy} onChange={setEnergy} options={["Excellent", "Good", "Low", "Tired"].map((item) => ({ value: item, label: item }))} />
            <TextInput label="Steps" value={steps} onChange={setSteps} inputMode="numeric" placeholder="8000" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
            <TextInput label="Sleep hours" value={sleepHours} onChange={setSleepHours} inputMode="decimal" placeholder="7" />
            <TextInput label="Session notes" value={sessionNotes} onChange={setSessionNotes} placeholder="Energy, soreness, pain, form notes" />
          </div>

          <div className="mt-3 grid gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.6fr)] lg:items-end">
            <div>
              <div className="text-sm font-semibold">If you miss this workout</div>
              <div className="mt-1 text-xs leading-5 text-muted">{buildMissedWorkoutAdvice(selectedDay, fitness.tomorrow)}</div>
            </div>
            <TextInput compact label="Reason / note" value={missedReason} onChange={setMissedReason} placeholder="Late work, low sleep, travel" />
          </div>

          <div className="mt-5 space-y-3">
            {selectedDay.exercises.map((exercise) => {
              const input = exerciseInputs[exercise.name] ?? emptyExerciseInput();
              const best = exerciseBests.get(exercise.name);
              const projected = previewExerciseLog(exercise, input, best);
              return (
                <article key={exercise.name} className={cn("rounded-lg border bg-surface p-3", projected?.prs.length ? "border-success/40 bg-success/10" : "")}>
                  <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold">{exercise.name}</h3>
                        {projected?.prs.length ? <Badge tone="success">New PR</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {musclesForExercise(exercise.name).map((muscle) => (
                          <Badge key={`${exercise.name}-${muscle}`}>{muscle}</Badge>
                        ))}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-muted">
                        Guide: {exercise.sets} sets, {exercise.reps} reps, rest {exercise.rest}.
                      </div>
                      <LastPerformance best={best} onCopy={() => copyLast(exercise)} />
                    </div>

                    <div className="min-w-0">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[90px_110px_110px_90px_minmax(180px,1fr)]">
                        <TextInput compact label="Sets" value={input.sets} onChange={(value) => updateExercise(exercise.name, { sets: value })} inputMode="numeric" placeholder="0" />
                        <TextInput compact label="Reps/set" value={input.reps} onChange={(value) => updateExercise(exercise.name, { reps: value })} inputMode="decimal" placeholder="0" />
                        <TextInput compact label="Weight kg" value={input.weight} onChange={(value) => updateExercise(exercise.name, { weight: value })} inputMode="decimal" placeholder="0" />
                        <TextInput compact label="RPE" value={input.rpe} onChange={(value) => updateExercise(exercise.name, { rpe: value })} inputMode="decimal" placeholder="7-9" />
                        <TextInput compact label="Notes" value={input.notes} onChange={(value) => updateExercise(exercise.name, { notes: value })} placeholder="Form, pain, tempo" />
                      </div>
                      {projected ? (
                        <div className="mt-2 rounded-lg border bg-card px-3 py-2 text-xs leading-5 text-muted">
                          Preview: {projected.totalReps} reps, {Math.round(projected.volumeKg).toLocaleString("en-IN")} kg volume, e1RM {roundOne(projected.estimatedOneRepMax)} kg.
                          {projected.prs.length ? ` PR: ${projected.prs.join(", ")}.` : " Increase only if form is clean."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-warning" />
            <h2 className="text-lg font-semibold">Progress targets</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {selectedDay.exercises.map((exercise) => {
              const best = exerciseBests.get(exercise.name);
              return (
                <div key={`target-${exercise.name}`} className="rounded-lg border bg-surface p-3">
                  <div className="text-sm font-semibold">{exercise.name}</div>
                  <div className="mt-1 text-xs leading-5 text-muted">{nextProgressionSuggestion(exercise, best)}</div>
                </div>
              );
            })}
          </div>
        </article>

        <article className={panelClass}>
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-danger" />
              <h2 className="text-lg font-semibold">Recent sessions</h2>
            </div>
          <div className="mt-4 max-h-[420px] overflow-y-auto divide-y rounded-lg border bg-surface px-3">
            {sessions.slice(0, 8).map((session) => (
              <div key={session.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{session.date.slice(0, 10)} - {session.metadata.title}</div>
                  {session.metadata.missed ? <Badge tone="warning">Missed</Badge> : null}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {session.metadata.missed
                    ? session.metadata.rescheduleAdvice ?? "Missed workout saved."
                    : `${session.metadata.exercises.length} exercises, ${session.metadata.exercises.reduce((sum, exercise) => sum + exercise.setCount, 0)} sets${session.metadata.durationMinutes ? `, ${session.metadata.durationMinutes} min` : ""}`}
                </div>
                {session.metadata.exercises.some((exercise) => exercise.prs.length) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.metadata.exercises.filter((exercise) => exercise.prs.length).slice(0, 4).map((exercise) => (
                      <Badge key={`${session.id}-${exercise.exerciseName}`} tone="success">{exercise.exerciseName}</Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {sessions.length === 0 ? <div className="py-10 text-center text-sm text-muted">No structured workout sessions yet. Save today's workout to start analytics.</div> : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Dumbbell size={18} />} label="Sessions last 30 days" value={String(analytics.sessions30Days)} />
        <Metric icon={<Activity size={18} />} label="Hard sets last 30 days" value={analytics.totalSets30Days.toLocaleString("en-IN")} />
        <Metric icon={<BarChart3 size={18} />} label="Volume last 30 days" value={`${Math.round(analytics.volume30Days).toLocaleString("en-IN")} kg`} />
        <Metric icon={<Trophy size={18} />} label="PR signals last 30 days" value={String(analytics.prCount30Days)} tone="success" />
        <Metric icon={<Flame size={18} />} label="Missed last 30 days" value={String(analytics.missedCount30Days)} tone={analytics.missedCount30Days > 0 ? "warning" : "success"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <article className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LineChartIcon size={18} className="text-accent" />
              <h2 className="text-lg font-semibold">Exercise progression</h2>
            </div>
            <select className="h-10 rounded-lg border bg-surface px-3 text-sm outline-none focus:border-accent" value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}>
              {exerciseOptions.map((exercise) => <option key={exercise} value={exercise}>{exercise}</option>)}
            </select>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartFrame title="Estimated 1RM trend">
              {selectedExerciseChartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={selectedExerciseChartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={38} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                    <Line type="monotone" dataKey="e1rm" stroke={chartColors.accent} strokeWidth={3} dot={{ r: 3 }} name="e1RM kg" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Log this exercise to see strength trend." />}
            </ChartFrame>

            <ChartFrame title="Volume trend">
              {selectedExerciseChartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={selectedExerciseChartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                    <Bar dataKey="volume" fill={chartColors.warning} radius={[4, 4, 0, 0]} name="Volume kg" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Volume appears once sets, reps, and weight are saved." />}
            </ChartFrame>
          </div>
        </article>

        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Body-part focus</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">{analytics.bodyPartInsight}</p>
          <div className="mt-4">
            {bodyPartData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bodyPartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="muscle" tickLine={false} axisLine={false} fontSize={12} width={84} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #d8dee8" }} />
                  <Bar dataKey="sets" fill={chartColors.success} radius={[0, 4, 4, 0]} name="Hard sets" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart text="Body-part analytics start after your first structured session." />}
          </div>
        </article>
      </section>

      <section className={panelClass}>
        <div className="flex items-center gap-2">
          <Dumbbell size={18} className="text-accent" />
          <h2 className="text-lg font-semibold">Exercise analytics</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[860px] divide-y rounded-lg border bg-surface">
            <div className="grid grid-cols-[1.4fr_0.45fr_0.6fr_0.7fr_0.7fr_1fr] gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <div>Exercise</div>
              <div>Sessions</div>
              <div>Best kg</div>
              <div>Best e1RM</div>
              <div>Best volume</div>
              <div>Last logged</div>
            </div>
            {[...exerciseBests.values()].sort((a, b) => b.sessions - a.sessions).map((best) => (
              <div key={`analytics-${best.exerciseName}`} className="grid grid-cols-[1.4fr_0.45fr_0.6fr_0.7fr_0.7fr_1fr] gap-3 px-3 py-3 text-sm">
                <div>
                  <div className="font-semibold">{best.exerciseName}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {musclesForExercise(best.exerciseName).map((muscle) => <Badge key={`${best.exerciseName}-${muscle}`}>{muscle}</Badge>)}
                  </div>
                </div>
                <div>{best.sessions}</div>
                <div>{roundOne(best.bestWeight)}</div>
                <div>{roundOne(best.bestEstimatedOneRepMax)}</div>
                <div>{Math.round(best.bestVolume).toLocaleString("en-IN")}</div>
                <div className="text-muted">{best.last ? `${best.last.date.slice(0, 10)} - ${best.last.setCount}x${best.last.repsPerSet} @ ${best.last.weightKg}kg` : "Never"}</div>
              </div>
            ))}
            {exerciseBests.size === 0 ? <div className="py-10 text-center text-sm text-muted">No exercise analytics yet.</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function buildEmptyInputs(day: TrainingDay): Record<string, ExerciseInput> {
  return Object.fromEntries(day.exercises.map((exercise) => [exercise.name, emptyExerciseInput()]));
}

function emptyExerciseInput(): ExerciseInput {
  return { sets: "", reps: "", weight: "", rpe: "", notes: "" };
}

function buildExerciseLogs(day: TrainingDay, inputs: Record<string, ExerciseInput>, bests: Map<string, ExerciseBest>): ExerciseLog[] {
  return day.exercises.flatMap((exercise) => {
    const input = inputs[exercise.name] ?? emptyExerciseInput();
    const preview = previewExerciseLog(exercise, input, bests.get(exercise.name));
    return preview ? [preview] : [];
  });
}

function previewExerciseLog(exercise: TrainingExercise, input: ExerciseInput, best?: ExerciseBest): ExerciseLog | null {
  const setCount = parseNumber(input.sets);
  const repsPerSet = parseNumber(input.reps);
  const weightKg = parseNumber(input.weight);
  const rpe = parseNumber(input.rpe);
  const hasWork = setCount > 0 || repsPerSet > 0 || weightKg > 0 || input.notes.trim().length > 0;
  if (!hasWork) return null;

  const totalReps = setCount * repsPerSet;
  const volumeKg = totalReps * weightKg;
  const estimatedOneRepMax = weightKg > 0 && repsPerSet > 0 ? weightKg * (1 + repsPerSet / 30) : 0;
  const prs = detectPrs({ weightKg, volumeKg, estimatedOneRepMax }, best);
  return {
    exerciseName: exercise.name,
    muscleGroups: musclesForExercise(exercise.name),
    plannedSets: exercise.sets,
    plannedReps: exercise.reps,
    setCount,
    repsPerSet,
    weightKg,
    rpe: rpe || undefined,
    notes: input.notes.trim() || undefined,
    totalReps,
    volumeKg,
    estimatedOneRepMax,
    prs,
    previous: best?.last,
  };
}

function detectPrs(current: { weightKg: number; volumeKg: number; estimatedOneRepMax: number }, best?: ExerciseBest) {
  if (!best) return current.weightKg > 0 || current.volumeKg > 0 ? ["First logged baseline"] : [];
  const prs: string[] = [];
  if (current.weightKg > 0 && current.weightKg > best.bestWeight) prs.push(`Load PR +${roundOne(current.weightKg - best.bestWeight)}kg`);
  if (current.estimatedOneRepMax > 0 && current.estimatedOneRepMax > best.bestEstimatedOneRepMax + 0.25) prs.push(`Strength PR +${roundOne(current.estimatedOneRepMax - best.bestEstimatedOneRepMax)}kg e1RM`);
  if (current.volumeKg > 0 && current.volumeKg > best.bestVolume) prs.push(`Volume PR +${Math.round(current.volumeKg - best.bestVolume).toLocaleString("en-IN")}kg`);
  return prs;
}

function toWorkoutSession(record: ManualRecord): WorkoutSession | null {
  const metadata = record.metadata;
  if (!metadata || metadata.kind !== "workout_session_v1" || !Array.isArray(metadata.exercises)) return null;
  const parsed = metadata as unknown as WorkoutSessionMetadata;
  return {
    id: record.id,
    date: record.date,
    title: record.title,
    notes: record.notes,
    metadata: parsed,
  };
}

function buildExerciseBests(sessions: WorkoutSession[]) {
  const bests = new Map<string, ExerciseBest>();
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of ordered) {
    for (const exercise of session.metadata.exercises) {
      const current = bests.get(exercise.exerciseName) ?? {
        exerciseName: exercise.exerciseName,
        sessions: 0,
        bestWeight: 0,
        bestVolume: 0,
        bestEstimatedOneRepMax: 0,
        history: [],
      };
      const snapshot = {
        date: session.date,
        setCount: exercise.setCount,
        repsPerSet: exercise.repsPerSet,
        weightKg: exercise.weightKg,
        volumeKg: exercise.volumeKg,
        estimatedOneRepMax: exercise.estimatedOneRepMax,
        rpe: exercise.rpe,
        prs: exercise.prs,
      };
      current.sessions += 1;
      current.bestWeight = Math.max(current.bestWeight, exercise.weightKg);
      current.bestVolume = Math.max(current.bestVolume, exercise.volumeKg);
      current.bestEstimatedOneRepMax = Math.max(current.bestEstimatedOneRepMax, exercise.estimatedOneRepMax);
      current.last = snapshot;
      current.history.push(snapshot);
      bests.set(exercise.exerciseName, current);
    }
  }
  return bests;
}

function buildWorkoutAnalytics(sessions: WorkoutSession[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = sessions.filter((session) => new Date(session.date) >= cutoff);
  const completedRecent = recent.filter((session) => !session.metadata.missed);
  const allRecentExercises = completedRecent.flatMap((session) => session.metadata.exercises);
  const sessions30Days = completedRecent.length;
  const missedCount30Days = recent.filter((session) => session.metadata.missed).length;
  const totalSets30Days = allRecentExercises.reduce((sum, exercise) => sum + exercise.setCount, 0);
  const volume30Days = allRecentExercises.reduce((sum, exercise) => sum + exercise.volumeKg, 0);
  const prCount30Days = allRecentExercises.reduce((sum, exercise) => sum + exercise.prs.length, 0);
  const bodyPartData = buildBodyPartData(sessions);
  const topMuscle = bodyPartData[0];
  const totalBodySets = bodyPartData.reduce((sum, item) => sum + item.sets, 0);
  const bodyPartInsight = topMuscle && totalBodySets > 0
    ? `${topMuscle.muscle} is getting the most work right now with ${topMuscle.sets} hard sets. Keep the next week balanced across push, pull, legs, and core.`
    : "Log structured sessions to see which body parts are getting the most work.";
  return { sessions30Days, missedCount30Days, totalSets30Days, volume30Days, prCount30Days, bodyPartInsight };
}

function buildMissedWorkoutAdvice(day: TrainingDay, tomorrow: TrainingDay) {
  if (day.type === "recovery" || day.type === "conditioning") {
    return "Do not compensate with extra intensity. Continue the next planned strength day and keep steps/protein steady.";
  }
  if (tomorrow.type === "recovery" || tomorrow.type === "rest") {
    return `Move ${day.title} to ${tomorrow.day} and push the lighter reset/rest work one day later.`;
  }
  if (tomorrow.type === "conditioning") {
    return `Replace ${tomorrow.day}'s conditioning with ${day.title}. Keep conditioning optional later in the week.`;
  }
  return `Do not double two strength workouts. Continue with ${tomorrow.day}'s ${tomorrow.title}, and treat the missed session as recovery unless the week has a clear rest slot.`;
}

function buildBodyPartData(sessions: WorkoutSession[]) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  const totals = new Map<string, number>();
  for (const session of sessions) {
    if (new Date(session.date) < cutoff) continue;
    for (const exercise of session.metadata.exercises) {
      for (const muscle of exercise.muscleGroups.length ? exercise.muscleGroups : musclesForExercise(exercise.exerciseName)) {
        totals.set(muscle, (totals.get(muscle) ?? 0) + exercise.setCount);
      }
    }
  }
  return [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 8);
}

function buildExerciseOptions(week: TrainingDay[], sessions: WorkoutSession[]) {
  const names = new Set<string>();
  for (const day of week) {
    for (const exercise of day.exercises) names.add(exercise.name);
  }
  for (const session of sessions) {
    for (const exercise of session.metadata.exercises) names.add(exercise.exerciseName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function musclesForExercise(name: string): string[] {
  const lower = name.toLowerCase();
  if (/bench|chest press|incline dumbbell press/.test(lower)) return ["Chest", "Triceps", "Shoulders"];
  if (/overhead|lateral raise/.test(lower)) return ["Shoulders", "Triceps"];
  if (/row|pulldown|pull-up|face pull/.test(lower)) return ["Back", "Biceps", "Rear delts"];
  if (/pushdown|triceps|cable pushdown/.test(lower)) return ["Triceps"];
  if (/curl/.test(lower)) return ["Biceps"];
  if (/squat|leg press|lunge|split squat|front squat/.test(lower)) return ["Quads", "Glutes"];
  if (/romanian|hamstring|hip thrust/.test(lower)) return ["Hamstrings", "Glutes"];
  if (/calf/.test(lower)) return ["Calves"];
  if (/plank|dead bug|woodchop|pallof|sit-up|crunch/.test(lower)) return ["Core"];
  if (/walk|cycle|row|circuit|mobility|review/.test(lower)) return ["Conditioning"];
  if (/back extension|hinge/.test(lower)) return ["Lower back", "Glutes"];
  return ["General"];
}

function nextProgressionSuggestion(exercise: TrainingExercise, best?: ExerciseBest) {
  if (!best?.last) return `Start with clean form inside the guide range: ${exercise.sets} sets and ${exercise.reps} reps. This first log becomes your baseline.`;
  const last = best.last;
  const upperRepTarget = parseRepUpperBound(exercise.reps);
  if (last.repsPerSet >= upperRepTarget && last.weightKg > 0) return `Last was ${last.setCount}x${last.repsPerSet} @ ${last.weightKg}kg. If form was clean, try +2.5kg and stay near the lower rep range.`;
  return `Last was ${last.setCount}x${last.repsPerSet} @ ${last.weightKg}kg. Try adding 1 rep per set before increasing weight.`;
}

function parseRepUpperBound(value: string) {
  const matches = value.match(/\d+/g)?.map(Number) ?? [];
  return matches.length ? Math.max(...matches) : 12;
}

function parseNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function LastPerformance({ best, onCopy }: { best?: ExerciseBest | undefined; onCopy: () => void }) {
  if (!best?.last) return <div className="mt-3 rounded-lg border border-dashed bg-card px-3 py-2 text-xs text-muted">No last session yet. Log a baseline today.</div>;
  const last = best.last;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs leading-5 text-muted">
      <div>
        Last: {last.date.slice(0, 10)} - {last.setCount}x{last.repsPerSet} @ {last.weightKg}kg, volume {Math.round(last.volumeKg).toLocaleString("en-IN")}kg, e1RM {roundOne(last.estimatedOneRepMax)}kg.
      </div>
      <button type="button" className={secondaryButtonClass} onClick={onCopy}>
        Copy last
      </button>
    </div>
  );
}

function Metric({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <article className="min-h-[132px] rounded-lg border bg-card p-4 shadow-soft">
      <div className={cn("inline-flex rounded-lg border bg-surface p-2 text-muted", tone === "success" && "border-success/25 bg-success/10 text-success", tone === "warning" && "border-warning/30 bg-warning/10 text-warning")}>{icon}</div>
      <div className="mt-4 break-words text-2xl font-semibold tracking-normal">{value}</div>
      <div className="mt-1 text-xs font-medium text-muted">{label}</div>
    </article>
  );
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-surface p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 h-[280px]">{children}</div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-card px-4 text-center text-sm leading-6 text-muted">{text}</div>;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted", tone === "success" && "border-success/30 bg-success/10 text-success", tone === "warning" && "border-warning/40 bg-warning/10 text-warning")}>
      {children}
    </span>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
  compact?: boolean;
}) {
  return (
    <label className={cn("block", compact ? "text-xs" : "text-sm")}>
      <span className="font-medium text-muted">{label}</span>
      <input
        className={cn(
          "mt-1 w-full rounded-lg border bg-surface text-sm outline-none transition placeholder:text-muted/55 focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15",
          compact ? "h-9 px-2" : "h-10 px-3",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-muted">{label}</span>
      <select className="mt-1 h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none transition focus:border-accent focus:bg-card focus:ring-2 focus:ring-accent/15" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
