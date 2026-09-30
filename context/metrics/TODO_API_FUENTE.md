TIMING_START: 2026-08-11T00:00:00

## `src/types/todo.ts`

```typescript
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}
```

## `src/schemas/todo.ts`

```typescript
import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200, "El título no puede superar 200 caracteres"),
});

export const todoIdSchema = z.string().uuid("El identificador debe ser un UUID válido");

const persistedTodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
});

export const todoListSchema = z.array(persistedTodoSchema);
```

## `src/storage/jsonStore.ts`

```typescript
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
```

## `src/routes/todos.ts`

```typescript
import { Router, type Response } from "express";
import { createTodoSchema, todoIdSchema } from "../schemas/todo.js";
import { JsonTodoStore } from "../storage/jsonStore.js";

export function createTodosRouter(store: JsonTodoStore): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const payload = createTodoSchema.safeParse(request.body);

    if (!payload.success) {
      response.status(400).json({
        error: "El cuerpo de la solicitud no es válido",
        details: payload.error.flatten(),
      });
      return;
    }

    try {
      const todo = await store.create(payload.data.title);
      response.status(201).json(todo);
    } catch {
      sendInternalError(response);
    }
  });

  router.get("/", async (_request, response) => {
    try {
      const todos = await store.list();
      response.status(200).json(todos);
    } catch {
      sendInternalError(response);
    }
  });

  router.patch("/:id", async (request, response) => {
    const id = todoIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({
        error: "El identificador de tarea no es válido",
        details: id.error.flatten(),
      });
      return;
    }

    try {
      const todo = await store.complete(id.data);

      if (todo === null) {
        response.status(404).json({ error: "Tarea no encontrada" });
        return;
      }

      response.status(200).json(todo);
    } catch {
      sendInternalError(response);
    }
  });

  router.delete("/:id", async (request, response) => {
    const id = todoIdSchema.safeParse(request.params.id);

    if (!id.success) {
      response.status(400).json({
        error: "El identificador de tarea no es válido",
        details: id.error.flatten(),
      });
      return;
    }

    try {
      const deletedTodo = await store.delete(id.data);

      if (deletedTodo === null) {
        response.status(404).json({ error: "Tarea no encontrada" });
        return;
      }

      response.status(200).json({ id: deletedTodo.id });
    } catch {
      sendInternalError(response);
    }
  });

  return router;
}

function sendInternalError(response: Response): void {
  response.status(500).json({ error: "Error interno del servidor" });
}
```

## `src/index.ts`

```typescript
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTodosRouter } from "./routes/todos.js";
import { JsonTodoStore } from "./storage/jsonStore.js";

export function createApp(
  store: JsonTodoStore = new JsonTodoStore(join(process.cwd(), "data", "todos.json")),
): Express {
  const app = express();

  app.use(express.json());
  app.use("/todos", createTodosRouter(store));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "El cuerpo contiene JSON no válido" });
      return;
    }

    response.status(500).json({ error: "Error interno del servidor" });
  });

  return app;
}

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port);
}

export default app;
```

## `tests/todos.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/index.js";
import { JsonTodoStore } from "../src/storage/jsonStore.js";
import type { Todo } from "../src/types/todo.js";

describe("API de tareas", () => {
  let app: Express;
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "todo-api-"));
    app = createApp(new JsonTodoStore(join(temporaryDirectory, "todos.json")));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("POST /todos crea una tarea", async () => {
    const response = await request(app).post("/todos").send({ title: "Comprar café" }).expect(201);
    const todo = response.body as Todo;

    expect(todo).toMatchObject({
      title: "Comprar café",
      completed: false,
      completedAt: null,
    });
    expect(todo.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(todo.createdAt).toEqual(expect.any(String));
  });

  it("POST /todos rechaza un título vacío", async () => {
    const response = await request(app).post("/todos").send({ title: "   " }).expect(400);

    expect(response.body.error).toBe("El cuerpo de la solicitud no es válido");
  });

  it("GET /todos devuelve todas las tareas", async () => {
    await request(app).post("/todos").send({ title: "Preparar informe" }).expect(201);
    const response = await request(app).get("/todos").expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      title: "Preparar informe",
      completed: false,
    });
  });

  it("PATCH /todos/:id marca una tarea como completada", async () => {
    const createdResponse = await request(app).post("/todos").send({ title: "Revisar API" }).expect(201);
    const createdTodo = createdResponse.body as Todo;
    const response = await request(app).patch(`/todos/${createdTodo.id}`).expect(200);
    const updatedTodo = response.body as Todo;

    expect(updatedTodo).toMatchObject({
      id: createdTodo.id,
      title: "Revisar API",
      completed: true,
    });
    expect(updatedTodo.completedAt).toEqual(expect.any(String));
  });

  it("PATCH /todos/:id devuelve 400 para un identificador inválido y 404 si no existe", async () => {
    await request(app).patch("/todos/no-es-un-uuid").expect(400);
    await request(app).patch("/todos/11111111-1111-4111-8111-111111111111").expect(404);
  });

  it("DELETE /todos/:id elimina una tarea", async () => {
    const createdResponse = await request(app).post("/todos").send({ title: "Archivar nota" }).expect(201);
    const createdTodo = createdResponse.body as Todo;

    await request(app).delete(`/todos/${createdTodo.id}`).expect(200, { id: createdTodo.id });
    const listResponse = await request(app).get("/todos").expect(200);

    expect(listResponse.body).toEqual([]);
  });
});
```

## `package.json`

```typescript
{
  "name": "todo-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.21.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.13.10",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.1.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vitest": "^3.0.7"
  }
}
```

## `tsconfig.json`

```typescript
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src", "tests"]
}
```

## `README.md`

```typescript
# API REST de tareas

Esta API implementa una lista de tareas con TypeScript estricto, Express 4, Zod y persistencia en un archivo JSON local. El archivo de datos se crea automáticamente en `data/todos.json` cuando se registra la primera tarea.

## Requisitos

Se requiere Node.js 20 o una versión posterior y npm.

## Instalación y ejecución

~~~bash
npm install
npm run dev
~~~

El servidor queda disponible en `http://localhost:3000` de forma predeterminada. Se puede cambiar el puerto mediante la variable de entorno `PORT`.

## Endpoints

| Método | Ruta | Cuerpo | Respuesta correcta |
| --- | --- | --- | --- |
| `POST` | `/todos` | `{ "title": "Comprar café" }` | `201 Created` con la tarea creada |
| `GET` | `/todos` | No aplica | `200 OK` con el arreglo de tareas |
| `PATCH` | `/todos/:id` | No aplica | `200 OK` con la tarea marcada como completada |
| `DELETE` | `/todos/:id` | No aplica | `200 OK` con `{ "id": "..." }` |

Los cuerpos de creación y los identificadores se validan con Zod. Los datos inválidos devuelven `400`, una tarea inexistente devuelve `404` y los fallos de almacenamiento devuelven `500`.

## Ejemplos

~~~bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Comprar café"}'

curl http://localhost:3000/todos

curl -X PATCH http://localhost:3000/todos/<id>

curl -X DELETE http://localhost:3000/todos/<id>
~~~

## Comandos disponibles

~~~bash
npm run dev
npm test
npm run typecheck
~~~
```

TIMING_END: 2026-08-11T00:00:00
TIMING_DURATION_MIN: 0.00
TIMING_FILES: 9
TIMING_LINES: 363
