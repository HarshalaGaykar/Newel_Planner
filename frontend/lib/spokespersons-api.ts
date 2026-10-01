import api from './api';

export interface Spokesperson {
  id: string;
  name: string;
  clientId: string;
  isActive: boolean;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const spokespersonsApi = {
  getByClient: (clientId: string) =>
    api
      .get<Spokesperson[]>(`/spokespersons?clientId=${encodeURIComponent(clientId)}`)
      .then((res) => res.data),

  create: (data: { name: string; clientId: string }) =>
    api.post<Spokesperson>('/spokespersons', data).then((res) => res.data),
};
