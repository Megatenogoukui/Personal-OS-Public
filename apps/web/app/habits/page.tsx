import { AppShell } from "@/components/AppShell";
import { HabitsTracker } from "@/components/HabitsTracker";

export const dynamic = "force-dynamic";

export default function HabitsPage() {
  return (
    <AppShell>
      <HabitsTracker />
    </AppShell>
  );
}
