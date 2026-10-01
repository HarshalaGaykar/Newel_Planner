import api from './api';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: any;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  type: string;
  inApp: boolean;
  email: boolean;
}

export const notificationsApi = {
  getAll: (limit: number = 20) => 
    api.get<Notification[]>(`/user-alerts?limit=${limit}`),
  
  getUnread: () => 
    api.get<{ count: number; items: Notification[] }>('/user-alerts/unread'),
  
  markRead: (id: string) => 
    api.patch(`/user-alerts/${id}/read`),
  
  markAllRead: () => 
    api.patch('/user-alerts/mark-all-read'),
  
  getPreferences: () => 
    api.get<NotificationPreference[]>('/user-alerts/preferences'),
  
  updatePreference: (type: string, inApp: boolean, email: boolean) => 
    api.put('/user-alerts/preferences', { type, inApp, email }),
};
