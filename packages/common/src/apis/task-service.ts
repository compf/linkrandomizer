import { unsupported } from "./abstract-service.js";
import type { TaskCompletions } from "../models/weekly-tasks.js";

export const TaskServiceSchema = {
  sendToBackend: {},

  invokeFromBackend: {
    loadTaskCompletions: (): Promise<TaskCompletions> => unsupported() as never,
    saveTaskCompletions: (
      data: TaskCompletions,
    ): Promise<{ ok: true } | { ok: false; error: string }> => unsupported() as never,
  },

  eventFromBackend: {},
};

export type TaskService = typeof TaskServiceSchema;
