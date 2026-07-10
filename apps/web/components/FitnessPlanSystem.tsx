import { Activity, Apple, Bed, CalendarDays, Dumbbell, Footprints, RefreshCw, ShieldCheck, Watch } from "lucide-react";
import { type FitnessSystem, type TrainingDay, type TrainingExercise } from "@personal-os/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FitnessPlanSystem({ fitness }: { fitness: FitnessSystem }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_560px] xl:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Training protocol + reset method</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Train hard enough to keep muscle, recover well enough to repeat.</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{fitness.profile.goal}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
            <Metric label="Split" value={fitness.profile.split} />
            <Metric label="Session" value={fitness.profile.sessionLength} />
            <Metric label="Steps" value={`${fitness.steps.currentTarget.toLocaleString("en-IN")}+`} />
            <Metric label="Priority" value={fitness.profile.fatLossPriority} />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Today: {fitness.today.day} · {fitness.today.title}</h2>
          </div>
          <div className="mt-1 text-sm leading-6 text-muted">{fitness.today.focus} Exercises are fixed, but sets, reps, and load are logged in the tracker above.</div>
          <TrainingSession day={fitness.today} />
        </article>

        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Weekly schedule</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fitness.week.map((day) => (
              <div key={day.day} className={cn("rounded-lg border bg-background p-3", day.day === fitness.today.day && "border-accent")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{day.day} · {day.title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted">{day.focus}</div>
                  </div>
                  <span className="rounded-lg border bg-card px-2 py-1 text-xs capitalize text-muted">{day.type}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
                  <MiniMetric label="Time" value={day.duration} />
                  <MiniMetric label="Intensity" value={day.intensity} />
                  <MiniMetric label="Steps" value={day.stepsTarget} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Footprints size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Steps target</h2>
          </div>
          <div className="mt-4 rounded-lg border bg-background p-4 text-center">
            <div className="text-3xl font-semibold">{fitness.steps.currentTarget.toLocaleString("en-IN")}</div>
            <div className="mt-1 text-sm text-muted">starting daily target</div>
          </div>
          <div className="mt-4 space-y-2">
            {fitness.steps.dailyRules.map((rule) => (
              <div key={rule} className="rounded-lg border bg-background px-3 py-2 text-sm text-muted">{rule}</div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Steps progression</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {fitness.steps.progression.map((item) => (
              <div key={item.week} className="rounded-lg border bg-background p-3">
                <div className="text-sm font-medium">{item.week}</div>
                <div className="mt-2 text-lg font-semibold">{item.target}</div>
                <div className="mt-2 text-xs leading-5 text-muted">{item.rule}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border bg-background p-3 text-sm leading-6 text-muted">
            {fitness.profile.fatLossPriority}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RuleCard title="Strength progression" icon={<Dumbbell size={18} className="text-accent" />} rules={fitness.progression.strengthRules} />
        <RuleCard title="Cardio rules" icon={<Activity size={18} className="text-success" />} rules={fitness.progression.cardioRules} />
        <RuleCard title="Deload rules" icon={<RefreshCw size={18} className="text-warning" />} rules={fitness.progression.deloadRules} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Bed size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Recovery dashboard</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fitness.recovery.map((item) => (
              <div key={item.label} className="rounded-lg border bg-background p-3">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="mt-1 text-lg font-semibold">{item.target}</div>
                <div className="mt-2 text-xs leading-5 text-muted">{item.rule}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-warning" />
            <h2 className="text-lg font-semibold">Reset rules</h2>
          </div>
          <div className="mt-3 space-y-2">
            {fitness.resetRules.map((rule) => (
              <div key={rule} className="rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-muted">{rule}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Apple size={18} className="text-foreground" />
          <h2 className="text-lg font-semibold">Apple Health connection</h2>
        </div>
        <div className="mt-2 text-sm leading-6 text-muted">{fitness.appleHealth.bestPath}</div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {fitness.appleHealth.options.map((option) => (
            <article key={option.label} className="rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{option.label}</div>
                <span className="rounded-lg border bg-card px-2 py-1 text-xs capitalize text-muted">{option.effort}</span>
              </div>
              <div className="mt-2 text-sm leading-6 text-muted">{option.description}</div>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2">
            <Watch size={16} className="text-accent" />
            <div className="text-sm font-medium">Data to pull later</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {fitness.appleHealth.dataToRead.map((item) => (
              <span key={item} className="rounded-lg border bg-card px-2 py-1 text-xs text-muted">{item}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TrainingSession({ day }: { day: TrainingDay }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 text-sm md:grid-cols-4">
        <MiniMetric label="Duration" value={day.duration} />
        <MiniMetric label="Intensity" value={day.intensity} />
        <MiniMetric label="Steps" value={day.stepsTarget} />
        <MiniMetric label="Cardio" value={day.cardio} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Checklist title="Warm-up" items={day.warmup} />
        <Checklist title="Cool-down" items={day.cooldown} />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px] divide-y rounded-lg border">
          <div className="grid grid-cols-[1.4fr_0.45fr_0.6fr_0.65fr_1.2fr] gap-3 bg-background px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted">
            <div>Exercise</div>
            <div>Set guide</div>
            <div>Rep guide</div>
            <div>Rest</div>
            <div>Notes</div>
          </div>
          {day.exercises.map((exercise) => (
            <ExerciseRow key={`${day.day}-${exercise.name}`} exercise={exercise} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-muted">{day.recoveryRule}</div>
    </div>
  );
}

function ExerciseRow({ exercise }: { exercise: TrainingExercise }) {
  return (
    <div className="grid grid-cols-[1.4fr_0.45fr_0.6fr_0.65fr_1.2fr] gap-3 px-3 py-3 text-sm">
      <div className="font-medium">{exercise.name}</div>
      <div className="text-muted">{exercise.sets}</div>
      <div className="text-muted">{exercise.reps}</div>
      <div className="text-muted">{exercise.rest}</div>
      <div className="text-muted">{exercise.notes}</div>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <div key={item} className="text-sm text-muted">{item}</div>
        ))}
      </div>
    </div>
  );
}

function RuleCard({ title, icon, rules }: { title: string; icon: ReactNode; rules: string[] }) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-3 space-y-2">
        {rules.map((rule) => (
          <div key={rule} className="rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-muted">{rule}</div>
        ))}
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-medium leading-5">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2 py-3">
      <div className="break-words text-sm font-semibold leading-5">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
