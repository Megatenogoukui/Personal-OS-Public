import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyPlan, calculateWorkPriorityScore, deadlineBand, enrichWorkTasks, normalizeExternalTask } from "../src/index";

test("scores overdue and missing FE/BE work as critical", () => {
  const now = new Date("2026-07-05T10:00:00.000Z");
  const score = calculateWorkPriorityScore(
    {
      id: "x",
      externalId: "x",
      title: "Urgent",
      status: "todo",
      priority: "high",
      deadline: "2026-07-04T10:00:00.000Z",
      assignedTo: ["Alex"],
      feAssignee: null,
      beAssignee: null,
    },
    "alex",
    now,
  );
  assert.equal(score >= 220, true);
});

test("deadline bands are deterministic", () => {
  const now = new Date("2026-07-05T10:00:00.000Z");
  assert.equal(deadlineBand("2026-07-05T20:00:00.000Z", now), "critical");
  assert.equal(deadlineBand("2026-07-07T09:00:00.000Z", now), "high");
  assert.equal(deadlineBand("2026-07-11T09:00:00.000Z", now), "upcoming");
});

test("normalizes unknown external task objects", () => {
  const task = normalizeExternalTask({
    request_id: "REQ-1",
    request_title: "Build sync",
    dueDate: "2026-07-08",
    backend_assignee: "Dev",
  });
  assert.equal(task.externalId, "REQ-1");
  assert.equal(task.title, "Build sync");
  assert.equal(task.beAssignee, "Dev");
});

test("daily planner puts critical work first", () => {
  const now = new Date("2026-07-05T10:00:00.000Z");
  const tasks = enrichWorkTasks([
    {
      id: "x",
      externalId: "x",
      title: "Assign FE/BE",
      status: "todo",
      priority: "critical",
      deadline: "2026-07-05T20:00:00.000Z",
      assignedTo: ["Alex"],
      feAssignee: null,
      beAssignee: null,
    },
  ]);
  const plan = buildDailyPlan(tasks, [], "Alex", now);
  assert.equal(plan.items[0]?.area, "work");
  assert.match(plan.focus, /Assign FE\/BE/);
});
