import api from './api';

export interface ClientContact {
  id?: string;
  name: string;
  email: string;
}

export interface Client {
  id: string;
  clientCode: string;
  name: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  currencyId?: string;
  currency?: { id: string; code: string; symbol: string };
  contacts?: ClientContact[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const clientsApi = {
  getClients: () => api.get<Client[]>('/clients').then(res => res.data),
  
  getClient: (id: string) => api.get<Client>(`/clients/${id}`).then(res => res.data),

  createClient: (data: Partial<Client>) =>
    api.post<Client>('/clients', data).then(res => res.data),

  updateClient: (id: string, data: Partial<Client>) =>
    api.patch<Client>(`/clients/${id}`, data).then(res => res.data),

  deleteClient: (id: string) =>
    api.delete(`/clients/${id}`).then(res => res.data),
};
