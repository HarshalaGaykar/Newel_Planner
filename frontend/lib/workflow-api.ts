import api from './api';

export const workflowApi = {
  getPending: async () => {
    const res = await api.get('/workflow/pending');
    return res.data;
  },

  takeAction: async (instanceId: string, action: string, remarks?: string) => {
    const res = await api.post(`/workflow/instances/${instanceId}/action`, {
      action,
      remarks,
    });
    return res.data;
  },

  getHistory: async (entityType: string, entityId: string) => {
    const res = await api.get(`/workflow/history/${entityType}/${entityId}`);
    return res.data;
  },
};
