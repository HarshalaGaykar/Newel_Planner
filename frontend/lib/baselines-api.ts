import api from './api';

export interface Baseline {
  id: string;
  projectId: string;
  version: number;
  label: string;
  snapshotData?: unknown[];
  createdAt: string;
  createdBy?: { id: string; firstName?: string; lastName?: string };
}

export interface BaselineDiffEntry {
  taskId: string;
  title: string;
  field: string;
  baselineValue: unknown;
  currentValue: unknown;
  deltaType: 'DELAYED' | 'AHEAD' | 'ON_TRACK' | 'ADDED' | 'REMOVED';
}

export const baselinesApi = {
  capture: (projectId: string, label: string) =>
    api.post<Baseline>('/baselines', { projectId, label }).then((r) => r.data),

  getAll: (projectId: string) =>
    api.get<Baseline[]>('/baselines', { params: { projectId } }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<Baseline>(`/baselines/${id}`).then((r) => r.data),

  compare: (id: string) =>
    api.get<BaselineDiffEntry[]>(`/baselines/${id}/compare`).then((r) => r.data),
};
