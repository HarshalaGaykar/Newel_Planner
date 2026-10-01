import api from './api';

export type DeliveryStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface DeliveryItemRemark {
  id: string;
  deliveryItemId: string;
  date: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface DeliveryItemHistory {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
}

export interface DeliveryItem {
  id: string;
  projectId: string;
  srNo: number;
  title: string;
  owners: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  stageId: string | null;
  /** Resolved from the stage master — null when no stage is set. */
  stage: { id: string; name: string } | null;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  remarks: DeliveryItemRemark[];
  history: DeliveryItemHistory[];
}

export interface CreateDeliveryItemPayload {
  srNo: number;
  title: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  /** Id from the stage master. Empty string clears the stage. */
  stageId?: string;
  status?: DeliveryStatus;
  /** Optional initial remark recorded against the item at creation time. */
  remarks?: string;
}

export interface CreateRemarkPayload {
  date: string;
  content: string;
}

export interface TrackerReportRow {
  srNo: number;
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  currentStage: string;
  status: DeliveryStatus;
  remarks: { date: string; content: string }[];
}

export interface ReportPreview {
  projectName: string;
  preparedBy: string;
  reportDate: string;
  statusSummary: string;
  rows: TrackerReportRow[];
  to: string[];
  cc: string[];
}

export interface SendReportPayload {
  to: string[];
  cc: string[];
  subject: string;
  /** Covering message shown above the report in the email body. */
  body: string;
  /** Also attach the Excel workbook. The report itself is always in the body. */
  includeExcelAttachment?: boolean;
  statusSummary?: string;
  /** ISO date (YYYY-MM-DD) shown as "Report Date" on the attachment. */
  reportDate?: string;
  /** Name shown as "Prepared By" on the attachment. */
  preparedBy?: string;
}

/** Per-project report header, authored on the tracker screen. */
export interface ReportSettings {
  reportDate: string | null;
  preparedBy: string | null;
  statusSummary: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ReportSettingsPayload {
  reportDate?: string;
  preparedBy?: string;
  statusSummary?: string;
}

export interface ReportSendRecord {
  id: string;
  projectName: string;
  sentBy: string;
  sentByEmail: string;
  preparedBy: string;
  reportDate: string;
  recipients: string[];
  cc: string[];
  subject: string;
  itemCount: number;
  status: 'SUCCESS' | 'FAILED';
  error: string | null;
  sentAt: string;
}

export const deliveryTrackerApi = {
  getAll: (projectId: string) =>
    api.get<DeliveryItem[]>('/delivery-tracker', { params: { projectId } }).then(r => r.data),

  getOne: (id: string) =>
    api.get<DeliveryItem>(`/delivery-tracker/${id}`).then(r => r.data),

  create: (projectId: string, data: CreateDeliveryItemPayload) =>
    api.post<DeliveryItem>('/delivery-tracker', data, { params: { projectId } }).then(r => r.data),

  update: (id: string, data: Partial<CreateDeliveryItemPayload>) =>
    api.patch<DeliveryItem>(`/delivery-tracker/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    api.delete(`/delivery-tracker/${id}`).then(r => r.data),

  addRemark: (id: string, data: CreateRemarkPayload) =>
    api.post<DeliveryItemRemark>(`/delivery-tracker/${id}/remarks`, data).then(r => r.data),

  getRemarks: (id: string) =>
    api.get<DeliveryItemRemark[]>(`/delivery-tracker/${id}/remarks`).then(r => r.data),

  getHistory: (id: string) =>
    api.get<DeliveryItemHistory[]>(`/delivery-tracker/${id}/history`).then(r => r.data),

  exportUrl: (projectId: string) =>
    `${api.defaults.baseURL}/delivery-tracker/export?projectId=${projectId}`,

  getReportPreview: (projectId: string) =>
    api.get<ReportPreview>('/delivery-tracker/report-preview', { params: { projectId } }).then(r => r.data),

  /** The report exactly as recipients will see it, as a standalone HTML document. */
  getReportHtml: (projectId: string) =>
    api.get<{ html: string }>('/delivery-tracker/report-html', { params: { projectId } }).then(r => r.data.html),

  sendReport: (projectId: string, data: SendReportPayload) =>
    api.post('/delivery-tracker/send-report', data, { params: { projectId } }).then(r => r.data),

  getReportSettings: (projectId: string) =>
    api.get<ReportSettings>('/delivery-tracker/report-settings', { params: { projectId } }).then(r => r.data),

  saveReportSettings: (projectId: string, data: ReportSettingsPayload) =>
    api.put<ReportSettings>('/delivery-tracker/report-settings', data, { params: { projectId } }).then(r => r.data),

  getReportHistory: (projectId: string) =>
    api.get<ReportSendRecord[]>('/delivery-tracker/report-history', { params: { projectId } }).then(r => r.data),
};
