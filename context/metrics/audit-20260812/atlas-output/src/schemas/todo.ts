import { z } from 'zod';

export const CreateTodoSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long'),
});

export const UpdateTodoSchema = z.object({
  completed: z.boolean(),
});

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
