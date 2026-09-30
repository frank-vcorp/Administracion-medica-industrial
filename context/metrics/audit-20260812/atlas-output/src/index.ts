import express, { Request, Response, NextFunction } from 'express';
import { createTodoRouter } from './routes/todos';
import { JsonTodoStore, defaultStorePath } from './storage/jsonStore';

export function createApp(store: JsonTodoStore = new JsonTodoStore(defaultStorePath())) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.use('/todos', createTodoRouter(store));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
  });

  // Centralized error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[todo-api] unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[todo-api] listening on http://localhost:${port}`);
  });
}
