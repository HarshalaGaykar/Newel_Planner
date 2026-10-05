import api from './api';

export interface AppFeature {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  iconName?: string;
  featureUrl?: string;
  demoVideoUrl?: string;
  isActive: boolean;
  publishedAt: string;
  isNew?: boolean; // Injected by backend if the user hasn't seen it
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export const whatsNewApi = {
  /**
   * Fetch the unread count for the Red Dot notification
   */
  getUnreadCount: () =>
    api.get<UnreadCountResponse>('/whats-new/unread-count').then((res) => res.data),

  /**
   * Fetch all features applicable to the user's role (for the Grid)
   */
  getFeatures: () =>
    api.get<AppFeature[]>('/whats-new').then((res) => res.data),

  /**
   * Clear the red dot by marking all features as seen
   */
  markAllSeen: () =>
    api.post('/whats-new/mark-all-seen').then((res) => res.data),

  /**
   * Mark a specific feature as seen (if handling individually)
   */
  markSeen: (id: string) =>
    api.post(`/whats-new/${id}/mark-seen`).then((res) => res.data),

  // ==========================================
  // ADMIN ONLY
  // ==========================================

  createFeature: (data: Partial<AppFeature> & { roles: string[] }) =>
    api.post<AppFeature>('/whats-new/admin', data).then((res) => res.data),

  getAllFeaturesAdmin: () =>
    api.get<AppFeature[]>('/whats-new/admin').then((res) => res.data),
};
