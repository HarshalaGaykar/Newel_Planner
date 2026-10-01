import api from './api';

export interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  ownerId: string;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
  raisedById: string;
  raisedBy: { id: string; firstName: string | null; lastName: string | null } | null;
  eta: string | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export const issuesApi = {
  getAll: (projectId: string) =>
    api.get<ProjectIssue[]>('/issues', { params: { projectId } }).then((r) => r.data),
  create: (data: Partial<ProjectIssue>) =>
    api.post<ProjectIssue>('/issues', data).then((r) => r.data),
  update: (id: string, data: Partial<ProjectIssue>) =>
    api.patch<ProjectIssue>(`/issues/${id}`, data).then((r) => r.data),
  escalate: (id: string) =>
    api.post<ProjectIssue>(`/issues/${id}/escalate`).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/issues/${id}`).then((r) => r.data),
};
