import api from './api';

export interface DeliveryStage {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryStagePayload {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export const stageMasterApi = {
  /** `activeOnly` is what the tracker dropdown wants — retired stages stay
   *  readable on existing items but are not offered for new ones. */
  getStages: (activeOnly = false) =>
    api
      .get<DeliveryStage[]>('/delivery-stages', { params: activeOnly ? { activeOnly: 'true' } : {} })
      .then((res) => res.data),

  createStage: (data: DeliveryStagePayload) =>
    api.post<DeliveryStage>('/delivery-stages', data).then((res) => res.data),

  updateStage: (id: string, data: Partial<DeliveryStagePayload>) =>
    api.patch<DeliveryStage>(`/delivery-stages/${id}`, data).then((res) => res.data),

  deleteStage: (id: string) =>
    api.delete<DeliveryStage>(`/delivery-stages/${id}`).then((res) => res.data),
};
