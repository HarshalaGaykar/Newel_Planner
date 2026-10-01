import api from './api';
import type { CRPhase } from './tasks-api';

export interface CRComment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface CRTask {
  id: string;
  title: string;
  status: string;
  phase: CRPhase | null;
  progressPct: number;
  estimatedEffort: number | null;
  actualEffort: number;
  assignee: { id: string; firstName: string; lastName: string } | null;
}

export interface ChangeRequest {
  id: string;
  crCode: string;
  projectId: string;
  title: string;
  type: string;
  description?: string;
  impactedScope?: string;
  budgetDelta?: number;
  timelineDeltaDays?: number;
  resourceChanges?: any;
  status: string;
  createdAt: string;
  project: {
    name: string;
    projectCode?: string;
  };
  requester: {
    firstName: string;
    lastName: string;
  };
  comments?: CRComment[];
  tasks?: CRTask[];
}

export const changeRequestsApi = {
  getAll: async (projectId?: string) => {
    const res = await api.get('/change-requests', { params: { projectId } });
    return res.data;
  },

  getOne: async (id: string) => {
    const res = await api.get(`/change-requests/${id}`);
    return res.data;
  },

  create: async (data: Partial<ChangeRequest>) => {
    const res = await api.post('/change-requests', data);
    return res.data;
  },

  update: async (id: string, data: Partial<ChangeRequest>) => {
    const res = await api.patch(`/change-requests/${id}`, data);
    return res.data;
  },

  submit: async (id: string) => {
    const res = await api.post(`/change-requests/${id}/submit`);
    return res.data;
  },

  addComment: async (id: string, body: string) => {
    const res = await api.post(`/change-requests/${id}/comments`, { body });
    return res.data;
  },

  close: async (id: string) => {
    const res = await api.post(`/change-requests/${id}/close`);
    return res.data;
  },
};
