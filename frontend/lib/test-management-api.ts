import api from './api';

export type TestCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TestCaseStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
export type TestCaseType = 'MANUAL' | 'AUTOMATED';
export type TestCaseCategory = 'FUNCTIONAL' | 'UI' | 'API' | 'SECURITY' | 'PERFORMANCE' | 'OTHER';
export type TestRunStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
export type TestEnvironment = 'DEV' | 'STAGING' | 'UAT' | 'PRODUCTION' | 'OTHER';
export type ExecutionResult = 'NOT_RUN' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';

export interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  createdById: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
  updatedAt: string;
  _count?: { cases: number };
  cases?: TestCase[];
}

export interface TestCaseStep {
  order: number;
  action: string;
  expected: string;
}

export interface TestCase {
  id: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: TestCaseStep[];
  expectedResult: string | null;
  priority: TestCasePriority;
  status: TestCaseStatus;
  type: TestCaseType;
  category: TestCaseCategory;
  tags: string[];
  automationId: string | null;
  requirementId: string | null;
  lastResult: ExecutionResult | null;
  lastActualResult: string | null;
  lastExecutedAt: string | null;
  suiteId: string;
  suite?: { id: string; name: string; projectId?: string };
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string | null; lastName: string | null } | null;
  createdById: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
  executions?: TestExecution[];
}

export interface TestRun {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  sprintId: string | null;
  sprint?: { id: string; name: string } | null;
  status: TestRunStatus;
  environment: TestEnvironment;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdById: string;
  createdBy: { id: string; firstName: string | null; lastName: string | null };
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
  executions?: TestExecution[];
}

export interface TestExecution {
  id: string;
  runId: string;
  run?: { id: string; name: string };
  caseId: string;
  case?: TestCase;
  result: ExecutionResult;
  actualResult: string | null;
  stepResults: { stepOrder: number; result: ExecutionResult; actual?: string }[] | null;
  notes: string | null;
  defectTicketId: string | null;
  defectTicket?: { id: string; title: string; status: string } | null;
  executedById: string | null;
  executedBy?: { id: string; firstName: string | null; lastName: string | null } | null;
  executedAt: string | null;
  retestRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export const testManagementApi = {
  // ── Suites ──────────────────────────────────────────────────────────────────
  getSuites: (params?: { projectId?: string; search?: string }) =>
    api.get<TestSuite[]>('/test-management/suites', { params }).then((r) => r.data),

  getSuite: (id: string) =>
    api.get<TestSuite>(`/test-management/suites/${id}`).then((r) => r.data),

  createSuite: (data: { name: string; description?: string; projectId: string }) =>
    api.post<TestSuite>('/test-management/suites', data).then((r) => r.data),

  updateSuite: (id: string, data: { name?: string; description?: string }) =>
    api.patch<TestSuite>(`/test-management/suites/${id}`, data).then((r) => r.data),

  deleteSuite: (id: string) =>
    api.delete(`/test-management/suites/${id}`).then((r) => r.data),

  // ── Cases ────────────────────────────────────────────────────────────────────
  getCases: (params?: {
    suiteId?: string;
    priority?: TestCasePriority;
    status?: TestCaseStatus;
    type?: TestCaseType;
    category?: TestCaseCategory;
    search?: string;
  }) => api.get<TestCase[]>('/test-management/cases', { params }).then((r) => r.data),

  getCase: (id: string) =>
    api.get<TestCase>(`/test-management/cases/${id}`).then((r) => r.data),

  createCase: (data: {
    title: string;
    description?: string;
    preconditions?: string;
    steps?: TestCaseStep[];
    expectedResult?: string;
    priority?: TestCasePriority;
    status?: TestCaseStatus;
    type?: TestCaseType;
    category?: TestCaseCategory;
    tags?: string[];
    automationId?: string;
    requirementId?: string;
    suiteId: string;
    assignedToId?: string;
  }) => api.post<TestCase>('/test-management/cases', data).then((r) => r.data),

  updateCase: (id: string, data: {
    title?: string;
    description?: string;
    preconditions?: string;
    steps?: TestCaseStep[];
    expectedResult?: string;
    priority?: TestCasePriority;
    status?: TestCaseStatus;
    type?: TestCaseType;
    category?: TestCaseCategory;
    tags?: string[];
    automationId?: string;
    requirementId?: string;
    suiteId?: string;
    assignedToId?: string;
  }) => api.patch<TestCase>(`/test-management/cases/${id}`, data).then((r) => r.data),

  deleteCase: (id: string) =>
    api.delete(`/test-management/cases/${id}`).then((r) => r.data),

  // ── Runs ─────────────────────────────────────────────────────────────────────
  getRuns: (params?: { projectId?: string; sprintId?: string; status?: TestRunStatus }) =>
    api.get<TestRun[]>('/test-management/runs', { params }).then((r) => r.data),

  getRun: (id: string) =>
    api.get<TestRun>(`/test-management/runs/${id}`).then((r) => r.data),

  createRun: (data: {
    name: string;
    description?: string;
    projectId: string;
    sprintId?: string;
    environment?: TestEnvironment;
    plannedAt?: string;
    caseIds?: string[];
  }) => api.post<TestRun>('/test-management/runs', data).then((r) => r.data),

  updateRun: (id: string, data: {
    name?: string;
    description?: string;
    sprintId?: string;
    status?: TestRunStatus;
    environment?: TestEnvironment;
    plannedAt?: string;
  }) => api.patch<TestRun>(`/test-management/runs/${id}`, data).then((r) => r.data),

  deleteRun: (id: string) =>
    api.delete(`/test-management/runs/${id}`).then((r) => r.data),

  addCasesToRun: (id: string, caseIds: string[]) =>
    api.post<{ added: number }>(`/test-management/runs/${id}/cases`, { caseIds }).then((r) => r.data),

  getRunSummary: (id: string) =>
    api.get<Record<string, number>>(`/test-management/runs/${id}/summary`).then((r) => r.data),

  // ── Executions ───────────────────────────────────────────────────────────────
  updateExecution: (id: string, data: {
    result: ExecutionResult;
    actualResult?: string;
    notes?: string;
    defectTicketId?: string;
    retestRequired?: boolean;
    stepResults?: { stepOrder: number; result: ExecutionResult; actual?: string }[];
  }) => api.patch<TestExecution>(`/test-management/executions/${id}`, data).then((r) => r.data),
  
  createBug: (id: string) =>
    api.post(`/test-management/executions/${id}/bug`).then((r) => r.data),
};
