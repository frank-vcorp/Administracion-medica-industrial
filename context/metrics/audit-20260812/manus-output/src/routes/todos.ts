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
