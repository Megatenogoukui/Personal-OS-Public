import { AppShell } from "@/components/AppShell";
import { PlannerBoard } from "@/components/PlannerBoard";
import { readStore } from "@/lib/server/local-store";
import { buildCommandCenter } from "@personal-os/core";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const store = await readStore();
  const center = buildCommandCenter(store);

  return (
    <AppShell>
      <PlannerBoard center={center} />
    </AppShell>
  );
}
