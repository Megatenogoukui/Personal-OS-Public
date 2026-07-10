import { AppShell } from "@/components/AppShell";
import { HomeCommandCenter } from "@/components/HomeCommandCenter";
import { readStore } from "@/lib/server/local-store";
import { buildCommandCenter } from "@personal-os/core";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await readStore();
  const center = buildCommandCenter(store);

  return (
    <AppShell>
      <HomeCommandCenter center={center} />
    </AppShell>
  );
}
