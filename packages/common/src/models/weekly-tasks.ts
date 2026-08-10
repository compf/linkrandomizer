import { hashString } from "../ranker/ranker-utils.js";
import { Category, TaskData, TaskEntry, tasks as catalogTasks } from "./data/tasks.js";

/** How many activities to propose each week. Must be > 2. */
export const WEEKLY_PROPOSAL_COUNT = 5;

/** Static seed so the same catalog + week always yields the same proposals. */
export const WEEKLY_TASK_SEED = 0x71a5c0de;

export type TaskCompletion = {
  year: number;
  weekOfYear: number;
};

export type TaskCompletions = Record<string, TaskCompletion>;

export type ProposedTask = {
  name: string;
  category: Category;
  checked: boolean;
  year?: number;
  weekOfYear?: number;
};

export type IsoWeek = {
  year: number;
  weekOfYear: number;
};

export const weekStorageKey = (year: number, weekOfYear: number): string =>
  `${year}-W${String(weekOfYear).padStart(2, "0")}`;

/** ISO week date (year + week number, Monday-based). */
export const getIsoWeek = (date = new Date()): IsoWeek => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekOfYear = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: utc.getUTCFullYear(), weekOfYear };
};

export const weeksBetween = (
  fromYear: number,
  fromWeek: number,
  toYear: number,
  toWeek: number,
): number => (toYear - fromYear) * 52 + (toWeek - fromWeek);

export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), state | 1) + Math.imul(state ^ (state >>> 7), state | 61)) >>> 0;
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
};

export const mergeTaskCompletions = (
  catalog: TaskData,
  completions: TaskCompletions,
): TaskData => {
  const merged: TaskData["tasks"] = {};
  for (const [name, entry] of Object.entries(catalog.tasks)) {
    const overlay = completions[name];
    merged[name] = overlay
      ? { ...entry, year: overlay.year, weekOfYear: overlay.weekOfYear }
      : { ...entry };
  }
  return { tasks: merged };
};

/**
 * Recent completions get a much lower weight. Completions in the same week
 * (or "in the future") are ignored so checking off this week's proposals
 * does not reshuffle them on relaunch.
 */
export const taskWeight = (
  entry: TaskEntry,
  targetYear: number,
  targetWeek: number,
): number => {
  if (entry.year === undefined || entry.weekOfYear === undefined) {
    return 1;
  }
  const ago = weeksBetween(entry.year, entry.weekOfYear, targetYear, targetWeek);
  if (ago <= 0) {
    return 1;
  }
  if (ago <= 2) {
    return 0.02;
  }
  if (ago <= 6) {
    return 0.1;
  }
  if (ago <= 12) {
    return 0.35;
  }
  return 1;
};

const weightedIndex = (weights: number[], rng: () => number): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return Math.floor(rng() * weights.length);
  }
  let remaining = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    remaining -= weights[i];
    if (remaining <= 0) {
      return i;
    }
  }
  return weights.length - 1;
};

type NamedTask = { name: string; entry: TaskEntry };

const pickFromPool = (pool: NamedTask[], targetYear: number, targetWeek: number, rng: () => number): number => {
  const weights = pool.map(({ entry }) => taskWeight(entry, targetYear, targetWeek));
  return weightedIndex(weights, rng);
};

/**
 * Propose WEEKLY_PROPOSAL_COUNT tasks for a week.
 * Deterministic for a fixed catalog + seed + year/week.
 * Guarantees at least two unique categories when the catalog allows it.
 */
export const proposeWeeklyTasks = (
  taskData: TaskData,
  year: number,
  weekOfYear: number,
  count: number = WEEKLY_PROPOSAL_COUNT,
): ProposedTask[] => {
  const names = Object.keys(taskData.tasks).sort();
  if (names.length === 0 || count <= 0) {
    return [];
  }

  const seed = hashString(`${WEEKLY_TASK_SEED}:${year}:W${weekOfYear}:${names.join("|")}`);
  const rng = createSeededRandom(seed);
  const remaining: NamedTask[] = names.map((name) => ({ name, entry: taskData.tasks[name] }));
  const selected: NamedTask[] = [];
  const targetCount = Math.min(count, remaining.length);

  while (selected.length < targetCount && remaining.length > 0) {
    let pool = remaining;
    if (selected.length === 1) {
      const firstCategory = selected[0].entry.category;
      const otherCategory = remaining.filter(({ entry }) => entry.category !== firstCategory);
      if (otherCategory.length > 0) {
        pool = otherCategory;
      }
    }

    const indexInPool = pickFromPool(pool, year, weekOfYear, rng);
    const picked = pool[indexInPool];
    const indexInRemaining = remaining.findIndex((item) => item.name === picked.name);
    selected.push(picked);
    remaining.splice(indexInRemaining, 1);
  }

  return selected.map(({ name, entry }) => ({
    name,
    category: entry.category,
    checked: entry.year === year && entry.weekOfYear === weekOfYear,
    year: entry.year,
    weekOfYear: entry.weekOfYear,
  }));
};

export const setTaskChecked = (
  completions: TaskCompletions,
  taskName: string,
  year: number,
  weekOfYear: number,
  checked: boolean,
): TaskCompletions => {
  const next = { ...completions };
  if (checked) {
    next[taskName] = { year, weekOfYear };
  } else if (next[taskName]?.year === year && next[taskName]?.weekOfYear === weekOfYear) {
    delete next[taskName];
  }
  return next;
};

export const getTaskCatalog = (): TaskData => catalogTasks;

export const buildWeeklyProposals = (
  completions: TaskCompletions,
  year: number,
  weekOfYear: number,
): ProposedTask[] => {
  const merged = mergeTaskCompletions(getTaskCatalog(), completions);
  return proposeWeeklyTasks(merged, year, weekOfYear);
};
