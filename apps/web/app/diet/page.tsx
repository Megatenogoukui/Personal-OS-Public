import { AppShell } from "@/components/AppShell";
import { DietFlexTracker } from "@/components/DietFlexTracker";
import { DietPlanSystem } from "@/components/DietPlanSystem";
import { readStore } from "@/lib/server/local-store";
import { buildDietSystem } from "@personal-os/core";

export const dynamic = "force-dynamic";

export default async function DietPage() {
  const store = await readStore();
  const plan = buildDietSystem(new Date(), store.dietPlan);
  return (
    <AppShell>
      <div className="space-y-5">
        <DietFlexTracker initialPlan={plan} />
        <DietPlanSystem plan={plan} />
      </div>
    </AppShell>
  );
}
