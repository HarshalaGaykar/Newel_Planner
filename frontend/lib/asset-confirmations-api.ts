import api from './api';

export interface ConfirmationAsset {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  usedByName: string;
}

export interface AssetConfirmationCurrent {
  period: string;
  monthLabel: string;
  status: 'PENDING' | 'CONFIRMED';
  confirmedAt: string | null;
  assetCount: number;
  assets: ConfirmationAsset[];
}

export const assetConfirmationsApi = {
  getCurrent: () =>
    api.get<AssetConfirmationCurrent>('/asset-confirmations/current').then((res) => res.data),

  confirm: () =>
    api.post('/asset-confirmations/confirm').then((res) => res.data),
};
