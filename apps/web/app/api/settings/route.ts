import { NextResponse } from "next/server";
import type { DietSystem, FitnessSystem, PersonalOSProfile } from "@personal-os/core";
import { getStoreInfo, readStore, writeStore } from "@/lib/server/local-store";

type SettingsAction = "update_profile" | "update_diet_plan" | "update_fitness_plan";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    profile: store.profile,
    dietConfigured: Boolean(store.dietPlan),
    fitnessConfigured: Boolean(store.fitnessPlan),
    storage: getStoreInfo(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: SettingsAction; payload?: unknown };
  const store = await readStore();

  try {
    if (body.action === "update_profile") {
      const profile = profileFrom(body.payload, store.profile);
      await writeStore({ ...store, profile });
      return NextResponse.json({ profile });
    }

    if (body.action === "update_diet_plan") {
      const dietPlan = planFrom<DietSystem>(body.payload, "diet");
      await writeStore({ ...store, dietPlan });
      return NextResponse.json({ dietPlan });
    }

    if (body.action === "update_fitness_plan") {
      const fitnessPlan = planFrom<FitnessSystem>(body.payload, "fitness");
      await writeStore({ ...store, fitnessPlan });
      return NextResponse.json({ fitnessPlan });
    }

    return NextResponse.json({ message: "Unknown settings action." }, { status: 400 });
  } catch (caught) {
    return NextResponse.json({ message: caught instanceof Error ? caught.message : "Could not save settings." }, { status: 400 });
  }
}

function profileFrom(value: unknown, current: PersonalOSProfile): PersonalOSProfile {
  const input = objectValue(value);
  const displayName = text(input.displayName);
  return {
    displayName,
    workIdentity: text(input.workIdentity),
    timezone: text(input.timezone) || current.timezone || "UTC",
    currency: (text(input.currency) || current.currency || "USD").toUpperCase().slice(0, 3),
    configured: Boolean(displayName),
  };
}

function planFrom<T extends DietSystem | FitnessSystem>(value: unknown, label: string): T {
  const plan = objectValue(value) as Partial<T>;
  if (!Array.isArray(plan.week) || plan.week.length === 0 || !plan.profile) {
    throw new Error(`The ${label} plan must include profile and a non-empty week array.`);
  }
  return plan as T;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
