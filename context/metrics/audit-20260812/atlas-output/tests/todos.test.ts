import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createApp } from '../src/index';
import { JsonTodoStore } from '../src/storage/jsonStore';

function makeTmpStore(): JsonTodoStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'));
  const file = path.join(dir, 'todos.json');
  return new JsonTodoStore(file);
}

describe('TODO API', () => {
  let store: JsonTodoStore;

  beforeEach(() => {
    store = makeTmpStore();
  });

  it('POST /todos creates a todo and returns 201', async () => {
    const app = createApp(store);
    const res = await request(app)
      .post('/todos')
      .send({ title: 'Buy milk' })
      .expect(201);
    expect(res.body).toMatchObject({
      title: 'Buy milk',
      completed: false,
    });
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
  });

  it('POST /todos rejects empty title with 400', async () => {
    const app = createApp(store);
    const res = await request(app)
      .post('/todos')
      .send({ title: '' })
      .expect(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('GET /todos returns an empty array initially', async () => {
    const app = createApp(store);
    const res = await request(app).get('/todos').expect(200);
    expect(res.body).toEqual([]);
  });

  it('GET /todos returns all created todos', async () => {
    const app = createApp(store);
    await request(app).post('/todos').send({ title: 'A' }).expect(201);
    await request(app).post('/todos').send({ title: 'B' }).expect(201);
    const res = await request(app).get('/todos').expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['A', 'B']);
  });

  it('PATCH /todos/:id marks a todo as completed', async () => {
    const app = createApp(store);
    const created = await request(app)
      .post('/todos')
      .send({ title: 'Task' })
      .expect(201);
    const res = await request(app)
      .patch(`/todos/${created.body.id}`)
      .send({ completed: true })
      .expect(200);
    expect(res.body.completed).toBe(true);
  });

  it('PATCH /todos/:id returns 404 for unknown id', async () => {
    const app = createApp(store);
    const res = await request(app)
      .patch('/todos/does-not-exist')
      .send({ completed: true })
      .expect(404);
    expect(res.body.error).toBe('Todo not found');
  });

  it('DELETE /todos/:id removes a todo and returns 204', async () => {
    const app = createApp(store);
    const created = await request(app)
      .post('/todos')
      .send({ title: 'X' })
      .expect(201);
    await request(app).delete(`/todos/${created.body.id}`).expect(204);
    const list = await request(app).get('/todos').expect(200);
    expect(list.body).toEqual([]);
  });

  it('DELETE /todos/:id returns 404 for unknown id', async () => {
    const app = createApp(store);
    const res = await request(app)
      .delete('/todos/missing')
      .expect(404);
    expect(res.body.error).toBe('Todo not found');
  });
});
