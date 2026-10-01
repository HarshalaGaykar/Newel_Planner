import api from './api';

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type AssignmentTarget = 'USER' | 'DEPARTMENT' | 'ROLE';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
  updatedAt: string;
  _count?: { questions: number; tests: number };
}

export interface Question {
  id: string;
  bankId: string;
  text: string;
  type: QuestionType;
  options: QuestionOption[];
  correctOptions: string[];
  explanation: string | null;
  difficulty: Difficulty;
  marks: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TestQuestion {
  id: string;
  testId: string;
  questionId: string;
  order: number;
  marks: number | null;
  question: Question;
}

export interface TestAssignment {
  id: string;
  testId: string;
  target: AssignmentTarget;
  userId: string | null;
  departmentId: string | null;
  roleId: string | null;
  dueDate: string | null;
  user?: { id: string; firstName: string | null; lastName: string | null } | null;
  department?: { id: string; name: string } | null;
  role?: { id: string; name: string } | null;
}

export interface Test {
  id: string;
  title: string;
  description: string | null;
  bankId: string | null;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  instructions: string | null;
  status: TestStatus;
  createdById: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
  updatedAt: string;
  questions?: TestQuestion[];
  assignments?: TestAssignment[];
  _count?: { questions: number; assignments: number; attempts: number };
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptions: string[];
  isCorrect: boolean | null;
  marksObtained: number | null;
  question?: Partial<Question>;
}

export interface TestAttempt {
  id: string;
  testId: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  status: AttemptStatus;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  test?: Test;
  answers?: AttemptAnswer[];
}

export interface MyTest {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  status: TestStatus;
  dueDate: string | null;
  attempt: Pick<TestAttempt, 'id' | 'status' | 'score' | 'percentage' | 'passed' | 'submittedAt'> | null;
}

// ── Question Banks ──────────────────────────────────────────────────────────

export const getQuestionBanks = () =>
  api.get<QuestionBank[]>('/question-banks').then((r) => r.data);

export const getQuestionBank = (id: string) =>
  api.get<QuestionBank & { questions: Question[] }>(`/question-banks/${id}`).then((r) => r.data);

export const createQuestionBank = (data: { name: string; description?: string }) =>
  api.post<QuestionBank>('/question-banks', data).then((r) => r.data);

export const updateQuestionBank = (id: string, data: { name?: string; description?: string }) =>
  api.patch<QuestionBank>(`/question-banks/${id}`, data).then((r) => r.data);

export const deleteQuestionBank = (id: string) =>
  api.delete(`/question-banks/${id}`).then((r) => r.data);

// ── Questions ───────────────────────────────────────────────────────────────

export const getQuestions = (bankId: string) =>
  api.get<Question[]>('/questions', { params: { bankId } }).then((r) => r.data);

export const createQuestion = (data: {
  bankId: string;
  text: string;
  type?: QuestionType;
  options: QuestionOption[];
  correctOptions: string[];
  explanation?: string;
  difficulty?: Difficulty;
  marks?: number;
  tags?: string[];
}) => api.post<Question>('/questions', data).then((r) => r.data);

export const updateQuestion = (id: string, data: Partial<Parameters<typeof createQuestion>[0]>) =>
  api.patch<Question>(`/questions/${id}`, data).then((r) => r.data);

export const bulkCreateQuestions = (bankId: string, questions: Partial<Parameters<typeof createQuestion>[0]>[]) =>
  api.post('/questions/bulk', { bankId, questions }).then((r) => r.data);

export const deleteQuestion = (id: string) =>
  api.delete(`/questions/${id}`).then((r) => r.data);

// ── Tests ───────────────────────────────────────────────────────────────────

export const getTests = () =>
  api.get<Test[]>('/tests').then((r) => r.data);

export const getTest = (id: string) =>
  api.get<Test>(`/tests/${id}`).then((r) => r.data);

export const createTest = (data: {
  title: string;
  description?: string;
  bankId?: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  instructions?: string;
}) => api.post<Test>('/tests', data).then((r) => r.data);

export const updateTest = (id: string, data: Partial<Parameters<typeof createTest>[0]>) =>
  api.patch<Test>(`/tests/${id}`, data).then((r) => r.data);

export const publishTest = (id: string) =>
  api.patch<Test>(`/tests/${id}/publish`).then((r) => r.data);

export const closeTest = (id: string) =>
  api.patch<Test>(`/tests/${id}/close`).then((r) => r.data);

export const addTestQuestions = (
  id: string,
  questions: { questionId: string; order: number; marks?: number }[],
) => api.post(`/tests/${id}/questions`, { questions }).then((r) => r.data);

export const assignTest = (
  id: string,
  data: {
    target: AssignmentTarget;
    userId?: string;
    departmentId?: string;
    roleId?: string;
    dueDate?: string;
  },
) => api.post<TestAssignment>(`/tests/${id}/assign`, data).then((r) => r.data);

export const removeTestAssignment = (testId: string, assignmentId: string) =>
  api.delete(`/tests/${testId}/assign/${assignmentId}`).then((r) => r.data);

export const getTestResults = (id: string) =>
  api.get<TestAttempt[]>(`/tests/${id}/results`).then((r) => r.data);

export const deleteTest = (id: string) =>
  api.delete(`/tests/${id}`).then((r) => r.data);

// ── Test Attempts ────────────────────────────────────────────────────────────

export const getMyTests = () =>
  api.get<MyTest[]>('/test-attempts/my-tests').then((r) => r.data);

export const startAttempt = (testId: string) =>
  api.post<TestAttempt>('/test-attempts/start', { testId }).then((r) => r.data);

export const getAttempt = (attemptId: string) =>
  api.get<TestAttempt>(`/test-attempts/${attemptId}`).then((r) => r.data);

export const saveAnswer = (attemptId: string, questionId: string, selectedOptions: string[]) =>
  api.post(`/test-attempts/${attemptId}/answer`, { questionId, selectedOptions }).then((r) => r.data);

export const submitAttempt = (attemptId: string) =>
  api.post<TestAttempt>(`/test-attempts/${attemptId}/submit`).then((r) => r.data);

export const getAttemptResult = (attemptId: string) =>
  api.get<TestAttempt>(`/test-attempts/${attemptId}/result`).then((r) => r.data);
