import api from './api';
import { PaginationMeta } from './operations-api';

export type CRPhase = 'REQUIREMENT' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'UAT' | 'DEPLOYMENT';

export interface AuditLogEntry {
  id: string;
  action: string;
  entityId: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  details: Record<string, any> | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  taskType: string | null;
  taskTypeMasterId?: string | null;
  taskTypeMaster?: { id: string; name: string } | null;
  estimatedEffort: number | null;
  actualEffort: number;
  startDate: string | null;
  endDate: string | null;
  projectId: string;
  assigneeId: string | null;
  milestoneId: string | null;
  parentId: string | null;
  crId: string | null;
  phase: CRPhase | null;
  createdAt: string;
  updatedAt: string;
  isCritical: boolean;
  wbsLevel: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  plannedHours: number | null;
  progressPct: number;
  dailyEffort?: number | null;
  dailyEffortOverride?: boolean;
  workingDays?: number | null;
  complexity: number;
  assignee?: { id: string; firstName?: string; lastName?: string } | null;
  assigneeIds?: string[];
  taskAssignees?: { user: { id: string; firstName?: string; lastName?: string } }[];
  subTasks?: Pick<Task, 'id' | 'title' | 'status' | 'progressPct' | 'assigneeId'>[];
  parent?: { id: string; title: string } | null;
  project?: { id: string; name: string };
  changeRequest?: { id: string; crCode: string; status: string } | null;
}

export const tasksApi = {
  getTasks: (projectId?: string, crId?: string, parentId?: string, assigneeId?: string) =>
    api.get<Task[]>('/tasks', { params: { projectId, crId, parentId, assigneeId } }).then((res) => res.data),
  getPmTlTasks: (projectId?: string) =>
    api.get<Task[]>('/tasks/my-scope', { params: { projectId } }).then((res) => res.data),
  getTask: (id: string) => api.get<Task>(`/tasks/${id}`).then((res) => res.data),
  createTask: (data: Partial<Task>) => api.post<Task>('/tasks', data).then((res) => res.data),
  updateTask: (id: string, data: Partial<Task>) => api.patch<Task>(`/tasks/${id}`, data).then((res) => res.data),
  updateProgress: (id: string, progressPct: number) => api.patch<Task>(`/tasks/${id}/progress`, { progressPct }).then((res) => res.data),
  deleteTask: (id: string) => api.delete(`/tasks/${id}`).then((res) => res.data),
  getCriticalPath: (projectId: string) => api.get<Task[]>('/tasks/critical-path', { params: { projectId } }).then((res) => res.data),
  getTasksByCr: (crId: string) => api.get<Task[]>('/tasks', { params: { crId } }).then((res) => res.data),
  getTaskHistory: (taskId: string) =>
    api.get<{ data: AuditLogEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      '/audit-logs',
      { params: { entityId: taskId, limit: 50 } }
    ).then((res) => res.data),

  // WBS bulk import — upload an .xlsx/.csv of tasks for a project.
  uploadWbs: (file: File, projectId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    return api
      .post<WbsUploadResult>('/tasks/wbs-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },

  // Download the styled .xlsx WBS template.
  downloadWbsTemplate: async () => {
    const res = await api.get('/tasks/wbs-template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wbs-template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // WBS upload history — for the undo UI beside the Upload WBS button.
  getWbsUploadHistory: (projectId: string, page = 1, limit = 10) =>
    api
      .get<WbsUploadHistoryResult>('/tasks/wbs-upload-history', { params: { projectId, page, limit } })
      .then((res) => res.data),

  undoWbsUpload: (batchId: string) =>
    api.post<{ deletedTasks: number }>(`/tasks/wbs-upload-history/${batchId}/undo`).then((res) => res.data),

  getWbsUploadErrors: (batchId: string) =>
    api
      .get<WbsUploadErrorsResponse>(`/tasks/wbs-upload-history/${batchId}/errors`)
      .then((res) => res.data),

  // Task Board bulk import — upload an .xlsx/.csv of tasks spanning projects.
  bulkUploadTasks: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<WbsUploadResult>('/tasks/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },

  // Task Board bulk upload history — paginated, for the dialog's "View History" tab.
  listTaskBulkUploadHistory: (page = 1, pageSize = 10) =>
    api
      .get<TaskBulkUploadHistoryResponse>('/tasks/bulk-upload-history', { params: { page, pageSize } })
      .then((res) => res.data),

  getTaskBulkUploadErrors: (batchId: string) =>
    api
      .get<TaskBulkUploadErrorsResponse>(`/tasks/bulk-upload/${batchId}/errors`)
      .then((res) => res.data),

  undoTaskBulkUpload: (batchId: string) =>
    api.post<{ deletedTasks: number }>(`/tasks/bulk-upload/${batchId}/undo`).then((res) => res.data),

  // Export the current Task Board view (honoring active filters) to .xlsx.
  exportTasks: async (params?: { projectId?: string; milestoneId?: string; assigneeId?: string; status?: string; crId?: string; parentId?: string }) => {
    const res = await api.get('/tasks/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tasks.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Download the styled .xlsx Task Board template.
  downloadTaskTemplate: async () => {
    const res = await api.get('/tasks/task-template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'task-template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export interface WbsUploadResult {
  batchId?: string;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface TaskBulkUpload {
  id: string;
  fileName: string | null;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'COMPLETED' | 'ROLLED_BACK';
  createdAt: string;
  rolledBackAt: string | null;
  uploadedBy: { firstName: string | null; lastName: string | null; email: string } | null;
}

export interface TaskBulkUploadHistoryResponse {
  data: TaskBulkUpload[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskBulkUploadErrorsResponse {
  batchId: string;
  errors: { row: number; message: string }[];
}

export interface WbsUploadBatch {
  id: string;
  fileName: string | null;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'COMPLETED' | 'ROLLED_BACK';
  createdAt: string;
  rolledBackAt: string | null;
  uploadedBy: { firstName: string | null; lastName: string | null; email: string } | null;
}

export interface WbsUploadHistoryResult {
  data: WbsUploadBatch[];
  meta: PaginationMeta;
}

export interface WbsUploadErrorsResponse {
  batchId: string;
  errors: { row: number; message: string }[];
}

export interface WbsUndoBlocker {
  taskTitle: string;
  personName: string;
  totalHours: number;
}
