import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { todoListSchema } from "../schemas/todo.js";
import type { Todo } from "../types/todo.js";

export class JsonTodoStore {
  public constructor(private readonly filePath: string) {}

  public async list(): Promise<Todo[]> {
    return this.readTodos();
  }

  public async create(title: string): Promise<Todo> {
    const todos = await this.readTodos();
    const todo: Todo = {
      id: randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    todos.push(todo);
    await this.writeTodos(todos);
    return todo;
  }

  public async complete(id: string): Promise<Todo | null> {
    const todos = await this.readTodos();
    const todo = todos.find((item) => item.id === id);

    if (todo === undefined) {
      return null;
    }

    if (!todo.completed) {
      todo.completed = true;
      todo.completedAt = new Date().toISOString();
      await this.writeTodos(todos);
    }

    return todo;
  }

  public async delete(id: string): Promise<Todo | null> {
    const todos = await this.readTodos();
    const todoIndex = todos.findIndex((item) => item.id === id);

    if (todoIndex === -1) {
      return null;
    }

    const [deletedTodo] = todos.splice(todoIndex, 1);
    await this.writeTodos(todos);
    return deletedTodo;
  }

  private async readTodos(): Promise<Todo[]> {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(content);
      const result = todoListSchema.safeParse(parsed);

      if (!result.success) {
        throw new Error("El archivo de tareas contiene datos no válidos");
      }

      return result.data;
    } catch (error: unknown) {
      if (this.isFileNotFoundError(error)) {
        return [];
      }

      if (error instanceof SyntaxError) {
        throw new Error("El archivo de tareas no contiene JSON válido");
      }

      throw error;
    }
  }

  private async writeTodos(todos: Todo[]): Promise<void> {
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(todos, null, 2)}\n`, "utf8");
  }

  private isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
