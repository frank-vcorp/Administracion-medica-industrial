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
