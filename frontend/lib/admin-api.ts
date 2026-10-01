import api from './api';

export interface AdminConfig {
  key: string;
  value: string;
  label: string | null;
  group: string | null;
  updatedById: string | null;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: SkillCategory | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  skillCount?: number;
}

export interface SkillCategoryListResponse {
  data: SkillCategory[];
  meta: {
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    returnedCategories: number;
    totalSkills: number;
    categorizedSkills: number;
    uncategorizedSkills: number;
  };
}

export interface SkillCategoryDetails extends SkillCategory {
  skills: Skill[];
  meta: {
    skillCount: number;
    hasSkills: boolean;
  };
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export const adminApi = {
  // Departments
  getDepartments: () => api.get<Department[]>('/departments').then((res) => res.data),
  createDepartment: (data: Partial<Department>) => api.post<Department>('/departments', data).then((res) => res.data),
  updateDepartment: (id: string, data: Partial<Department>) => api.patch<Department>(`/departments/${id}`, data).then((res) => res.data),
  deleteDepartment: (id: string) => api.delete(`/departments/${id}`).then((res) => res.data),

  // Skills
  getSkills: () => api.get<Skill[]>('/skills').then((res) => res.data),
  createSkill: (data: Partial<Skill>) => api.post<Skill>('/skills', data).then((res) => res.data),
  updateSkill: (id: string, data: Partial<Skill>) => api.patch<Skill>(`/skills/${id}`, data).then((res) => res.data),
  deleteSkill: (id: string) => api.delete(`/skills/${id}`).then((res) => res.data),

  // Skill Categories
  getSkillCategories: (includeInactive = false) =>
    api
      .get<SkillCategoryListResponse>('/skill-category', {
        params: { includeInactive },
      })
      .then((res) => res.data),
  getSkillCategory: (id: string) =>
    api.get<SkillCategoryDetails>(`/skill-category/${id}`).then((res) => res.data),
  createSkillCategory: (data: Pick<SkillCategory, 'name'> & Partial<Pick<SkillCategory, 'description'>>) =>
    api.post<SkillCategory>('/skill-category', data).then((res) => res.data),
  updateSkillCategory: (
    id: string,
    data: Partial<Pick<SkillCategory, 'name' | 'description' | 'isActive'>>,
  ) => api.patch<SkillCategory>(`/skill-category/${id}`, data).then((res) => res.data),
  deleteSkillCategory: (id: string) =>
    api.delete(`/skill-category/${id}`).then((res) => res.data),

  // Roles & Permissions
  getRoles: () => api.get<Role[]>('/roles').then((res) => res.data),
  getPermissions: () => api.get<Permission[]>('/permissions').then((res) => res.data),
};

// Admin Config API (used by the Scheduler config tab)
export const adminConfigApi = {
  /** Returns all AdminConfig entries grouped by group name e.g. { PROJECT: [...], ATTENDANCE: [...] } */
  getAll: () => api.get<Record<string, AdminConfig[]>>('/admin-config').then((r) => r.data),
  /** Returns configs for a single group as { key: value } map. */
  getGroup: (group: string) =>
    api.get<Record<string, string>>(`/admin-config/group/${group}`).then((r) => r.data),
  /** Update a single config value by key. Triggers live reschedule on the backend if applicable. */
  updateKey: (key: string, value: string) =>
    api.put(`/admin-config/${key}`, { value }).then((r) => r.data),
};
