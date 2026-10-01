import api from './api';

interface AssetClient {
  id: string;
  name: string;
}

interface AssetLocation {
  id: string;
  name: string;
}

interface AssetUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  type: 'HARDWARE' | 'SOFTWARE' | 'LICENSE' | 'LAPTOP' | 'CHARGER' | 'OTHER';
  status: 'AVAILABLE' | 'ALLOCATED' | 'IN_MAINTENANCE' | 'RETIRED' | 'LOST';
  serialNumber?: string | null;
  vendor?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  isClientProvided: boolean;
  clientId?: string | null;
  locationId?: string | null;
  allocatedToId?: string | null;
  currentlyUsedById?: string | null;
  spokespersonId?: string | null;
  projectId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: AssetClient | null;
  location?: AssetLocation | null;
  allocatedTo?: AssetUser | null;
  currentlyUsedBy?: AssetUser | null;
  spokesperson?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  history?: AssetHistory[];
}

export interface AssetHistory {
  id: string;
  assetId: string;
  action: string;
  previousUserId?: string;
  newUserId?: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
  recordedById: string;
  createdAt: string;
  recordedBy?: Omit<AssetUser, 'email'> | null;
}

export interface AssetPayload {
  assetTag?: string;
  name?: string;
  type?: Asset['type'];
  status?: Asset['status'];
  serialNumber?: string | null;
  vendor?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  isClientProvided?: boolean;
  clientId?: string | null;
  locationId?: string | null;
  allocatedToId?: string | null;
  currentlyUsedById?: string | null;
  spokespersonId?: string | null;
  projectId?: string | null;
  notes?: string | null;
}

export interface AssetQueryParams {
  type?: Asset['type'];
  status?: Asset['status'];
  clientId?: string;
  locationId?: string;
  userId?: string;
  search?: string;
}

export interface AssignAssetPayload {
  allocatedToId?: string | null;
  currentlyUsedById?: string | null;
  locationId?: string | null;
  status?: Asset['status'];
  notes?: string | null;
}

function nullableId(value?: string | null) {
  if (value === undefined) return undefined;
  return value || null;
}

function buildAssetPayload(data: Partial<Asset>): AssetPayload {
  return {
    assetTag: data.assetTag,
    name: data.name,
    type: data.type,
    status: data.status,
    serialNumber: data.serialNumber,
    vendor: data.vendor,
    purchaseDate: data.purchaseDate,
    warrantyExpiry: data.warrantyExpiry,
    isClientProvided: data.isClientProvided,
    clientId: data.isClientProvided === false ? null : nullableId(data.clientId),
    locationId: nullableId(data.locationId),
    allocatedToId: nullableId(data.allocatedToId),
    currentlyUsedById: nullableId(data.currentlyUsedById),
    spokespersonId: nullableId(data.spokespersonId),
    projectId: nullableId(data.projectId),
    notes: data.notes,
  };
}

export const assetsApi = {
  getAssets: (params?: AssetQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value as string);
      });
    }
    return api.get<Asset[]>(`/assets?${searchParams.toString()}`).then(res => res.data);
  },

  getAsset: (id: string) => api.get<Asset>(`/assets/${id}`).then(res => res.data),

  createAsset: (data: Partial<Asset>) =>
    api.post<Asset>('/assets', buildAssetPayload(data)).then(res => res.data),

  updateAsset: (id: string, data: Partial<Asset>) =>
    api.patch<Asset>(`/assets/${id}`, buildAssetPayload(data)).then(res => res.data),

  assignAsset: (id: string, data: AssignAssetPayload) =>
    api.patch<Asset>(`/assets/${id}/assign`, data).then(res => res.data),

  deleteAsset: (id: string) =>
    api.delete(`/assets/${id}`).then(res => res.data),

  exportAssets: async (params?: AssetQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value as string);
      });
    }
    const res = await api.get(`/assets/export?${searchParams.toString()}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(
      new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assets.xlsx');
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
