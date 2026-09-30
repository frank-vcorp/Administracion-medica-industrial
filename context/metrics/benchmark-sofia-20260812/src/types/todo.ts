export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export type CreateTodoDTO = Pick<Todo, 'title'>;
export type UpdateTodoDTO = Pick<Todo, 'completed'>;