import fs from "node:fs";
import path from "node:path";

export interface Task {
  id: number;
  content: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: number;
  completedAt?: number;
  result?: string;
}

export interface TaskStore {
  tasks: Task[];
  nextId: number;
}

const TASKS_FILE = "tasks.json";

/**
 * Simple Promise-based mutex for serializing file access.
 */
class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const mutex = new Mutex();

function getTasksPath(workingDir: string): string {
  return path.join(workingDir, TASKS_FILE);
}

export function loadTasks(workingDir: string): TaskStore {
  const filePath = getTasksPath(workingDir);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // 파일 읽기 실패 시 빈 스토어 반환
  }
  return { tasks: [], nextId: 1 };
}

export function saveTasks(workingDir: string, store: TaskStore): void {
  const filePath = getTasksPath(workingDir);
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
}

export async function addTask(workingDir: string, content: string): Promise<Task> {
  await mutex.acquire();
  try {
    const store = loadTasks(workingDir);
    const task: Task = {
      id: store.nextId,
      content,
      status: "pending",
      createdAt: Date.now(),
    };
    store.tasks.push(task);
    store.nextId++;
    saveTasks(workingDir, store);
    return task;
  } finally {
    mutex.release();
  }
}

export async function removeTask(workingDir: string, id: number): Promise<boolean> {
  await mutex.acquire();
  try {
    const store = loadTasks(workingDir);
    const index = store.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    store.tasks.splice(index, 1);
    saveTasks(workingDir, store);
    return true;
  } finally {
    mutex.release();
  }
}

export async function clearTasks(workingDir: string): Promise<number> {
  await mutex.acquire();
  try {
    const store = loadTasks(workingDir);
    const count = store.tasks.filter((t) => t.status === "pending").length;
    store.tasks = store.tasks.filter((t) => t.status !== "pending");
    saveTasks(workingDir, store);
    return count;
  } finally {
    mutex.release();
  }
}

export function getPendingTasks(workingDir: string): Task[] {
  const store = loadTasks(workingDir);
  return store.tasks.filter((t) => t.status === "pending");
}

export async function updateTaskStatus(
  workingDir: string,
  id: number,
  status: Task["status"],
  result?: string,
): Promise<void> {
  await mutex.acquire();
  try {
    const store = loadTasks(workingDir);
    const task = store.tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      if (status === "completed" || status === "failed") {
        task.completedAt = Date.now();
      }
      saveTasks(workingDir, store);
    }
  } finally {
    mutex.release();
  }
}

export function getTaskById(workingDir: string, id: number): Task | undefined {
  const store = loadTasks(workingDir);
  return store.tasks.find((t) => t.id === id);
}
