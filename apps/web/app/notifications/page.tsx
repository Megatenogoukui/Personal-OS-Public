import { AppShell } from "@/components/AppShell";
import { AttentionQueue } from "@/components/AttentionQueue";
import { readStore } from "@/lib/server/local-store";
import { buildOperatingSnapshot } from "@personal-os/core";

export default async function NotificationsPage() {
  const store = await readStore();
  const snapshot = buildOperatingSnapshot(store.workTasks, store.manualRecords, store.profile.workIdentity);
  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-xs uppercase tracking-widest text-muted">Alerts</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Notifications</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{snapshot.nextAction}</p>
        </section>
        <AttentionQueue items={snapshot.attention.filter((item) => item.severity === "critical" || item.severity === "high").slice(0, 10)} title="Active alerts" empty="No critical or high alerts right now." />
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Notification history</h2>
          {store.notifications.length === 0 ? <div className="py-12 text-center text-sm text-muted">No notifications yet.</div> : null}
          <div className="mt-3 divide-y">
            {store.notifications.map((note) => (
              <article key={note.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{note.title}</div>
                  <span className="rounded-lg border bg-background px-2 py-1 text-xs capitalize text-muted">{note.priority}</span>
                </div>
                <div className="mt-1 text-sm text-muted">{note.body}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
