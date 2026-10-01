import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | { id?: string; name: string };
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
  };
  percentage?: number;
}

export const usersApi = {
  getUsers: () => api.get<User[]>('/users').then((res) => res.data),
  getTeamMembers: () => api.get<User[]>('/users/team-members').then((res) => res.data),
  getTaskAssignees: (projectId: string) =>
    api.get<User[]>('/users/task-assignees', { params: { projectId } }).then((res) => res.data),
  // Every active user, unscoped by reporting hierarchy — the same list the
  // Allocations picker uses. Use this (not getTeamMembers) wherever a filter
  // needs to resolve a specific userId that may fall outside the viewer's team.
  getAllocatable: () => api.get<User[]>('/users/allocatable').then((res) => res.data),
};
