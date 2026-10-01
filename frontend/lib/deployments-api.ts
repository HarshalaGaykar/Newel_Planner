import api from './api';
import { TestEnvironment } from './test-management-api';

export interface Deployment {
  id: string;
  projectId: string;
  project: { id: string; name: string };
  environment: TestEnvironment;
  version: string | null;
  deployedAt: string;
  deployedById: string;
  deployedBy: { id: string; firstName: string | null; lastName: string | null };
  sprintId: string | null;
  sprint: { id: string; name: string } | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const deploymentsApi = {
  getDeployments: (params?: { projectId?: string }) =>
    api.get<Deployment[]>('/deployments', { params }).then((r) => r.data),

  getDeployment: (id: string) =>
    api.get<Deployment>(`/deployments/${id}`).then((r) => r.data),

  createDeployment: (data: {
    projectId: string;
    environment: TestEnvironment;
    version?: string;
    sprintId?: string;
    notes?: string;
    status?: string;
  }) => api.post<Deployment>('/deployments', data).then((r) => r.data),

  updateDeployment: (id: string, data: Partial<Deployment>) =>
    api.patch<Deployment>(`/deployments/${id}`, data).then((r) => r.data),

  deleteDeployment: (id: string) =>
    api.delete(`/deployments/${id}`).then((r) => r.data),
};
