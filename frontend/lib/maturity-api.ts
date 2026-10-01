import api from './api';

export interface EmployeeMaturity {
  id: string;
  userId: string;
  userName: string;
  currentMaturityValue: number;
  forTheMonth: string;
  isActive: boolean;
  remarks: string | null;
  createdById: string;
  createdAt: string;
  updatedById: string | null;
  updatedAt: string;
  user?: { id: string; departmentId: string | null; roleId: string | null };
}

export interface EmployeeMaturityHistoryRow {
  id: string;
  employeeMaturityId: string;
  userId: string;
  userName: string;
  maturityValue: number;
  forTheMonth: string;
  isActive: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string | null;
  user?: { id: string; departmentId: string | null; roleId: string | null };
}

export interface MaturityReportGroup {
  userId: string;
  userName: string;
  points: { forTheMonth: string; maturityValue: number }[];
}

export interface MaturityReportResponse {
  rows: EmployeeMaturityHistoryRow[];
  grouped: MaturityReportGroup[];
}

export interface CreateMaturityPayload {
  userId: string;
  currentMaturityValue: number;
  forTheMonth: string;
  remarks?: string;
  isActive?: boolean;
}

export interface UpdateMaturityPayload {
  forTheMonth: string;
  maturityValue?: number;
  remarks?: string;
  isActive?: boolean;
}

export interface MaturityListParams {
  isActive?: 'true' | 'false';
  search?: string;
}

export interface MaturityReportParams {
  year?: number;
  startMonth?: string;
  endMonth?: string;
  userId?: string;
  departmentId?: string;
  roleId?: string;
  projectId?: string;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface MaturityBulkUploadResult {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  unchanged: number;
  errors: { row: number; message: string }[];
}

export const maturityApi = {
  create: (data: CreateMaturityPayload) =>
    api.post<EmployeeMaturity>('/maturity', data).then((res) => res.data),

  update: (userId: string, data: UpdateMaturityPayload) =>
    api.patch<EmployeeMaturity>(`/maturity/${userId}`, data).then((res) => res.data),

  getAll: (params?: MaturityListParams) =>
    api.get<EmployeeMaturity[]>('/maturity', { params }).then((res) => res.data),

  getOne: (userId: string) =>
    api.get<EmployeeMaturity>(`/maturity/${userId}`).then((res) => res.data),

  getHistory: (userId: string) =>
    api.get<EmployeeMaturityHistoryRow[]>(`/maturity/${userId}/history`).then((res) => res.data),

  getReport: (params?: MaturityReportParams) =>
    api.get<MaturityReportResponse>('/maturity/report', { params }).then((res) => res.data),

  bulkUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<MaturityBulkUploadResult>('/maturity/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },

  downloadTemplate: async () => {
    const res = await api.get('/maturity/bulk-upload/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employee-maturity-template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
