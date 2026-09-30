import { Router, Request, Response } from 'express';
import { JsonTodoStore } from '../storage/jsonStore';
import {
  CreateTodoSchema,
  UpdateTodoSchema,
} from '../schemas/todo';

export function createTodoRouter(store: JsonTodoStore): Router {
  const router = Router();

  // POST /todos - create a new todo
  router.post('/', async (req: Request, res: Response) => {
    const parsed = CreateTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const todo = await store.create({ title: parsed.data.title });
    return res.status(201).json(todo);
  });

  // GET /todos - list all todos
  router.get('/', async (_req: Request, res: Response) => {
    const todos = await store.list();
    return res.status(200).json(todos);
  });

  // PATCH /todos/:id - mark as completed (or uncomplete)
  router.patch('/:id', async (req: Request, res: Response) => {
    const parsed = UpdateTodoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const updated = await store.update(req.params.id, {
      completed: parsed.data.completed,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    return res.status(200).json(updated);
  });

  // DELETE /todos/:id - remove a todo
  router.delete('/:id', async (req: Request, res: Response) => {
    const removed = await store.delete(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    return res.status(204).send();
  });

  return router;
}
