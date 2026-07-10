import { AppShell } from "@/components/AppShell";
import { WorkDashboard } from "@/components/WorkDashboard";
import { readStore } from "@/lib/server/local-store";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const store = await readStore();
  return (
    <AppShell>
      <WorkDashboard identity={store.profile.workIdentity} />
    </AppShell>
  );
}
