import api from './api';

export interface TaskSubActivity {
  id: string;
  activityId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivity {
  id: string;
  taskTypeId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subActivities: TaskSubActivity[];
}

export interface TaskType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activities: TaskActivity[];
}

export interface BulkUploadResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export const taskTypeMasterApi = {
  // Read
  getTree: (includeInactive = false) =>
    api
      .get<TaskType[]>('/task-type-master', { params: { includeInactive: includeInactive || undefined } })
      .then((r) => r.data),

  getActivities: (taskTypeId: string, includeInactive = false) =>
    api
      .get<TaskActivity[]>(`/task-type-master/${taskTypeId}/activities`, {
        params: { includeInactive: includeInactive || undefined },
      })
      .then((r) => r.data),

  getSubActivities: (activityId: string, includeInactive = false) =>
    api
      .get<TaskSubActivity[]>(`/task-type-master/activities/${activityId}/sub-activities`, {
        params: { includeInactive: includeInactive || undefined },
      })
      .then((r) => r.data),

  // Create
  createTaskType: (data: { name: string; description?: string }) =>
    api.post<TaskType>('/task-type-master/task-types', data).then((r) => r.data),

  createActivity: (data: { taskTypeId: string; name: string }) =>
    api.post<TaskActivity>('/task-type-master/activities', data).then((r) => r.data),

  createSubActivity: (data: { activityId: string; name: string; description?: string }) =>
    api.post<TaskSubActivity>('/task-type-master/sub-activities', data).then((r) => r.data),

  bulkUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<BulkUploadResult>('/task-type-master/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  // Update
  updateTaskType: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.patch<TaskType>(`/task-type-master/task-types/${id}`, data).then((r) => r.data),

  updateActivity: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.patch<TaskActivity>(`/task-type-master/activities/${id}`, data).then((r) => r.data),

  updateSubActivity: (
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ) =>
    api.patch<TaskSubActivity>(`/task-type-master/sub-activities/${id}`, data).then((r) => r.data),
};
