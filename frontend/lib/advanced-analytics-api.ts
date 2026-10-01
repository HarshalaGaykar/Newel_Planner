import api from './api';

export interface BurnoutRisk {
  userId: string;
  name: string;
  email: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  riskFactors: string[];
}

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  healthScore: number;
  breakdown: {
    risks: number;
    issues: number;
    sla: number;
    budget: number;
  };
  concerns: string[];
}

export const advancedAnalyticsApi = {
  getBurnoutRisk: async (): Promise<BurnoutRisk[]> => {
    const response = await api.get('/advanced-analytics/burnout-risk');
    return response.data;
  },

  getProjectHealth: async (projectId: string): Promise<ProjectHealth> => {
    const response = await api.get(`/advanced-analytics/project-health/${projectId}`);
    return response.data;
  },

  getAnomalies: async (): Promise<any[]> => {
    const response = await api.get('/advanced-analytics/anomalies');
    return response.data;
  },
};

