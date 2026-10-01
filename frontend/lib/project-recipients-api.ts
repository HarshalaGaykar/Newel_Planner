import api from './api';

export type RecipientRole = 'TO' | 'CC';

export interface RecipientClientContactOption {
  id: string;
  name: string;
  email: string;
}

export interface RecipientInternalUserOption {
  userId: string;
  name: string;
  email: string;
}

export interface ProjectRecipientsData {
  client: { id: string; name: string } | null;
  clientContacts: RecipientClientContactOption[];
  internalUsers: RecipientInternalUserOption[];
  mappedClientContacts: { clientContactId: string; role: RecipientRole }[];
  mappedInternalUsers: { userId: string; role: RecipientRole }[];
}

export interface SetProjectRecipientsPayload {
  clientContacts: { id: string; role: RecipientRole }[];
  internalUsers: { id: string; role: RecipientRole }[];
}

export const projectRecipientsApi = {
  get: (projectId: string) =>
    api.get<ProjectRecipientsData>(`/project-recipients/${projectId}`).then((r) => r.data),

  set: (projectId: string, data: SetProjectRecipientsPayload) =>
    api.put<ProjectRecipientsData>(`/project-recipients/${projectId}`, data).then((r) => r.data),
};
