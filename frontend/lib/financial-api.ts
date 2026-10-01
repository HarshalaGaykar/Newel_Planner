import api from './api';

export interface ClientPO {
  id: string;
  poNumber: string;
  projectId: string;
  amount: number;
  placeOfSupply: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  sacCode: string | null;
  completion: number;
  status: string;
  projectId: string;
  clientPoId: string | null;
  dueDate: string | null;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  clientPoId: string;
  milestoneId: string;
  subTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
  financeApproved: boolean;
  cfoApproved: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const financialApi = {
  // Client POs
  getClientPOs: () => api.get<ClientPO[]>('/finance/client-pos').then((res) => res.data),
  createClientPO: (data: { projectId: string; amount: number; poNumber: string }) => api.post<ClientPO>('/finance/client-po', data).then((res) => res.data),
  
  // Milestones
  getMilestones: (projectId: string) => api.get<Milestone[]>(`/milestones/project/${projectId}`).then((res) => res.data),
  createMilestone: (data: { projectId: string; amount: number; name: string; clientPoId?: string }) => api.post<Milestone>('/finance/milestone', data).then((res) => res.data),
  
  // Invoices
  getInvoices: () => api.get<Invoice[]>('/finance/invoices').then((res) => res.data),
  generateInvoice: (milestoneId: string, amount: number) => api.post<Invoice>(`/finance/invoice/${milestoneId}`, { amount }).then((res) => res.data),
  approveInvoice: (invoiceId: string, role: 'FINANCE' | 'CFO') => api.post<Invoice>(`/finance/invoice/${invoiceId}/approve`, { role }).then((res) => res.data),
  
  // Payments
  recordPayment: (data: { invoiceId: string; amount: number; method: string }) => api.post<Payment>('/finance/payment', data).then((res) => res.data),

  // Reports
  getProjectProfitability: (projectId: string) => api.get(`/finance/profitability/${projectId}`).then((res) => res.data),
};
