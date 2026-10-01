'use client';

import MultiSelector from '@/components/ui/multi-selector';
import { deriveDailyEffort } from '@/lib/daily-effort';
import { RefreshCw } from 'lucide-react';

const labelCls = 'text-xs font-black text-muted-foreground uppercase tracking-widest mb-1.5 block';
const selectCls = 'w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10';
const inputCls  = 'w-full border rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10';

export function PrioritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>Priority</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(p => (
          <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
        ))}
      </select>
    </div>
  );
}

export function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>Status</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="BACKLOG">Backlog</option>
        <option value="WIP">In Progress</option>
        <option value="QA">In Review</option>
        <option value="COMPLETED">Done</option>
      </select>
    </div>
  );
}

export function TaskTypeSelect({
  value,
  onChange,
  options,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: { id: string; name: string }[];
  loading?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>Task Type</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)} disabled={loading}>
        <option value="">-- Select Type --</option>
        {options?.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

export interface AssigneeOption { id: string; label: string; subLabel?: string; disabled?: boolean }

export function AssigneeSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: AssigneeOption[] }) {
  return (
    <div>
      <label className={labelCls}>Assignee</label>
      <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Unassigned</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function AssigneeMultiSelect({
  value, onChange, options, emptyHint,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: AssigneeOption[];
  emptyHint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>Assignees</label>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          {emptyHint || 'No allocated resources on this project.'}
        </p>
      ) : (
        <MultiSelector
          value={value}
          onValueChange={onChange}
          options={options.map(o => ({ value: o.id, label: o.label, subLabel: o.subLabel, disable: o.disabled }))}
          placeholder="Select assignees"
          maxCount={2}
          popoverClass="z-[10000]"
        />
      )}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {value.length} selected · first is the primary assignee
        </p>
      )}
    </div>
  );
}

export function EstimatedEffortInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>Estimated Effort (hours)</label>
      <input
        type="number"
        min={0}
        placeholder="e.g. 8"
        className={inputCls}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

export function DescriptionTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>Description</label>
      <textarea
        className={`${inputCls} min-h-[60px] resize-none`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Task details..."
      />
    </div>
  );
}

export interface CROption { id: string; crCode: string; title: string; status: string }

export function CRLinkSection({
  crId, phase, crs, onCrChange, onPhaseChange,
}: {
  crId: string;
  phase: string;
  crs: CROption[];
  onCrChange: (v: string) => void;
  onPhaseChange: (v: string) => void;
}) {
  const activeCrs = crs.filter(cr => !['CLOSED', 'DEFERRED', 'ON-HOLD', 'ON_HOLD'].includes(cr.status));
  if (activeCrs.length === 0 && !crId) return null;
  
  return (
    <div className="space-y-3 p-3 border border-dashed rounded-lg bg-secondary/20">
      <div>
        <label className={labelCls}>Link to Change Request</label>
        <select className={selectCls} value={crId} onChange={e => onCrChange(e.target.value)}>
          <option value="">No CR (regular task)</option>
          {activeCrs.map(cr => (
            <option key={cr.id} value={cr.id}>{cr.crCode} — {cr.title} ({cr.status})</option>
          ))}
          {crId && !activeCrs.find(c => c.id === crId) && (
             <option value={crId}>Currently Linked (Archived)</option>
          )}
        </select>
      </div>
      {crId && (
        <div>
          <label className={labelCls}>Phase</label>
          <select className={selectCls} value={phase} onChange={e => onPhaseChange(e.target.value)}>
            <option value="">No Phase</option>
            {['REQUIREMENT', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'UAT', 'DEPLOYMENT'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Editable "Daily Effort (h/day)" input. Auto-fills with the derived value
 *  (effort ÷ working days, Mon–Fri excl. holidays) while untouched; typing
 *  turns it into a manual override, and "Auto" snaps back to the derived value. */
export function DailyEffortField({
  effort,
  startDate,
  endDate,
  holidayDates,
  value,
  touched,
  onChange,
  onReset,
}: {
  effort: string;
  startDate?: string | null;
  endDate?: string | null;
  holidayDates: Set<string>;
  value: string;
  touched: boolean;
  onChange: (value: string, touched: boolean) => void;
  onReset: () => void;
}) {
  const hours = effort.trim() === '' ? null : Number(effort);
  const derived = deriveDailyEffort(
    hours != null && Number.isFinite(hours) ? hours : null,
    startDate,
    endDate,
    holidayDates,
  );
  const shown = touched ? value : derived != null ? String(derived.dailyEffort) : '';
  return (
    <div>
      <label className={labelCls}>
        Daily Effort (hours/day)
        {touched && (
          <button
            type="button"
            onClick={onReset}
            className="ml-2 inline-flex items-center gap-1 font-normal normal-case text-primary hover:underline"
            title="Recompute from effort and dates"
          >
            <RefreshCw size={10} /> Auto
          </button>
        )}
      </label>
      <input
        type="number"
        min={0}
        max={24}
        step={0.1}
        className={inputCls}
        value={shown}
        placeholder={derived != null ? String(derived.dailyEffort) : 'Add effort + dates'}
        onChange={(e) => onChange(e.target.value, true)}
      />
      <p className="text-[11px] text-muted-foreground mt-1">
        {touched
          ? 'Manual value — stays as typed until you switch back to Auto.'
          : 'Auto: estimate ÷ working days (Mon–Fri, excl. holidays). Type to override.'}
      </p>
    </div>
  );
}
