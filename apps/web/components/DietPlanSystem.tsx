import { AlertTriangle, CalendarDays, ChefHat, Clock, RefreshCw, ShieldCheck, ShoppingBasket, Target, Utensils } from "lucide-react";
import { type DietMeal, type DietSystem } from "@personal-os/core";
import { cn } from "@/lib/utils";

const slotLabels: Record<DietMeal["slot"], string> = {
  pre_gym: "Pre gym",
  post_gym: "Post gym",
  breakfast: "Breakfast",
  lunch: "Lunch",
  evening: "Evening",
  dinner: "Dinner",
};

export function DietPlanSystem({ plan }: { plan: DietSystem }) {
  const recipeMeals = plan.today.meals.filter((meal) => meal.slot === "lunch" || meal.slot === "evening" || meal.slot === "dinner");

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_560px] xl:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Fixed fat-loss fuel system</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Eat the same structure, not the same boring food.</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {plan.profile.pace}
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-muted">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>{plan.profile.safetyNote}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
            <Metric label="Current" value={`${plan.profile.currentWeightKg}kg`} />
            <Metric label="Target date" value={formatTargetDate(plan.profile.targetDate)} />
            <Metric label="Need to lose" value={`${plan.profile.kgToLose}kg`} />
            <Metric label="Need / week" value={`${plan.profile.requiredWeeklyLossKg}kg`} />
            <Metric label="Protein" value={plan.profile.protein} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {plan.nutritionProtocol.dailyTargets.map((target) => (
          <article key={target.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-muted">{target.label}</div>
            <div className="mt-2 text-xl font-semibold">{target.value}</div>
            <div className="mt-2 text-xs leading-5 text-muted">{target.rule}</div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-accent" />
          <h2 className="text-lg font-semibold">Today: {plan.today.day}</h2>
        </div>
        <div className="mt-1 text-sm text-muted">{plan.today.label} · {plan.today.trainingFocus}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plan.today.meals.map((meal) => (
            <MealCard key={meal.slot} meal={meal} compact />
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ShoppingBasket size={18} className="text-warning" />
          <h2 className="text-lg font-semibold">Buy/prep for {plan.tomorrow.day}</h2>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plan.tomorrowPrepSections.map((section) => (
            <div key={section.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{section.title}</div>
                  <div className="mt-1 text-xs text-muted">{section.mealTitle}</div>
                </div>
                <span className="rounded-lg border bg-card px-2 py-1 text-xs text-muted">
                  {section.buyItems.length + section.prepTasks.length}
                </span>
              </div>
              <PrepGroup label="Buy" items={section.buyItems} />
              <PrepGroup label="Prep" items={section.prepTasks} />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Non-negotiable rules</h2>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {plan.rules.map((rule) => (
              <div key={rule} className="rounded-lg border bg-background px-3 py-2 text-sm text-muted">{rule}</div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Real-life fallbacks</h2>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {plan.realLifeRules.slice(0, 4).map((rule) => (
              <div key={rule.scenario} className="rounded-lg border bg-background px-3 py-2">
                <div className="text-sm font-medium">{rule.scenario}</div>
                <div className="mt-1 text-xs leading-5 text-muted">{rule.action}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-accent" />
          <h2 className="text-lg font-semibold">Daily meal timing</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plan.nutritionProtocol.mealTiming.map((item) => (
            <article key={`${item.time}-${item.meal}`} className="rounded-lg border bg-background p-3">
              <div className="text-xs uppercase tracking-wider text-muted">{item.time}</div>
              <div className="mt-1 font-medium">{item.meal}</div>
              <div className="mt-2 text-sm leading-6 text-muted">{item.focus}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ChefHat size={18} className="text-accent" />
          <h2 className="text-lg font-semibold">Recipes for today</h2>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {recipeMeals.map((meal) => (
            <MealCard key={meal.slot} meal={meal} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <article className="min-w-0 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Weekly rotation</h2>
          <div className="mt-4 max-w-full overflow-x-auto">
            <div className="min-w-[860px] divide-y rounded-lg border">
              {plan.week.map((day) => (
                <div key={day.day} className={cn("grid grid-cols-[110px_1fr_1fr_1fr_1fr] gap-3 px-3 py-3 text-sm", day.day === plan.today.day && "bg-background")}>
                  <div className="font-medium">{day.day}</div>
                  <div>
                    <div className="text-xs text-muted">Training</div>
                    <div>{day.trainingFocus}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Lunch</div>
                    <div>{day.lunchProtein} salad</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Evening</div>
                    <div>{day.eveningSnack}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Dinner</div>
                    <div>{day.dinner}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-warning" />
            <h2 className="text-lg font-semibold">Milestones and adjustment</h2>
          </div>
          <div className="mt-3 space-y-2">
            {[...plan.nutritionProtocol.milestoneRules, ...plan.nutritionProtocol.adjustmentRules].map((rule) => (
              <div key={rule} className="rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-muted">{rule}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-card p-4 shadow-sm xl:col-span-2">
          <div className="flex items-center gap-2">
            <Utensils size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Recovery nutrition</h2>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {plan.recoveryNutrition.map((item) => (
              <div key={item.label} className="rounded-lg border bg-background p-3">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="mt-1 text-lg font-semibold">{item.target}</div>
                <div className="mt-2 text-xs leading-5 text-muted">{item.rule}</div>
              </div>
            ))}
          </div>
        </article>

        {plan.swapBank.map((swap) => (
          <article key={swap.category} className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="font-semibold">{swap.category}</h3>
            <div className="mt-3 space-y-2">
              {swap.options.map((option) => (
                <div key={option} className="rounded-lg border bg-background px-3 py-2 text-sm text-muted">{option}</div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function formatTargetDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function PrepGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-lg border bg-card px-2 py-1 text-xs text-muted">{item}</span>
        ))}
      </div>
    </div>
  );
}

function MealCard({ meal, compact = false }: { meal: DietMeal; compact?: boolean }) {
  return (
    <article className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">{slotLabels[meal.slot]} · {meal.timing}</div>
          <div className="mt-1 font-semibold">{meal.title}</div>
          <div className="mt-1 text-sm text-muted">{meal.target}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border bg-card px-2 py-2">
          <div className="text-muted">Calories</div>
          <div className="mt-1 font-medium">{meal.calories}</div>
        </div>
        <div className="rounded-lg border bg-card px-2 py-2">
          <div className="text-muted">Protein</div>
          <div className="mt-1 font-medium">{meal.protein}</div>
        </div>
      </div>
      <div className="mt-2 rounded-lg border bg-card px-2 py-2 text-xs leading-5 text-muted">{meal.formula}</div>
      {!compact ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Ingredients</div>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {meal.ingredients.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">Steps</div>
            <ol className="mt-2 space-y-1 text-sm text-muted">
              {meal.recipe.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
            </ol>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted">{meal.notes[0]}</div>
      )}
    </article>
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
