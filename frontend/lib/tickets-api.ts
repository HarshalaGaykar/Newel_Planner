import api from './api';

export interface TicketTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  targetDate: string | null;
  isSlaBreached: boolean;
  projectId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  actualEffort: number;
  complexity: string;
  techStack: string | null;
  project?: { id: string; name: string };
  assignee?: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeIds?: string[];
  ticketAssignees?: { user: { id: string; firstName?: string | null; lastName?: string | null } }[];
  tasks?: TicketTask[];
}

export const ticketsApi = {
  getTickets: (projectId?: string) => api.get<Ticket[]>('/tickets', { params: { projectId } }).then((res) => res.data),
  getTicket: (id: string) => api.get<Ticket>(`/tickets/${id}`).then((res) => res.data),
  createTicket: (data: Partial<Ticket>) => api.post<Ticket>('/tickets', data).then((res) => res.data),
  updateTicket: (id: string, data: Partial<Ticket>) => api.patch<Ticket>(`/tickets/${id}`, data).then((res) => res.data),
  deleteTicket: (id: string) => api.delete(`/tickets/${id}`).then((res) => res.data),
};
