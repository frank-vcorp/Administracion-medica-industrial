import { promises as fs } from 'fs';
import { promises as fssync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Todo, CreateTodoDTO, UpdateTodoDTO } from '../types/todo';

/**
 * Simple JSON-backed store with a single-writer mutex to avoid
 * lost writes when requests arrive concurrently.
 */
export class JsonTodoStore {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async list(): Promise<Todo[]> {
    return this.readTodos();
  }

  async create(input: CreateTodoDTO): Promise<Todo> {
    const todo: Todo = {
      id: randomUUID(),
      title: input.title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await this.mutate((todos) => [...todos, todo]);
    return todo;
  }

  async update(id: string, input: UpdateTodoDTO): Promise<Todo | null> {
    let updated: Todo | null = null;
    await this.mutate((todos) => {
      const idx = todos.findIndex((t) => t.id === id);
      if (idx === -1) return todos;
      updated = { ...todos[idx], ...input };
      const next = [...todos];
      next[idx] = updated;
      return next;
    });
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    let removed = false;
    await this.mutate((todos) => {
      const next = todos.filter((t) => {
        if (t.id === id) {
          removed = true;
          return false;
        }
        return true;
      });
      return next;
    });
    return removed;
  }

  private async readTodos(): Promise<Todo[]> {
    try {
      const raw = await fssync.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Todo[];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * Serializes writes so two concurrent POST/PATCH/DELETE do not
   * produce a truncated file. Reads remain free.
   */
  private mutate(transform: (todos: Todo[]) => Todo[]): Promise<void> {
    const next = this.writeChain.then(async () => {
      const current = await this.readTodos();
      const transformed = transform(current);
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(transformed, null, 2), 'utf-8');
      await fs.rename(tmp, this.filePath);
    });
    // Swallow errors so a failed write does not poison the chain forever.
    this.writeChain = next.catch(() => undefined);
    return next;
  }
}

export function defaultStorePath(): string {
  return path.resolve(process.cwd(), 'data', 'todos.json');
}
