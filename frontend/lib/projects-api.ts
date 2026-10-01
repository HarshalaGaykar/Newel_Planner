import api from './api';

export enum ProjectType {
  DEVELOPMENT = 'DEVELOPMENT',
  MAINTENANCE = 'MAINTENANCE',
}

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
  CANCELLED = 'CANCELLED',
  INACTIVE = 'INACTIVE',
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  projectCode?: string;
  clientId?: string;
  isInternal?: boolean;
  methodology?: string;
  pmId?: string;
  budgetHours?: number;
  budgetCost?: number;
  revenue?: number;
  slaType?: string;
  profitCenterId?: string;
  currencyId?: string;
  client?: { id: string; clientCode: string; name: string } | null;
  pm?: { id: string; firstName?: string; lastName?: string } | null;
  currency?: { id: string; code: string; symbol: string } | null;
  profitCenter?: { id: string; code: string; name: string } | null;
  allocations?: {
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    percentage: number;
  }[];
  milestones?: {
    amount: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export const projectsApi = {
  getAll: (filters?: { status?: string; type?: string; clientId?: string; search?: string }) =>
    api.get<Project[]>('/projects', { params: filters }).then((res) => res.data),
  getOne: (id: string) => api.get<Project>(`/projects/${id}`).then((res) => res.data),
  create: (data: Partial<Project>) => api.post<Project>('/projects', data).then((res) => res.data),
  update: (id: string, data: Partial<Project>) => api.patch<Project>(`/projects/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then((res) => res.data),
  getBurnRate: (id: string) => api.get<{ budgetCost: number; actualCost: number; burnRatePct: number }>(`/projects/${id}/burn-rate`).then((res) => res.data),
  getMargin: (id: string) => api.get<{ revenue: number; actualCost: number; margin: number }>(`/projects/${id}/margin`).then((res) => res.data),
};
