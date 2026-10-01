import api from './api';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  capacity?: number;
  velocity?: number;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  tasks?: SprintTask[];
  _count?: { tasks: number };
}

export interface SprintTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  storyPoints?: number;
  estimatedEffort?: number;
  assigneeId?: string;
  sprintId?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string };
}

export interface BurndownPoint {
  date: string;
  totalPoints: number;
  completedPoints: number;
  remainingPoints: number;
}

export interface CompletionSummary {
  planned: number;
  completed: number;
  velocity: number;
  incompleteTasksMovedToBacklog: number;
}

export const sprintsApi = {
  create: (data: {
    projectId: string;
    name: string;
    goal?: string;
    startDate: string;
    endDate: string;
    capacity?: number;
  }): Promise<Sprint> => api.post('/sprints', data).then((r) => r.data),

  list: (projectId?: string): Promise<Sprint[]> =>
    api.get('/sprints', { params: { projectId } }).then((r) => r.data),

  get: (id: string): Promise<Sprint> => api.get(`/sprints/${id}`).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{ name: string; goal: string; startDate: string; endDate: string; capacity: number }>,
  ): Promise<Sprint> => api.patch(`/sprints/${id}`, data).then((r) => r.data),

  start: (id: string): Promise<Sprint> => api.post(`/sprints/${id}/start`).then((r) => r.data),

  complete: (id: string): Promise<CompletionSummary> =>
    api.post(`/sprints/${id}/complete`).then((r) => r.data),

  addTasks: (id: string, taskIds: string[]): Promise<Sprint> =>
    api.post(`/sprints/${id}/tasks`, { taskIds }).then((r) => r.data),

  removeTask: (id: string, taskId: string): Promise<{ message: string }> =>
    api.delete(`/sprints/${id}/tasks/${taskId}`).then((r) => r.data),

  getBurndown: (id: string): Promise<BurndownPoint[]> =>
    api.get(`/sprints/${id}/burndown`).then((r) => r.data),

  getBacklog: (projectId: string): Promise<SprintTask[]> =>
    api.get('/sprints/backlog', { params: { projectId } }).then((r) => r.data),
};
