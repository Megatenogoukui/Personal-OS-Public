export type DietMealSlot = "pre_gym" | "post_gym" | "breakfast" | "lunch" | "evening" | "dinner";

export type DietMeal = {
  slot: DietMealSlot;
  title: string;
  timing: string;
  target: string;
  calories: string;
  protein: string;
  formula: string;
  ingredients: string[];
  buyItems: string[];
  prepTasks: string[];
  recipe: string[];
  notes: string[];
  swaps: string[];
};

export type DietDay = {
  day: string;
  label: string;
  trainingFocus: string;
  lunchProtein: string;
  eveningSnack: string;
  dinner: string;
  meals: DietMeal[];
  prepForNextDay: string[];
};

export type DietPrepSection = {
  id: DietMealSlot | "staples";
  title: string;
  mealTitle: string;
  buyItems: string[];
  prepTasks: string[];
};

export type DietSystem = {
  profile: {
    configured?: boolean;
    currentWeightKg: number;
    targetWeightKg: number;
    checkpointWeightKg: number;
    heightCm: number;
    targetDate: string;
    kgToLose: number;
    weeksToTarget: number;
    requiredWeeklyLossKg: number;
    practicalTargetDate: string;
    aggressiveCheckpointDate: string;
    calories: string;
    protein: string;
    water: string;
    pace: string;
    safetyNote: string;
  };
  nutritionProtocol: {
    dailyTargets: Array<{ label: string; value: string; rule: string }>;
    mealTiming: Array<{ time: string; meal: string; focus: string }>;
    milestoneRules: string[];
    adjustmentRules: string[];
  };
  recoveryNutrition: Array<{ label: string; target: string; rule: string }>;
  rules: string[];
  realLifeRules: Array<{ scenario: string; action: string; nextStep: string }>;
  today: DietDay;
  tomorrow: DietDay;
  week: DietDay[];
  tomorrowShoppingList: string[];
  tomorrowPrepSections: DietPrepSection[];
  swapBank: Array<{ category: string; options: string[] }>;
};

const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildDietSystem(now = new Date(), storedPlan?: DietSystem): DietSystem {
  return selectCurrentDays(storedPlan ?? starterDietSystem(), now);
}

function selectCurrentDays(plan: DietSystem, now: Date): DietSystem {
  const todayName = dayOrder[now.getDay()]!;
  const tomorrowName = dayOrder[(now.getDay() + 1) % 7]!;
  const today = plan.week.find((day) => day.day === todayName) ?? plan.week[0]!;
  const tomorrow = plan.week.find((day) => day.day === tomorrowName) ?? plan.week[1] ?? today;
  const tomorrowPrepSections = buildPrepSections(tomorrow);
  return {
    ...plan,
    today,
    tomorrow,
    tomorrowPrepSections,
    tomorrowShoppingList: dedupe(tomorrowPrepSections.flatMap((section) => section.buyItems)),
  };
}

function starterDietSystem(): DietSystem {
  const week = dayOrder.map((day) => starterDay(day));
  return {
    profile: {
      configured: false,
      currentWeightKg: 0,
      targetWeightKg: 0,
      checkpointWeightKg: 0,
      heightCm: 0,
      targetDate: "",
      kgToLose: 0,
      weeksToTarget: 0,
      requiredWeeklyLossKg: 0,
      practicalTargetDate: "",
      aggressiveCheckpointDate: "",
      calories: "Set your daily calorie range",
      protein: "Set your daily protein target",
      water: "Set your hydration target",
      pace: "Configure your nutrition profile and weekly meal structure in Settings.",
      safetyNote: "Use sustainable targets and consult a qualified clinician or dietitian for medical nutrition needs.",
    },
    nutritionProtocol: {
      dailyTargets: [
        { label: "Calories", value: "Not configured", rule: "Choose a sustainable target based on your goal and activity." },
        { label: "Protein", value: "Not configured", rule: "Set a target that fits your diet and training." },
        { label: "Fiber", value: "Not configured", rule: "Build meals around vegetables, fruit, legumes, and whole grains." },
        { label: "Water", value: "Not configured", rule: "Set a practical daily hydration target." },
      ],
      mealTiming: starterMeals().map((meal) => ({ time: meal.timing, meal: meal.title, focus: meal.target })),
      milestoneRules: ["Set one measurable checkpoint and review it using weekly averages."],
      adjustmentRules: ["Change one variable at a time after at least two consistent weeks of data."],
    },
    recoveryNutrition: [
      { label: "Consistency", target: "Build your baseline", rule: "Log honestly before making the plan stricter." },
      { label: "Recovery", target: "Protect sleep and energy", rule: "Avoid aggressive changes when recovery is poor." },
    ],
    rules: [
      "Configure meals that fit your routine and food preferences.",
      "Use planned alternatives for travel, social events, and missed preparation.",
      "Return to the next planned meal after an unplanned choice.",
    ],
    realLifeRules: [
      { scenario: "Preparation failed", action: "Choose the closest balanced meal available.", nextStep: "Prepare the next meal instead of abandoning the day." },
      { scenario: "Eating outside", action: "Choose a portion you can log honestly.", nextStep: "Resume the normal structure at the next meal." },
    ],
    today: week[0]!,
    tomorrow: week[1]!,
    week,
    tomorrowShoppingList: [],
    tomorrowPrepSections: [],
    swapBank: [
      { category: "Meal alternatives", options: ["Add your preferred equivalent meals in Settings"] },
      { category: "Emergency options", options: ["Keep one shelf-stable or easy backup meal available"] },
    ],
  };
}

function starterDay(day: string): DietDay {
  const meals = starterMeals();
  return {
    day,
    label: "Flexible meal structure",
    trainingFocus: "Use your configured activity plan",
    lunchProtein: "Your planned",
    eveningSnack: "Your planned snack",
    dinner: "Your planned dinner",
    meals,
    prepForNextDay: dedupe(meals.flatMap((meal) => [...meal.buyItems, ...meal.prepTasks])),
  };
}

function starterMeals(): DietMeal[] {
  return [
    starterMeal("pre_gym", "Pre-training hydration", "Before training", "Hydrate for the session"),
    starterMeal("post_gym", "Post-training meal", "After training", "Plan recovery nutrition"),
    starterMeal("breakfast", "Breakfast", "Morning", "Choose a meal that fits your target"),
    starterMeal("lunch", "Lunch", "Midday", "Build a balanced, repeatable meal"),
    starterMeal("evening", "Planned snack", "Evening", "Prevent random grazing with a planned option"),
    starterMeal("dinner", "Dinner", "Night", "Use a portion and meal you can sustain"),
  ];
}

function starterMeal(slot: DietMealSlot, title: string, timing: string, target: string): DietMeal {
  return {
    slot,
    title,
    timing,
    target,
    calories: "Set target",
    protein: "Set target",
    formula: "Configure this meal in Settings",
    ingredients: ["Add ingredients"],
    buyItems: [],
    prepTasks: ["Add preparation steps for this meal."],
    recipe: ["Configure the meal and portion that fit your routine."],
    notes: ["This starter slot is intentionally flexible."],
    swaps: ["Add an equivalent alternative"],
  };
}

function buildPrepSections(day: DietDay): DietPrepSection[] {
  return day.meals
    .filter((meal) => meal.buyItems.length > 0 || meal.prepTasks.length > 0)
    .map((meal) => ({
      id: meal.slot,
      title: titleForSlot(meal.slot),
      mealTitle: meal.title,
      buyItems: dedupe(meal.buyItems),
      prepTasks: dedupe(meal.prepTasks),
    }));
}

function titleForSlot(slot: DietMealSlot) {
  return ({
    pre_gym: "Before training",
    post_gym: "After training",
    breakfast: "Breakfast",
    lunch: "Lunch",
    evening: "Evening snack",
    dinner: "Dinner",
  } satisfies Record<DietMealSlot, string>)[slot];
}

function dedupe(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}
