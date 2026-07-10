"use client";

import { CheckCircle2, Database, Download, Save, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { DietSystem, FitnessSystem, PersonalOSProfile } from "@personal-os/core";

type Props = {
  initialProfile: PersonalOSProfile;
  initialDietPlan: DietSystem;
  initialFitnessPlan: FitnessSystem;
  storage: { driver: string; key: string; database?: string; collection?: string };
};

const inputClass = "mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10";
const panelClass = "rounded-lg border bg-card p-5 shadow-sm";

export function SettingsClient({ initialProfile, initialDietPlan, initialFitnessPlan, storage }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [dietJson, setDietJson] = useState(() => JSON.stringify(initialDietPlan, null, 2));
  const [fitnessJson, setFitnessJson] = useState(() => JSON.stringify(initialFitnessPlan, null, 2));
  const [status, setStatus] = useState("Settings are stored privately in your configured database.");
  const [saving, setSaving] = useState(false);

  async function save(action: "update_profile" | "update_diet_plan" | "update_fitness_plan", payload: unknown, success: string) {
    setSaving(true);
    setStatus("Saving...");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not save settings.");
      setStatus(success);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  function savePlan(kind: "diet" | "fitness") {
    try {
      const payload = JSON.parse(kind === "diet" ? dietJson : fitnessJson) as unknown;
      void save(kind === "diet" ? "update_diet_plan" : "update_fitness_plan", payload, `${kind === "diet" ? "Diet" : "Training"} plan saved.`);
    } catch {
      setStatus(`${kind === "diet" ? "Diet" : "Training"} plan JSON is invalid.`);
    }
  }

  return (
    <div className="space-y-5">
      <section className={panelClass}>
        <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Configuration</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Make Personal OS yours.</h1>
            <p className="mt-2 text-sm leading-6 text-muted">Identity, plans, and records live in your database. The repository contains no personal defaults.</p>
          </div>
          <div className="rounded-lg border bg-background px-4 py-3 text-sm leading-6 text-muted">{status}</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <form
          className={panelClass}
          onSubmit={(event) => {
            event.preventDefault();
            void save("update_profile", profile, "Profile saved.");
          }}
        >
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Display name" value={profile.displayName} placeholder="Your name" onChange={(displayName) => setProfile({ ...profile, displayName })} />
            <Field label="Work identity" value={profile.workIdentity} placeholder="Name or email used in task exports" onChange={(workIdentity) => setProfile({ ...profile, workIdentity })} />
            <Field label="Timezone" value={profile.timezone} placeholder="Asia/Kolkata" onChange={(timezone) => setProfile({ ...profile, timezone })} />
            <Field label="Currency" value={profile.currency} placeholder="INR" onChange={(currency) => setProfile({ ...profile, currency })} />
          </div>
          <button disabled={saving} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
            <Save size={16} /> Save profile
          </button>
        </form>

        <article className={panelClass}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-success" />
            <h2 className="text-lg font-semibold">Data ownership</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
            <StatusLine label="Profile" ready={profile.configured} />
            <StatusLine label="Diet plan" ready={initialDietPlan.profile.configured !== false} />
            <StatusLine label="Training plan" ready={initialFitnessPlan.profile.configured !== false} />
            <StatusLine label={`Persistence: ${storage.driver}`} ready={storage.driver === "mongodb"} />
          </div>
          <a href="/api/settings/export" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition hover:border-accent/50 hover:text-accent">
            <Download size={16} /> Export private backup
          </a>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PlanEditor title="Diet plan" value={dietJson} onChange={setDietJson} onSave={() => savePlan("diet")} saving={saving} />
        <PlanEditor title="Training plan" value={fitnessJson} onChange={setFitnessJson} onSave={() => savePlan("fitness")} saving={saving} />
      </section>

      <section className={panelClass}>
        <div className="flex items-center gap-2">
          <Database size={18} className="text-accent" />
          <h2 className="text-lg font-semibold">Deployment checklist</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["Set MONGODB_URI", `Verify store key: ${storage.key}`, "Set access password", "Create an export backup"].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-3 text-sm"><CheckCircle2 size={16} className="text-success" />{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input className={inputClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function StatusLine({ label, ready }: { label: string; ready: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"><span>{label}</span><span className={ready ? "text-success" : "text-warning"}>{ready ? "Ready" : "Needs setup"}</span></div>;
}

function PlanEditor({ title, value, onChange, onSave, saving }: { title: string; value: string; onChange: (value: string) => void; onSave: () => void; saving: boolean }) {
  return (
    <details className={panelClass}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-lg font-semibold"><SlidersHorizontal size={18} className="text-accent" />{title}</span>
        <span className="text-xs text-muted">Advanced JSON editor</span>
      </summary>
      <p className="mt-3 text-sm leading-6 text-muted">Edit the structured plan carefully. Export a backup before large changes.</p>
      <textarea className="mt-4 min-h-80 w-full rounded-lg border bg-background p-3 font-mono text-xs leading-5 outline-none focus:border-accent" value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
      <button type="button" disabled={saving} onClick={onSave} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />Save {title.toLowerCase()}</button>
    </details>
  );
}
