import api from './api';

export type TrainingType = 'INTERNAL' | 'EXTERNAL' | 'ONLINE' | 'CERTIFICATION';
export type TrainingMode = 'ONLINE' | 'OFFLINE' | 'HYBRID';
export type SessionStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type EnrollmentStatus = 'ENROLLED' | 'WAITLISTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { programs: number };
}

export interface TrainingSkill {
  skillId: string;
  skill: { id: string; name: string };
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  type: TrainingType;
  categoryId: string | null;
  durationHrs: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: TrainingCategory | null;
  skills: TrainingSkill[];
  _count?: { sessions: number };
}

export interface SessionTrainer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface TrainingSession {
  id: string;
  programId: string;
  title: string | null;
  startDate: string;
  endDate: string;
  mode: TrainingMode;
  venue: string | null;
  meetingUrl: string | null;
  maxCapacity: number | null;
  trainerId: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  program: TrainingProgram;
  trainer: SessionTrainer | null;
  _count?: { enrollments: number };
}

export interface EnrollmentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  designation: string | null;
  department: { id: string; name: string } | null;
}

export interface TrainingCertificate {
  id: string;
  enrollmentId: string;
  userId: string;
  programId: string;
  sessionId: string;
  certificateNo: string;
  issuedAt: string;
  expiresAt: string | null;
  program?: { id: string; name: string; type: TrainingType };
  session?: { id: string; title: string | null; startDate: string; endDate: string };
}

export interface TrainingFeedback {
  id: string;
  enrollmentId: string;
  userId: string;
  sessionId: string;
  rating: number;
  trainerRating: number | null;
  contentRating: number | null;
  comments: string | null;
  createdAt: string;
}

export interface SessionFeedbackSummary {
  count: number;
  avgRating: number | null;
  avgTrainerRating: number | null;
  avgContentRating: number | null;
  feedbacks: (TrainingFeedback & { user: { id: string; firstName: string | null; lastName: string | null } })[];
}

export interface TrainingEnrollment {
  id: string;
  sessionId: string;
  userId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  remarks: string | null;
  session?: TrainingSession;
  user?: EnrollmentUser;
  certificate?: TrainingCertificate | null;
  feedback?: TrainingFeedback | null;
}

export const trainingApi = {
  // Categories
  getCategories: () =>
    api.get<TrainingCategory[]>('/training/categories').then((r) => r.data),
  createCategory: (data: { name: string; description?: string }) =>
    api.post<TrainingCategory>('/training/categories', data).then((r) => r.data),
  updateCategory: (id: string, data: Partial<TrainingCategory>) =>
    api.patch<TrainingCategory>(`/training/categories/${id}`, data).then((r) => r.data),
  deleteCategory: (id: string) =>
    api.delete(`/training/categories/${id}`).then((r) => r.data),

  // Programs
  getPrograms: (params?: { categoryId?: string; type?: TrainingType; search?: string }) =>
    api.get<TrainingProgram[]>('/training/programs', { params }).then((r) => r.data),
  getProgram: (id: string) =>
    api.get<TrainingProgram>(`/training/programs/${id}`).then((r) => r.data),
  createProgram: (data: {
    name: string;
    description?: string;
    type: TrainingType;
    categoryId?: string;
    durationHrs: number;
    skillIds?: string[];
  }) => api.post<TrainingProgram>('/training/programs', data).then((r) => r.data),
  updateProgram: (id: string, data: Partial<TrainingProgram> & { skillIds?: string[] }) =>
    api.patch<TrainingProgram>(`/training/programs/${id}`, data).then((r) => r.data),
  deleteProgram: (id: string) =>
    api.delete(`/training/programs/${id}`).then((r) => r.data),

  // Sessions
  getSessions: (params?: { programId?: string; status?: SessionStatus; from?: string; to?: string }) =>
    api.get<TrainingSession[]>('/training/sessions', { params }).then((r) => r.data),
  getSession: (id: string) =>
    api.get<TrainingSession>(`/training/sessions/${id}`).then((r) => r.data),
  createSession: (data: {
    programId: string;
    title?: string;
    startDate: string;
    endDate: string;
    mode: TrainingMode;
    venue?: string;
    meetingUrl?: string;
    maxCapacity?: number;
    trainerId?: string;
  }) => api.post<TrainingSession>('/training/sessions', data).then((r) => r.data),
  updateSession: (id: string, data: Partial<TrainingSession>) =>
    api.patch<TrainingSession>(`/training/sessions/${id}`, data).then((r) => r.data),
  deleteSession: (id: string) =>
    api.delete(`/training/sessions/${id}`).then((r) => r.data),
  getSessionFeedback: (sessionId: string) =>
    api.get<SessionFeedbackSummary>(`/training/sessions/${sessionId}/feedback`).then((r) => r.data),

  // Enrollments
  enroll: (sessionId: string, userIds: string[]) =>
    api.post(`/training/sessions/${sessionId}/enroll`, { userIds }).then((r) => r.data),
  getSessionEnrollments: (sessionId: string) =>
    api.get<TrainingEnrollment[]>(`/training/sessions/${sessionId}/enrollments`).then((r) => r.data),
  updateEnrollment: (enrollmentId: string, data: { status: EnrollmentStatus; remarks?: string }) =>
    api.patch<TrainingEnrollment>(`/training/enrollments/${enrollmentId}`, data).then((r) => r.data),
  removeEnrollment: (enrollmentId: string) =>
    api.delete(`/training/enrollments/${enrollmentId}`).then((r) => r.data),
  submitFeedback: (
    enrollmentId: string,
    data: { rating: number; trainerRating?: number; contentRating?: number; comments?: string },
  ) =>
    api.post<TrainingFeedback>(`/training/enrollments/${enrollmentId}/feedback`, data).then((r) => r.data),
  getEnrollmentFeedback: (enrollmentId: string) =>
    api.get<TrainingFeedback | null>(`/training/enrollments/${enrollmentId}/feedback`).then((r) => r.data),

  // My Training
  getMyEnrollments: () =>
    api.get<TrainingEnrollment[]>('/training/my').then((r) => r.data),
  getMyCertificates: () =>
    api.get<TrainingCertificate[]>('/training/my/certificates').then((r) => r.data),
};
