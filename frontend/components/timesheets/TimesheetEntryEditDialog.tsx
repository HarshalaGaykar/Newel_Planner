'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { operationsApi, TaskEffortStatus, Timesheet, TimesheetEntry } from '@/lib/operations-api';
import { formatHours } from '@/lib/timesheet-format';
import { TaskType } from '@/lib/task-type-master-api';
import { tasksApi, Task } from '@/lib/tasks-api';
import { Project } from '@/lib/projects-api';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup,
  ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
// Radix Select doesn't allow an empty-string item value, so the "no specific
// subtask" choice needs its own sentinel, mapped back to '' in state.
const GENERAL_SUBTASK_VALUE = '__general__';

// Edit dialog is capped at 4 h per single entry.
const HOURS_DATA = Array.from({ length: 5 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}h`,
}));

const MINUTES_DATA = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5),
  label: `${String(i * 5).padStart(2, '0')}m`,
}));

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface Props {
  entry: TimesheetEntry | null;
  timesheet: Timesheet;
  projects: Project[];
  taskTypeMasterTree: TaskType[];
  canViewAll: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /**
   * Opens the dialog in create mode with no entry to edit — used by the calendar's
   * "fill" action on a day that has no hours yet. `createDate` (YYYY-MM-DD) seeds
   * the date field.
   */
  createDate?: string | null;
}

export default function TimesheetEntryEditDialog({
  entry, timesheet, projects, taskTypeMasterTree, canViewAll, onOpenChange, onSaved, createDate,
}: Props) {
  const isCreate = !entry && !!createDate;
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [subtaskId, setSubtaskId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTypeId, setTaskTypeId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [subActivityId, setSubActivityId] = useState('');
  const [hoursPart, setHoursPart] = useState(0);
  const [minutesPart, setMinutesPart] = useState(0);
  const [hourInput, setHourInput] = useState('');
  const [minuteInput, setMinuteInput] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  // Over-estimate warning for the selected task/subtask. `excludeEntryId` keeps
  // the entry being edited out of the logged total so it isn't counted twice.
  const [effortStatus, setEffortStatus] = useState<TaskEffortStatus | null>(null);

  // Create mode starts blank on the chosen date; nothing else to carry over.
  useEffect(() => {
    if (!isCreate || !createDate) return;
    setProjectId('');
    setTaskId('');
    setSubtaskId('');
    setTaskTypeId('');
    setActivityId('');
    setSubActivityId('');
    setHoursPart(0);
    setMinutesPart(0);
    setDate(createDate);
    setDescription('');
    setHourInput('');
    setMinuteInput('');
  }, [isCreate, createDate]);

  // Initialize form from the entry whenever the dialog opens with a new one.
  useEffect(() => {
    if (!entry) return;
    setProjectId(entry.projectId);
    const parentId = entry.task?.parentId ?? null;
    if (parentId) {
      setTaskId(parentId);
      setSubtaskId(entry.taskId ?? '');
    } else {
      setTaskId(entry.taskId ?? '');
      setSubtaskId('');
    }
    const hrs = Math.floor(entry.hours);
    setHoursPart(hrs);
    setMinutesPart(Math.round((entry.hours - hrs) * 60));
    setDate(entry.date ? new Date(entry.date).toISOString().split('T')[0] : '');
    setDescription(entry.description ?? '');
    setTaskTypeId(entry.taskSubActivity?.activity.taskType.id ?? '');
    setActivityId(entry.taskSubActivity?.activity.id ?? '');
    setSubActivityId(entry.taskSubActivityMasterId ?? '');
    setHourInput('');
    setMinuteInput('');
  }, [entry]);

  // Load tasks for the selected project (does not reset the current task — that
  // only happens on an explicit project change via handleProjectChange).
  useEffect(() => {
    if (!projectId || !timesheet.userId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    tasksApi.getTasks(projectId, undefined, undefined, canViewAll ? undefined : timesheet.userId)
      .then(data => {
        if (cancelled) return;
        setTasks(canViewAll ? data : data.filter(t => t.assigneeId === timesheet.userId));
      })
      .catch(() => { if (!cancelled) setTasks([]); });
    return () => { cancelled = true; };
  }, [projectId, timesheet.userId, canViewAll]);

  // Tier-1 picker options: real top-level tasks, plus any subtask whose own
  // parent didn't come back in `tasks` (e.g. assigned to someone else) — those
  // would otherwise be unreachable, so they're promoted to the top level.
  const { taskPickerItems, subtasksByTaskId } = useMemo(() => {
    const topLevel = tasks.filter(t => !t.parentId);
    const topLevelIds = new Set(topLevel.map(t => t.id));
    const orphanSubtasks = tasks.filter(t => t.parentId && !topLevelIds.has(t.parentId));

    const items = [
      ...topLevel.map(t => ({ id: t.id, label: t.title })),
      ...orphanSubtasks.map(t => ({
        id: t.id,
        label: t.parent ? `${t.title} (subtask of ${t.parent.title})` : t.title,
      })),
    ];

    const byTaskId = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.parentId && topLevelIds.has(t.parentId)) {
        byTaskId.set(t.parentId, [...(byTaskId.get(t.parentId) ?? []), t]);
      }
    });

    return { taskPickerItems: items, subtasksByTaskId: byTaskId };
  }, [tasks]);

  const subtaskOptions = subtasksByTaskId.get(taskId) ?? [];

  const activeTaskTypes = taskTypeMasterTree.filter(tt => tt.isActive);
  const taskTypeObj = activeTaskTypes.find(tt => tt.id === taskTypeId);
  const activeActivities = taskTypeObj?.activities.filter(a => a.isActive) ?? [];
  const activityObj = activeActivities.find(a => a.id === activityId);
  const activeSubActivities = activityObj?.subActivities.filter(s => s.isActive) ?? [];

  const hourOptions = useMemo(() => {
    const q = hourInput.trim();
    return q ? HOURS_DATA.filter(h => h.label.includes(q)) : HOURS_DATA;
  }, [hourInput]);

  const minuteOptions = useMemo(() => {
    const q = minuteInput.trim();
    return q ? MINUTES_DATA.filter(m => m.label.includes(q)) : MINUTES_DATA;
  }, [minuteInput]);

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setTaskId('');
    setSubtaskId('');
    setTaskTypeId('');
    setActivityId('');
    setSubActivityId('');
  };

  const handleTaskChange = async (id: string) => {
    setTaskId(id);
    setSubtaskId('');
    setActivityId('');
    setSubActivityId('');
    if (!id) {
      setTaskTypeId('');
      return;
    }
    try {
      const task = await tasksApi.getTask(id);
      let typeId = task.taskTypeMasterId ?? '';
      if (!typeId && task.parentId) {
        try {
          const parent = await tasksApi.getTask(task.parentId);
          typeId = parent.taskTypeMasterId ?? '';
        } catch {
          // parent lookup failed — leave empty, the warning will render
        }
      }
      setTaskTypeId(typeId);
    } catch {
      setTaskTypeId('');
    }
  };

  // ── Over-estimate warning ────────────────────────────────────────────────
  // Fetched per task/subtask selection; the projection is recomputed locally as
  // the duration is typed, so the banner updates without another round trip.
  const warningTaskId = subtaskId || taskId;
  const warningTypedHours = hoursPart + minutesPart / 60;
  const excludeEntryId = entry?.id;

  useEffect(() => {
    if (!warningTaskId) return;
    let cancelled = false;
    operationsApi
      .getTaskEffortStatus(warningTaskId, excludeEntryId ? { excludeEntryId } : undefined)
      .then((status) => { if (!cancelled) setEffortStatus(status); })
      .catch(() => { if (!cancelled) setEffortStatus(null); });
    return () => { cancelled = true; };
  }, [warningTaskId, excludeEntryId]);

  const effortNotice = useMemo(() => {
    // The taskId guard drops a response that arrived for a previously selected
    // task, so a stale status can never show against the new selection.
    if (!effortStatus || effortStatus.taskId !== warningTaskId) return null;
    // Unestimated tasks have nothing to compare against — stay silent.
    if (!effortStatus.applicable || !effortStatus.estimateHours) return null;
    const title = tasks.find(t => t.id === warningTaskId)?.title ?? 'this task';
    const projected = Math.round((effortStatus.loggedHours + warningTypedHours) * 10) / 10;
    const over = Math.round((projected - effortStatus.estimateHours) * 10) / 10;
    if (over <= 0) {
      return {
        over: false,
        text: `${formatHours(effortStatus.loggedHours)} of ${formatHours(effortStatus.estimateHours)} logged against “${title}”.`,
      };
    }
    return {
      over: true,
      text:
        `${formatHours(effortStatus.loggedHours)} already logged against “${title}”, which was estimated at ` +
        `${formatHours(effortStatus.estimateHours)}. This entry takes it to ${formatHours(projected)} — ` +
        `${formatHours(over)} over estimate.`,
    };
  }, [effortStatus, warningTypedHours, warningTaskId, tasks]);

  const handleSave = async () => {
    if (!entry && !isCreate) return;
    if (hoursPart === 0 && minutesPart === 0) {
      toast.error('Duration must be greater than 0h 0m');
      return;
    }
    if (hoursPart > 4 || (hoursPart === 4 && minutesPart > 0)) {
      toast.error('A single entry cannot exceed 4 hours. Please split into multiple entries.');
      return;
    }
    const effectiveTaskId = subtaskId || taskId;
    if (!projectId || !effectiveTaskId || !date) {
      toast.error('Project, task and date are required');
      return;
    }
    if (!subActivityId) {
      toast.error('Please select an Activity and Sub-Activity');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        projectId,
        date: new Date(date).toISOString(),
        hours: hoursPart + minutesPart / 60,
        taskId: effectiveTaskId,
        taskSubActivityMasterId: subActivityId,
        description,
      };
      if (entry) {
        const updated = await operationsApi.updateEntry(entry.id, payload);
        toast.success('Entry updated');
        if (updated.effortWarning) toast.warning(updated.effortWarning);
      } else {
        const created = await operationsApi.addEntry(timesheet.id, payload);
        toast.success('Entry added');
        if (created.effortWarning) toast.warning(created.effortWarning);
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, entry ? 'Failed to update entry' : 'Failed to add entry'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={entry != null || isCreate} onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Over-estimate warning for the selected task/subtask — soft, never blocks */}
          {effortNotice && (
            <div
              className={
                effortNotice.over
                  ? 'flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-sm'
                  : 'flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-sm'
              }
            >
              {effortNotice.over
                ? <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
              <span>{effortNotice.text}</span>
            </div>
          )}

          {/* Row 1: Project / Date / Task / Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project *</label>
              <Combobox
                data={projects.map(p => ({ value: p.id, label: p.name }))}
                type="project"
                value={projectId}
                onValueChange={handleProjectChange}
              >
                <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                <ComboboxContent>
                  <ComboboxInput />
                  <ComboboxEmpty>No projects found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxGroup>
                      {projects.map(p => (
                        <ComboboxItem key={p.id} value={p.id} keywords={[p.name]}>{p.name}</ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input type="date" required value={date}
                min={timesheet.startDate ? new Date(timesheet.startDate).toISOString().split('T')[0] : undefined}
                max={timesheet.endDate ? new Date(timesheet.endDate).toISOString().split('T')[0] : undefined}
                onChange={e => setDate(e.target.value)}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Allocated Task *</label>
              <Combobox
                data={taskPickerItems.map(t => ({ value: t.id, label: t.label }))}
                type="task"
                value={taskId}
                onValueChange={handleTaskChange}
              >
                <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                <ComboboxContent>
                  <ComboboxInput />
                  <ComboboxEmpty>{projectId ? 'No tasks found.' : 'Select a project first.'}</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxGroup>
                      {taskPickerItems.map(t => (
                        <ComboboxItem key={t.id} value={t.id} keywords={[t.label]}>{t.label}</ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration *</label>
              <div className="flex gap-2">
                <Combobox
                  data={HOURS_DATA}
                  type="hour"
                  value={String(hoursPart)}
                  onValueChange={(v) => { setHoursPart(Number(v)); setHourInput(''); }}
                  onOpenChange={(open) => { if (!open) setHourInput(''); }}
                >
                  <ComboboxTrigger className="w-24 justify-between" />
                  <ComboboxContent shouldFilter={false}>
                    <ComboboxInput value={hourInput} onValueChange={setHourInput} />
                    <ComboboxEmpty />
                    <ComboboxList>
                      <ComboboxGroup>
                        {hourOptions.map(o => (
                          <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <Combobox
                  data={MINUTES_DATA}
                  type="minute"
                  value={String(minutesPart)}
                  onValueChange={(v) => { setMinutesPart(Number(v)); setMinuteInput(''); }}
                  onOpenChange={(open) => { if (!open) setMinuteInput(''); }}
                >
                  <ComboboxTrigger className="w-24 justify-between" />
                  <ComboboxContent shouldFilter={false}>
                    <ComboboxInput value={minuteInput} onValueChange={setMinuteInput} />
                    <ComboboxEmpty />
                    <ComboboxList>
                      <ComboboxGroup>
                        {minuteOptions.map(o => (
                          <ComboboxItem key={o.value} value={o.value}>{o.label}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          </div>

          {/* Optional narrowing to a specific subtask — only shown when the
              selected task actually has subtasks. */}
          {subtaskOptions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Subtask <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Combobox
                  data={[
                    { value: GENERAL_SUBTASK_VALUE, label: 'General (no specific subtask)' },
                    ...subtaskOptions.map(t => ({ value: t.id, label: t.title })),
                  ]}
                  type="subtask"
                  value={subtaskId || GENERAL_SUBTASK_VALUE}
                  onValueChange={(v) => setSubtaskId(v === GENERAL_SUBTASK_VALUE ? '' : v)}
                >
                  <ComboboxTrigger className="w-full h-10 justify-between text-sm font-normal" />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxEmpty>No subtasks found.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        <ComboboxItem value={GENERAL_SUBTASK_VALUE}>General (no specific subtask)</ComboboxItem>
                        {subtaskOptions.map(t => (
                          <ComboboxItem key={t.id} value={t.id} keywords={[t.title]}>{t.title}</ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          )}

          {taskId && !taskTypeId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              This task has no task type assigned — please edit the task first to assign a type.
            </div>
          )}

          {/* Row 2: Activity / Sub-Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Activity *</label>
              <Combobox
                data={activeActivities.map(a => ({ value: a.id, label: a.name }))}
                type="activity"
                value={activityId}
                onValueChange={(v) => { setActivityId(v); setSubActivityId(''); }}
              >
                <ComboboxTrigger
                  disabled={!taskTypeId}
                  title={taskTypeId ? undefined : 'Select a task with a type first'}
                  className="w-full h-10 justify-between text-sm font-normal disabled:opacity-50"
                />
                <ComboboxContent>
                  <ComboboxInput />
                  <ComboboxEmpty>{taskTypeId ? 'No activities found.' : 'Select a task with a type first.'}</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxGroup>
                      {activeActivities.map(a => (
                        <ComboboxItem key={a.id} value={a.id} keywords={[a.name]}>{a.name}</ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sub-Activity *</label>
              <Combobox
                data={activeSubActivities.map(s => ({
                  value: s.id,
                  label: s.description ? `${s.name} — ${s.description}` : s.name,
                }))}
                type="sub-activity"
                value={subActivityId}
                onValueChange={setSubActivityId}
              >
                <ComboboxTrigger
                  disabled={!activityId}
                  title={activityId ? undefined : 'Select an activity first'}
                  className="w-full h-10 justify-between text-sm font-normal disabled:opacity-50"
                />
                <ComboboxContent>
                  <ComboboxInput />
                  <ComboboxEmpty>{activityId ? 'No sub-activities found.' : 'Select an activity first.'}</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxGroup>
                      {activeSubActivities.map(s => (
                        <ComboboxItem key={s.id} value={s.id} keywords={[s.name, s.description ?? '']}>
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            {s.description && <span className="text-xs text-muted-foreground">{s.description}</span>}
                          </div>
                        </ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          {/* Row 3: Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description / Comments</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full flex min-h-15 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="What did you work on?" />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : entry ? 'Save Changes' : 'Add Entry'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
