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
