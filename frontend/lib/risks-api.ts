import api from './api';

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  probability: string;
  impact: string;
  riskScore: number;
  mitigation: string | null;
  contingency: string | null;
  ownerId: string;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const risksApi = {
  getAll: (projectId: string) =>
    api.get<Risk[]>('/risks', { params: { projectId } }).then((r) => r.data),
  create: (data: Partial<Risk>) =>
    api.post<Risk>('/risks', data).then((r) => r.data),
  update: (id: string, data: Partial<Risk>) =>
    api.patch<Risk>(`/risks/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/risks/${id}`).then((r) => r.data),
};
