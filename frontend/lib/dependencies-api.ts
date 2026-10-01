import api from './api';

export interface ProjectDependency {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  type: string;
  fromTaskId: string | null;
  toTaskId: string | null;
  externalRef: string | null;
  ownerId: string;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  fromTask: { id: string; title: string } | null;
  toTask: { id: string; title: string } | null;
}

export const dependenciesApi = {
  getAll: (projectId: string) =>
    api.get<ProjectDependency[]>('/dependencies', { params: { projectId } }).then((r) => r.data),
  create: (data: Partial<ProjectDependency>) =>
    api.post<ProjectDependency>('/dependencies', data).then((r) => r.data),
  update: (id: string, data: Partial<ProjectDependency>) =>
    api.patch<ProjectDependency>(`/dependencies/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/dependencies/${id}`).then((r) => r.data),
};
