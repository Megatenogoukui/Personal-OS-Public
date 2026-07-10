import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import { getStoreInfo, readStore } from "@/lib/server/local-store";
import { buildDietSystem, buildFitnessSystem } from "@personal-os/core";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const store = await readStore();
  return (
    <AppShell>
      <SettingsClient
        initialProfile={store.profile}
        initialDietPlan={buildDietSystem(new Date(), store.dietPlan)}
        initialFitnessPlan={buildFitnessSystem(new Date(), store.fitnessPlan)}
        storage={getStoreInfo()}
      />
    </AppShell>
  );
}
