export type TrainingExercise = {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
};

export type TrainingDay = {
  day: string;
  title: string;
  type: "strength" | "conditioning" | "recovery" | "rest";
  focus: string;
  duration: string;
  intensity: string;
  stepsTarget: string;
  cardio: string;
  exercises: TrainingExercise[];
  warmup: string[];
  cooldown: string[];
  recoveryRule: string;
};

export type FitnessSystem = {
  profile: {
    configured?: boolean;
    goal: string;
    split: string;
    sessionLength: string;
    fatLossPriority: string;
  };
  today: TrainingDay;
  tomorrow: TrainingDay;
  week: TrainingDay[];
  steps: {
    currentTarget: number;
    progression: Array<{ week: string; target: string; rule: string }>;
    dailyRules: string[];
  };
  progression: {
    strengthRules: string[];
    cardioRules: string[];
    deloadRules: string[];
  };
  recovery: Array<{ label: string; target: string; rule: string }>;
  resetRules: string[];
  appleHealth: {
    status: "planned";
    bestPath: string;
    options: Array<{ label: string; description: string; effort: "low" | "medium" | "high" }>;
    dataToRead: string[];
  };
};

const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildFitnessSystem(now = new Date(), storedPlan?: FitnessSystem): FitnessSystem {
  const plan = storedPlan ?? starterFitnessSystem();
  const todayName = dayOrder[now.getDay()]!;
  const tomorrowName = dayOrder[(now.getDay() + 1) % 7]!;
  return {
    ...plan,
    today: plan.week.find((day) => day.day === todayName) ?? plan.week[0]!,
    tomorrow: plan.week.find((day) => day.day === tomorrowName) ?? plan.week[1] ?? plan.week[0]!,
  };
}

function starterFitnessSystem(): FitnessSystem {
  const week = dayOrder.map((day) => starterDay(day));
  return {
    profile: {
      configured: false,
      goal: "Configure your training goal and weekly schedule in Settings.",
      split: "No split configured",
      sessionLength: "Set duration",
      fatLossPriority: "Choose the activity and progression strategy that fits your goal.",
    },
    today: week[0]!,
    tomorrow: week[1]!,
    week,
    steps: {
      currentTarget: 0,
      progression: [{ week: "Starting point", target: "Set a daily target", rule: "Use a baseline you can recover from and increase gradually." }],
      dailyRules: ["Configure a daily movement target that fits your schedule and recovery."],
    },
    progression: {
      strengthRules: [
        "Log every working set so the next session can compare load, reps, and volume.",
        "Increase one variable at a time while technique remains consistent.",
      ],
      cardioRules: ["Increase duration or frequency gradually and monitor recovery."],
      deloadRules: ["Reduce training stress when performance, sleep, or soreness consistently worsens."],
    },
    recovery: [
      { label: "Sleep", target: "Set target", rule: "Choose a repeatable sleep window." },
      { label: "Recovery", target: "Monitor", rule: "Use energy, soreness, and performance to adjust training stress." },
    ],
    resetRules: ["When a workout is missed, record it and deliberately reschedule or skip it based on recovery and the next session."],
    appleHealth: {
      status: "planned",
      bestPath: "Apple Health data can be imported from an export, while automatic sync requires an iOS companion using HealthKit permissions.",
      options: [
        { label: "Health export", description: "Upload an Apple Health export for periodic imports.", effort: "low" },
        { label: "iOS companion", description: "Use a HealthKit-enabled companion app for automatic sync.", effort: "high" },
      ],
      dataToRead: ["Steps", "Workouts", "Weight", "Sleep", "Active energy"],
    },
  };
}

function starterDay(day: string): TrainingDay {
  return {
    day,
    title: "Plan not configured",
    type: day === "Sunday" ? "rest" : "recovery",
    focus: "Add your exercises and training focus in Settings.",
    duration: "Set duration",
    intensity: "Set intensity",
    stepsTarget: "Set target",
    cardio: "Optional",
    exercises: [],
    warmup: ["Add your warm-up sequence"],
    cooldown: ["Add your cool-down sequence"],
    recoveryRule: "Configure a recovery rule for this day.",
  };
}
