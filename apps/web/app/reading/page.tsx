import { AppShell } from "@/components/AppShell";
import { ReadingTracker } from "@/components/ReadingTracker";

export const dynamic = "force-dynamic";

export default function ReadingPage() {
  return (
    <AppShell>
      <ReadingTracker />
    </AppShell>
  );
}
