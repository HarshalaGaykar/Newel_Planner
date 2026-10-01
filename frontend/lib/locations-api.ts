import api from './api';

export interface Location {
  id: string;
  name: string;
  city?: string;
  country?: string;
  timezone?: string;
  isActive?: boolean;
}

export const locationsApi = {
  getLocations: () => api.get<Location[]>('/locations').then(res => res.data),

  createLocation: (data: Partial<Location>) => 
    api.post<Location>('/locations', data).then(res => res.data),

  updateLocation: (id: string, data: Partial<Location>) =>
    api.patch<Location>(`/locations/${id}`, data).then(res => res.data),

  deleteLocation: (id: string) =>
    api.delete(`/locations/${id}`).then(res => res.data),
};
