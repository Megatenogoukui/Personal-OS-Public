import { AppShell } from "@/components/AppShell";
import { FitnessPlanSystem } from "@/components/FitnessPlanSystem";
import { WorkoutProgressTracker } from "@/components/WorkoutProgressTracker";
import { readStore } from "@/lib/server/local-store";
import { buildFitnessSystem } from "@personal-os/core";

export const dynamic = "force-dynamic";

export default async function WorkoutPage() {
  const store = await readStore();
  const fitness = buildFitnessSystem(new Date(), store.fitnessPlan);
  return (
    <AppShell>
      <div className="space-y-5">
        <WorkoutProgressTracker initialFitness={fitness} />
        <FitnessPlanSystem fitness={fitness} />
      </div>
    </AppShell>
  );
}
