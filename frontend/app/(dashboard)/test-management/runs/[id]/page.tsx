'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle,
  MinusCircle, SkipForward, Clock, Play, StopCircle,
  Save, Plus, FlaskConical, BarChart2, Bug, AlertTriangle,
} from 'lucide-react';
import {
  testManagementApi, TestRun, TestExecution, ExecutionResult, TestRunStatus,
} from '@/lib/test-management-api';
import { ticketsApi, Ticket } from '@/lib/tickets-api';
import { usePermission } from '@/lib/hooks/usePermission';

// ── helpers ───────────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<ExecutionResult, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  NOT_RUN: {
    label: 'Not Run',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  PASSED: {
    label: 'Passed',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  BLOCKED: {
    label: 'Blocked',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: <MinusCircle className="h-3.5 w-3.5" />,
  },
  SKIPPED: {
    label: 'Skipped',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    icon: <SkipForward className="h-3.5 w-3.5" />,
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const RUN_STATUS_COLOR: Record<TestRunStatus, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ABORTED: 'bg-red-100 text-red-600',
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Execution Row ─────────────────────────────────────────────────────────────

interface RowState {
  result: ExecutionResult;
  actualResult: string;
  notes: string;
  defectTicketId: string;
  stepResults: { stepOrder: number; result: ExecutionResult; actual?: string }[];
  dirty: boolean;
  saving: boolean;
}

function ExecutionRow({
  execution,
  canExecute,
  onSaved,
  projectId,
}: {
  execution: TestExecution;
  canExecute: boolean;
  onSaved: () => void;
  projectId: string;
}) {
  const [state, setState] = useState<RowState>({
    result: execution.result,
    actualResult: execution.actualResult || '',
    notes: execution.notes || '',
    defectTicketId: execution.defectTicketId || '',
    stepResults: execution.stepResults || [],
    dirty: false,
    saving: false,
  });
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (projectId) {
      ticketsApi.getTickets(projectId).then(setTickets).catch(() => setTickets([]));
    }
  }, [projectId]);

  const set = (patch: Partial<RowState>) =>
    setState((s) => ({ ...s, ...patch, dirty: true }));

  const handleSave = async () => {
    setState((s) => ({ ...s, saving: true }));
    setError('');
    try {
      await testManagementApi.updateExecution(execution.id, {
        result: state.result,
        actualResult: state.actualResult || undefined,
        notes: state.notes || undefined,
        defectTicketId: state.defectTicketId || undefined,
        stepResults: state.stepResults.length ? state.stepResults : undefined,
      });
      setState((s) => ({ ...s, dirty: false, saving: false }));
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Save failed');
      setState((s) => ({ ...s, saving: false }));
    }
  };

  const handleCreateBug = async () => {
    setState((s) => ({ ...s, saving: true }));
    setError('');
    try {
      const ticket: any = await testManagementApi.createBug(execution.id);
      setState((s) => ({ ...s, defectTicketId: ticket.id, saving: false, dirty: false }));
      onSaved();
      // Optionally reload the execution to get full ticket info
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Bug creation failed');
      setState((s) => ({ ...s, saving: false }));
    }
  };

  const cfg = RESULT_CONFIG[state.result];
  const tc = execution.case;

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/20 transition-colors">
        {/* Case title */}
        <td className="px-4 py-3 align-top">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-left font-medium hover:text-primary text-sm"
          >
            {tc?.title || '—'}
          </button>
          {tc?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tc.description}</p>
          )}
          {execution.retestRequired && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
              <AlertTriangle className="h-2.5 w-2.5" /> Retest Required
            </span>
          )}
        </td>
        {/* Priority */}
        <td className="px-4 py-3 align-top">
          {tc?.priority && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[tc.priority]}`}>
              {tc.priority}
            </span>
          )}
        </td>
        {/* Result selector */}
        <td className="px-4 py-3 align-top">
          {canExecute ? (
            <select
              className={`h-8 rounded-md border px-2 text-xs font-medium ${cfg.bg} ${cfg.color} border-transparent focus:outline-none focus:ring-1 focus:ring-ring`}
              value={state.result}
              onChange={(e) => set({ result: e.target.value as ExecutionResult })}
            >
              {(Object.keys(RESULT_CONFIG) as ExecutionResult[]).map((r) => (
                <option key={r} value={r}>{RESULT_CONFIG[r].label}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              {cfg.icon}{cfg.label}
            </span>
          )}
        </td>
        {/* Notes */}
        <td className="px-4 py-3 align-top min-w-[180px]">
          {canExecute ? (
            <input
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Notes…"
              value={state.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          ) : (
            <span className="text-xs text-muted-foreground">{state.notes || '—'}</span>
          )}
        </td>
        {/* Defect */}
        <td className="px-4 py-3 align-top">
          {canExecute ? (
            <div className="flex items-center gap-2">
              <select
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={state.defectTicketId}
                onChange={(e) => set({ defectTicketId: e.target.value })}
              >
                <option value="">— No defect —</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.type}] {t.title}
                  </option>
                ))}
              </select>
              {state.result === 'FAILED' && !state.defectTicketId && (
                <button
                  onClick={handleCreateBug}
                  disabled={state.saving}
                  className="flex items-center justify-center h-8 w-8 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                  title="Auto-create Bug Ticket"
                >
                  {state.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {execution.defectTicket?.title || '—'}
            </span>
          )}
        </td>
        {/* Executed by */}
        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
          {execution.executedBy
            ? [execution.executedBy.firstName, execution.executedBy.lastName].filter(Boolean).join(' ')
            : '—'}
        </td>
        {/* Save */}
        {canExecute && (
          <td className="px-4 py-3 align-top">
            {state.dirty && (
              <button
                onClick={handleSave}
                disabled={state.saving}
                className="flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {state.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </td>
        )}
      </tr>
      {/* Expanded steps */}
      {expanded && tc?.steps && tc.steps.length > 0 && (
        <tr className="bg-muted/10 border-b border-border">
          <td colSpan={canExecute ? 7 : 6} className="px-8 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Test Steps</p>
            <ol className="space-y-1.5">
              {tc.steps.map((step, i) => {
                const stepRes = state.stepResults.find((sr) => sr.stepOrder === step.order);
                const stepCfg = RESULT_CONFIG[stepRes?.result || 'NOT_RUN'];

                return (
                  <li key={i} className="group text-xs flex gap-3 p-2 hover:bg-muted/30 rounded transition-colors border border-transparent hover:border-border">
                    <span className="font-medium text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium">{step.action}</p>
                      {step.expected && (
                        <p className="text-muted-foreground mt-0.5 text-[11px]">→ {step.expected}</p>
                      )}
                      {stepRes?.actual && (
                        <p className="text-primary mt-1 italic text-[11px]">Actual: {stepRes.actual}</p>
                      )}
                    </div>
                    {canExecute && (
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(['PASSED', 'FAILED', 'BLOCKED'] as ExecutionResult[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              const news = [...state.stepResults.filter(s => s.stepOrder !== step.order), { stepOrder: step.order, result: r }];
                              set({ stepResults: news });
                            }}
                            className={`p-1 rounded border ${stepRes?.result === r ? RESULT_CONFIG[r].bg + ' ' + RESULT_CONFIG[r].color + ' border-current' : 'border-border hover:bg-muted text-muted-foreground'}`}
                            title={r}
                          >
                            {RESULT_CONFIG[r].icon}
                          </button>
                        ))}
                      </div>
                    )}
                    {!canExecute && stepRes && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${stepCfg.bg} ${stepCfg.color}`}>
                        {stepCfg.icon}{stepCfg.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {tc.expectedResult && (
              <p className="text-xs mt-2 text-muted-foreground">
                <span className="font-medium">Overall expected: </span>{tc.expectedResult}
              </p>
            )}
            {tc.preconditions && (
              <p className="text-xs mt-1 text-muted-foreground">
                <span className="font-medium">Preconditions: </span>{tc.preconditions}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<TestRun | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const { can } = usePermission();
  const canManage = can('TEST_MANAGE');
  const canExecute = can('TEST_EXECUTE') || canManage;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, s] = await Promise.all([
        testManagementApi.getRun(id),
        testManagementApi.getRunSummary(id),
      ]);
      setRun(r);
      setSummary(s);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status: TestRunStatus) => {
    if (!run) return;
    setStatusSaving(true);
    try {
      const updated = await testManagementApi.updateRun(run.id, { status });
      setRun(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const passed = summary['PASSED'] || 0;
  const failed = summary['FAILED'] || 0;
  const blocked = summary['BLOCKED'] || 0;
  const skipped = summary['SKIPPED'] || 0;
  const notRun = summary['NOT_RUN'] || 0;

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-md p-4">
          <AlertCircle className="h-4 w-4" />{error || 'Run not found'}
        </div>
      </div>
    );
  }

  const executions: TestExecution[] = run.executions || [];
  const statusCfg = RUN_STATUS_COLOR[run.status];

  return (
    <div className="p-6 space-y-6">
      {/* breadcrumb + header */}
      <div>
        <Link href="/test-management" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Test Management
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{run.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {run.sprint && <span>Sprint: {run.sprint.name}</span>}
                <span>· Environment: <span className="text-primary font-medium">{run.environment}</span></span>
                {run.plannedAt && <span>· Planned: {fmt(run.plannedAt)}</span>}
                {run.startedAt && <span>· Started: {fmt(run.startedAt)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg}`}>
              {run.status.replace('_', ' ')}
            </span>
            {canManage && run.status === 'PLANNED' && (
              <button
                onClick={() => changeStatus('IN_PROGRESS')}
                disabled={statusSaving}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {statusSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Start Run
              </button>
            )}
            {canManage && run.status === 'IN_PROGRESS' && (
              <button
                onClick={() => changeStatus('COMPLETED')}
                disabled={statusSaving}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {statusSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Complete
              </button>
            )}
          </div>
        </div>
        {run.description && <p className="text-sm text-muted-foreground mt-2">{run.description}</p>}
      </div>

      {/* summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-foreground', bg: 'bg-muted/50' },
          { label: 'Passed', value: passed, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Failed', value: failed, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Blocked', value: blocked, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Skipped', value: skipped, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Not Run', value: notRun, color: 'text-muted-foreground', bg: 'bg-muted/30' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-lg p-3 text-center`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* progress bar */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{passRate}% passing</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            {passed > 0 && <div className="bg-green-500 h-full transition-all" style={{ width: `${(passed / total) * 100}%` }} />}
            {failed > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${(failed / total) * 100}%` }} />}
            {blocked > 0 && <div className="bg-amber-400 h-full transition-all" style={{ width: `${(blocked / total) * 100}%` }} />}
            {skipped > 0 && <div className="bg-blue-300 h-full transition-all" style={{ width: `${(skipped / total) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Passed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Failed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Blocked</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" />Skipped</span>
          </div>
        </div>
      )}

      {/* execution grid */}
      {executions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No test cases in this run</p>
          <p className="text-sm mt-1">Go back and add cases to this run first.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Execution Grid</span>
            <span className="text-xs text-muted-foreground ml-1">({executions.length} cases · click a row to expand steps)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Test Case</th>
                  <th className="text-left px-4 py-3 font-medium w-28">Priority</th>
                  <th className="text-left px-4 py-3 font-medium w-36">Result</th>
                  <th className="text-left px-4 py-3 font-medium">Notes</th>
                  <th className="text-left px-4 py-3 font-medium w-32">Defect</th>
                  <th className="text-left px-4 py-3 font-medium w-32">Executed By</th>
                  {canExecute && <th className="px-4 py-3 w-24"></th>}
                </tr>
              </thead>
              <tbody>
                {executions.map((ex) => (
                  <ExecutionRow
                    key={ex.id}
                    execution={ex}
                    canExecute={canExecute}
                    projectId={run.projectId || ''}
                    onSaved={() => testManagementApi.getRunSummary(id).then(setSummary)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
