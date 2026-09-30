export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}
