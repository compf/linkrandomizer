import type { TaskCompletions, TaskService } from "@linkrandomizer/common";

const STORAGE_KEY = "linkrandomizer.taskCompletions";

const readLocal = (): TaskCompletions => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as TaskCompletions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const FrontendTaskHandler: TaskService = {
  sendToBackend: {},
  invokeFromBackend: {
    loadTaskCompletions: async (): Promise<TaskCompletions> => readLocal(),
    saveTaskCompletions: async (
      data: TaskCompletions,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data ?? {}));
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message };
      }
    },
  },
  eventFromBackend: {},
};
