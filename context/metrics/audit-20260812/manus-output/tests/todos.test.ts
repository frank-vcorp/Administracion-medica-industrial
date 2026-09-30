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
