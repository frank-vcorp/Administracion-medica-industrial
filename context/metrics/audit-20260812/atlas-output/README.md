# TODO API

Minimal REST API in TypeScript + Express for managing TODO items, with Zod validation, Vitest tests, and JSON file persistence.

## Requirements

- Node.js 18+
- npm 9+

## Install

```bash
npm install
```

## Run (development, hot reload)

```bash
npm run dev
```

Server listens on `http://localhost:3000` (override with `PORT=4000 npm run dev`).

## Run (production)

```bash
npm run build
npm start
```

## Type check

```bash
npm run typecheck
```

## Tests

```bash
npm test
```

Tests use an isolated temp directory per test, so the real `data/todos.json` is never touched.

## Endpoints

| Method | Path           | Body                       | Success | Errors                |
|--------|----------------|----------------------------|---------|-----------------------|
| POST   | /todos         | `{ "title": "string" }`    | 201     | 400 invalid payload   |
| GET    | /todos         | -                          | 200     | -                     |
| PATCH  | /todos/:id     | `{ "completed": bool }`    | 200     | 400 / 404             |
| DELETE | /todos/:id     | -                          | 204     | 404                   |
| GET    | /health        | -                          | 200     | -                     |

## curl examples

```bash
# create
curl -X POST http://localhost:3000/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk"}'

# list
curl http://localhost:3000/todos

# mark as completed (use id from previous response)
curl -X PATCH http://localhost:3000/todos/<id> \
  -H 'Content-Type: application/json' \
  -d '{"completed":true}'

# delete
curl -X DELETE http://localhost:3000/todos/<id>
```

## Data persistence

Todos are persisted to `./data/todos.json` (created on first write). Writes are serialized through an in-memory mutex and use an atomic `write tmp + rename` to avoid corruption under concurrent requests.

## Project layout

```
src/
  index.ts          # app factory + bootstrap
  routes/todos.ts   # /todos router
  schemas/todo.ts   # Zod schemas
  storage/jsonStore.ts  # JSON-backed store with concurrency guard
  types/todo.ts     # shared types
tests/
  todos.test.ts     # Vitest + supertest
```
