import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { TaskCompletions, TaskService } from "@linkrandomizer/common";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_COMPLETIONS_PATH = path.resolve(
  __dirname,
  "../../../common/src/models/data/task-completions.json",
);

const readCompletions = (): TaskCompletions => {
  try {
    if (!fs.existsSync(TASK_COMPLETIONS_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(TASK_COMPLETIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as TaskCompletions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to load task completions:", error);
    return {};
  }
};

const writeCompletions = (data: TaskCompletions): void => {
  fs.mkdirSync(path.dirname(TASK_COMPLETIONS_PATH), { recursive: true });
  fs.writeFileSync(TASK_COMPLETIONS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
};

export const TaskHandler: TaskService = {
  sendToBackend: {},
  invokeFromBackend: {
    loadTaskCompletions: async (): Promise<TaskCompletions> => readCompletions(),
    saveTaskCompletions: async (
      data: TaskCompletions,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        writeCompletions(data ?? {});
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      }
    },
  },
  eventFromBackend: {},
};
