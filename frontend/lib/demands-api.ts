import api from './api';

export interface DemandComment {
  id: string;
  demandId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
  };
}

export interface Demand {
  id: string;
  demandCode: string;
  title: string;
  description?: string;
  requesterId: string;
  departmentId?: string;
  estimatedTimeline?: string;
  estimatedBudget?: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  attachmentUrl?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  reviewerRemarks?: string;
  convertedProjectId?: string;
  workflowInstanceId?: string;
  createdAt: string;
  updatedAt: string;
  requester: {
    firstName: string;
    lastName: string;
    email: string;
  };
  department?: {
    id: string;
    name: string;
  };
  convertedProject?: {
    id: string;
    name: string;
  };
  comments?: DemandComment[];
}

export const demandsApi = {
  getAll: async () => {
    const { data } = await api.get<Demand[]>('/demands');
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get<Demand>(`/demands/${id}`);
    return data;
  },
  create: async (payload: any) => {
    const { data } = await api.post<Demand>('/demands', payload);
    return data;
  },
  update: async (id: string, payload: any) => {
    const { data } = await api.patch<Demand>(`/demands/${id}`, payload);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/demands/${id}`);
  },
  submit: async (id: string) => {
    const { data } = await api.post<Demand>(`/demands/${id}/submit`);
    return data;
  },
  convert: async (id: string, payload: { startDate: string; pmId: string }) => {
    const { data } = await api.post(`/demands/${id}/convert`, payload);
    return data;
  },
  addComment: async (id: string, body: string) => {
    const { data } = await api.post<DemandComment>(`/demands/${id}/comments`, { body });
    return data;
  },
  getComments: async (id: string) => {
    const { data } = await api.get<DemandComment[]>(`/demands/${id}/comments`);
    return data;
  },
};
