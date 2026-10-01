'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { adminConfigApi, AdminConfig } from '@/lib/admin-api';
import {
  Settings, Hash, Lock, Calendar, Save, Plus, Trash2,
  CheckCircle2, Loader2, RefreshCw, ShieldCheck, Clock,
  Timer, Search, AlertCircle, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminConfigRow {
  key: string;
  value: string;
  label: string | null;
  group: string | null;
  updatedAt: string;
}

interface NumberSeries {
  module: string;
  prefix: string;
  lastSeq: number;
  padding: number;
  separator: string;
}

interface LockPeriod {
  id: string;
  month: number;
  year: number;
  isLocked: boolean;
  lockedAt: string;
  lockedBy: { firstName: string; lastName: string } | null;
}

interface FinancialYear {
  id: string;
  label: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  isCurrent: boolean;
}

type TabType = 'general' | 'schedulers' | 'numbers' | 'locks' | 'fy';

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKDATED_DAYS_KEY = 'timesheet.backdated_days_limit';
const BACKDATED_PRESETS = [7, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Groups that belong to the Schedulers tab */
const SCHEDULER_GROUPS = ['PROJECT', 'ATTENDANCE', 'ASSET'] as const;

/** Pretty display names for scheduler groups */
const SCHEDULER_GROUP_META: Record<string, { label: string; description: string; icon: string; color: string }> = {
  PROJECT: {
    label: 'Project Dormancy',
    description: 'Auto-inactivates projects with no timesheet activity beyond the threshold.',
    icon: '🏗️',
    color: 'blue',
  },
  ATTENDANCE: {
    label: 'Check-in Reminder',
    description: 'Sends missing check-in alerts to employees and reporting authorities.',
    icon: '🔔',
    color: 'amber',
  },
  ASSET: {
    label: 'Asset Confirmation',
    description: 'Monthly escalation workflow for asset allocation confirmations.',
    icon: '📦',
    color: 'purple',
  },
};

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive input type from a config key */
function inputTypeFor(key: string): 'toggle' | 'time' | 'cron' | 'timezone' | 'email' | 'number' | 'text' {
  const k = key.toLowerCase();
  if (k.endsWith('.enabled')) return 'toggle';
  if (k.endsWith('.run_time')) return 'time';
  if (k.endsWith('.cron')) return 'cron';
  if (k.endsWith('.time_zone')) return 'timezone';
  if (k.endsWith('_email')) return 'email';
  if (k.match(/\.(day_|threshold_months|max_)/)) return 'number';
  return 'text';
}

/** Build a human-readable "Next run at HH:mm" from run_time value */
function nextRunLabel(runTime: string | undefined, cronOverride: string | undefined): string {
  if (cronOverride?.trim()) return `Custom cron: ${cronOverride.trim()}`;
  if (runTime && /^\d{1,2}:\d{2}$/.test(runTime)) return `Daily at ${runTime}`;
  return 'Schedule not set';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SchedulerFieldInput({
  config,
  onSave,
  saving,
}: {
  config: AdminConfigRow;
  onSave: (key: string, value: string) => void;
  saving: boolean;
}) {
  const inputType = inputTypeFor(config.key);
  const [localValue, setLocalValue] = useState(config.value);
  const pendingSave = useRef(false);

  useEffect(() => {
    setLocalValue(config.value);
  }, [config.value]);

  const commit = (val: string) => {
    if (val !== config.value) {
      onSave(config.key, val);
    }
  };

  if (inputType === 'toggle') {
    const checked = localValue.toLowerCase() === 'true';
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          onCheckedChange={(val) => {
            const strVal = String(val);
            setLocalValue(strVal);
            onSave(config.key, strVal);
          }}
          disabled={saving}
        />
        {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  if (inputType === 'timezone') {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={localValue}
          onValueChange={(val) => {
            setLocalValue(val);
            onSave(config.key, val);
          }}
          disabled={saving}
        >
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz} className="text-xs">
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      <Input
        type={inputType === 'email' ? 'email' : inputType === 'number' ? 'number' : 'text'}
        value={localValue}
        className={cn(
          'h-8 text-xs',
          inputType === 'cron' && 'font-mono',
          inputType === 'time' && 'w-28',
          inputType === 'number' && 'w-24',
          inputType === 'email' && 'w-64',
          inputType === 'cron' && 'w-52',
        )}
        placeholder={
          inputType === 'time' ? 'HH:mm' :
          inputType === 'cron' ? 'e.g. 0 9 * * *' :
          inputType === 'email' ? 'email@example.com' : ''
        }
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={saving}
      />
      {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      {inputType === 'cron' && localValue && (
        <span title="Cron expression overrides Run Time. Clear this field to use Run Time instead.">
          <AlertCircle size={12} className="text-amber-500 cursor-help" />
        </span>
      )}
    </div>
  );
}

function SchedulerGroupCard({
  group,
  configs,
  onSave,
  saving,
  searchQuery,
}: {
  group: string;
  configs: AdminConfigRow[];
  onSave: (key: string, value: string) => void;
  saving: string | null;
  searchQuery: string;
}) {
  const meta = SCHEDULER_GROUP_META[group] ?? { label: group, description: '', icon: '⚙️', color: 'gray' };

  // Compute status from configs
  const enabledConfig = configs.find((c) => c.key.endsWith('.enabled'));
  const runTimeConfig = configs.find((c) => c.key.endsWith('.run_time'));
  const cronConfig = configs.find((c) => c.key.endsWith('.cron'));

  const isEnabled = enabledConfig?.value?.toLowerCase() === 'true';
  const scheduleLabel = nextRunLabel(runTimeConfig?.value, cronConfig?.value);

  // Filter by search
  const filtered = searchQuery
    ? configs.filter(
        (c) =>
          c.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.key.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : configs;

  if (filtered.length === 0) return null;

  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-200/50',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-200/50',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-200/50',
    gray: 'from-muted/30 to-muted/10 border-border',
  };

  const badgeColorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    gray: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br shadow-sm overflow-hidden',
      colorMap[meta.color] ?? colorMap.gray,
    )}>
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-inherit flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                isEnabled
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-red-100 text-red-600 border-red-200',
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', isEnabled ? 'bg-emerald-500' : 'bg-red-400')} />
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap',
          badgeColorMap[meta.color] ?? badgeColorMap.gray,
        )}>
          <Zap size={10} />
          {scheduleLabel}
        </div>
      </div>

      {/* Fields Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((config) => (
          <div key={config.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-foreground/80">
                {config.label || config.key.split('.').pop()}
              </label>
              {inputTypeFor(config.key) === 'cron' && (
                <span className="text-[9px] bg-amber-100 text-amber-600 border border-amber-200 px-1 rounded font-mono">
                  overrides Run Time
                </span>
              )}
            </div>
            <SchedulerFieldInput
              config={config}
              onSave={onSave}
              saving={saving === config.key}
            />
            <p className="text-[10px] text-muted-foreground/60 font-mono truncate">
              {config.key}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Schedulers Tab ───────────────────────────────────────────────────────

function SchedulersTab({
  configs,
  onSave,
  saving,
}: {
  configs: Record<string, AdminConfigRow[]>;
  onSave: (key: string, value: string) => void;
  saving: string | null;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('ALL');

  // Only scheduler groups
  const schedulerConfigs = Object.fromEntries(
    Object.entries(configs).filter(([g]) => SCHEDULER_GROUPS.includes(g as typeof SCHEDULER_GROUPS[number])),
  );

  const visibleGroups = activeGroup === 'ALL'
    ? SCHEDULER_GROUPS.filter((g) => schedulerConfigs[g])
    : SCHEDULER_GROUPS.filter((g) => g === activeGroup && schedulerConfigs[g]);

  const totalKeys = Object.values(schedulerConfigs).flat().length;
  const enabledCount = Object.values(schedulerConfigs)
    .flat()
    .filter((c) => c.key.endsWith('.enabled') && c.value.toLowerCase() === 'true').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Timer size={13} className="text-primary" />
          <span><strong className="text-foreground">{Object.keys(schedulerConfigs).length}</strong> schedulers</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span><strong className="text-foreground">{enabledCount}</strong> enabled</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings size={13} className="text-blue-500" />
          <span><strong className="text-foreground">{totalKeys}</strong> config keys</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
          <Zap size={11} />
          Schedule changes apply immediately — no restart needed
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search by label or key…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
          {(['ALL', ...SCHEDULER_GROUPS] as const).map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={cn(
                'px-3 py-1 rounded text-xs font-medium transition-all',
                activeGroup === g
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g === 'ALL' ? 'All' : (SCHEDULER_GROUP_META[g]?.label.split(' ')[0] ?? g)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {visibleGroups.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No scheduler configs match your search.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <SchedulerGroupCard
              key={group}
              group={group}
              configs={schedulerConfigs[group] ?? []}
              onSave={onSave}
              saving={saving}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminConfigPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [configs, setConfigs] = useState<Record<string, AdminConfigRow[]>>({});
  const [series, setSeries] = useState<NumberSeries[]>([]);
  const [locks, setLocks] = useState<LockPeriod[]>([]);
  const [fys, setFys] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, seriesRes, locksRes, fyRes] = await Promise.all([
        api.get('/admin-config'),
        api.get('/admin-config/number-series'),
        api.get('/admin-config/lock-periods'),
        api.get('/admin-config/financial-years'),
      ]);
      setConfigs(configRes.data);
      setSeries(seriesRes.data);
      setLocks(locksRes.data);
      setFys(fyRes.data);
    } catch (err) {
      console.error('Failed to fetch config data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateConfig = async (key: string, value: string) => {
    setSaving(key);
    try {
      await adminConfigApi.updateKey(key, value);
      // Optimistically update local state for immediate UI feedback
      setConfigs((prev) => {
        const next = { ...prev };
        for (const group of Object.keys(next)) {
          next[group] = next[group].map((c) =>
            c.key === key ? { ...c, value, updatedAt: new Date().toISOString() } : c,
          );
        }
        return next;
      });
    } catch {
      alert('Failed to update config');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateSeries = async (module: string, data: Partial<NumberSeries>) => {
    setSaving(`series-${module}`);
    try {
      await api.put(`/admin-config/number-series/${module}`, data);
      fetchData();
    } catch {
      alert('Failed to update number series');
    } finally {
      setSaving(null);
    }
  };

  const handleLockPeriod = async (month: number, year: number) => {
    try {
      await api.post('/admin-config/lock-periods', { month, year });
      fetchData();
    } catch {
      alert('Failed to lock period');
    }
  };

  const handleUnlockPeriod = async (id: string) => {
    try {
      await api.delete(`/admin-config/lock-periods/${id}`);
      fetchData();
    } catch {
      alert('Failed to unlock period');
    }
  };

  const handleSetCurrentFY = async (id: string) => {
    try {
      await api.patch(`/admin-config/financial-years/${id}/set-current`);
      fetchData();
    } catch {
      alert('Failed to set current FY');
    }
  };

  // Non-scheduler configs for the General tab
  const generalConfigs = Object.fromEntries(
    Object.entries(configs).filter(
      ([g]) => !(['PROJECT', 'ATTENDANCE', 'ASSET'] as string[]).includes(g),
    ),
  );

  const renderGeneralSettings = () => (
    <div className="space-y-4">
      {Object.entries(generalConfigs).map(([group, groupConfigs]) => (
        <div key={group} className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">{group} Configuration</h3>
            <ShieldCheck size={13} className="text-muted-foreground/40" />
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {groupConfigs.map((config) => (
              <div key={config.key} className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label">{config.label || config.key}</label>
                  {saving === config.key && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>

                {config.key === BACKDATED_DAYS_KEY ? (
                  <div className="flex flex-wrap gap-1.5">
                    {BACKDATED_PRESETS.map(days => (
                      <button
                        key={days}
                        onClick={() => handleUpdateConfig(config.key, String(days))}
                        disabled={saving === config.key}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                          Number(config.value) === days
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary hover:text-foreground',
                        )}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className="field-input pr-8"
                      defaultValue={config.value}
                      onBlur={(e) => {
                        if (e.target.value !== config.value) {
                          handleUpdateConfig(config.key, e.target.value);
                        }
                      }}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
                      <Save size={11} className="text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderNumberSeries = () => (
    <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-muted/30 border-b">
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Module</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Prefix</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Separator</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Padding</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-center">Last Seq</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-xs">
          {series.map((s) => (
            <tr key={s.module} className="hover:bg-muted/20 transition">
              <td className="px-3 py-2">
                <span className="text-foreground font-medium">{s.module}</span>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  className="bg-muted border-none rounded px-2 py-1 w-20 text-xs focus:ring-1 focus:ring-ring"
                  defaultValue={s.prefix}
                  onBlur={(e) => e.target.value !== s.prefix && handleUpdateSeries(s.module, { prefix: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  className="bg-muted border-none rounded px-2 py-1 w-14 text-xs text-center focus:ring-1 focus:ring-ring"
                  defaultValue={s.separator}
                  onBlur={(e) => e.target.value !== s.separator && handleUpdateSeries(s.module, { separator: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  className="bg-muted border-none rounded px-2 py-1 w-14 text-xs text-center focus:ring-1 focus:ring-ring"
                  defaultValue={s.padding}
                  onBlur={(e) => parseInt(e.target.value) !== s.padding && handleUpdateSeries(s.module, { padding: parseInt(e.target.value) })}
                />
              </td>
              <td className="px-3 py-2 text-center text-muted-foreground font-medium">{s.lastSeq}</td>
              <td className="px-3 py-2 text-right">
                <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs font-mono">
                  {s.prefix}{s.separator}{String(s.lastSeq + 1).padStart(s.padding, '0')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTimesheetLocks = () => {
    const currentYear = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const years = [currentYear, currentYear - 1];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {years.map(year => (
            <div key={year} className="bg-card p-3 rounded-lg border shadow-sm">
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar size={13} className="text-muted-foreground" /> {year}
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {months.map(month => {
                  const isLocked = locks.find(l => l.month === month && l.year === year);
                  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
                  return (
                    <button
                      key={month}
                      onClick={() => isLocked ? handleUnlockPeriod(isLocked.id) : handleLockPeriod(month, year)}
                      className={cn(
                        "py-1.5 rounded border transition-all flex flex-col items-center gap-0.5",
                        isLocked
                          ? "bg-red-50 border-red-200 text-red-600"
                          : "bg-muted border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      )}
                    >
                      <span className="text-xs font-medium">{monthName}</span>
                      {isLocked ? <Lock size={10} /> : <Clock size={10} className="opacity-30" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-primary p-4 rounded-lg shadow-sm text-primary-foreground relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xs font-semibold mb-3">Lock History</h3>
            <div className="space-y-2">
              {locks.length === 0 ? (
                <p className="text-xs opacity-70 py-6 text-center">No active locks found.</p>
              ) : (
                locks.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/10 border border-white/10">
                    <div>
                      <div className="font-medium text-xs">
                        {new Date(l.year, l.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {l.lockedBy?.firstName || 'System'} · {new Date(l.lockedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button onClick={() => handleUnlockPeriod(l.id)} className="p-1.5 hover:bg-white/10 rounded transition-colors text-red-300">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="absolute bottom-0 right-0 p-6 opacity-5 scale-150 rotate-12">
            <Lock size={80} />
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialYears = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary">
          <Plus size={12} /> Define New FY
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {fys.map((fy) => (
          <div key={fy.id} className={cn(
            "p-3 rounded-lg border transition-all",
            fy.isCurrent ? "bg-card border-primary shadow-sm" : "bg-card border-border hover:border-border"
          )}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{fy.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(fy.startYear, fy.startMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })} —
                  {new Date(fy.endYear, fy.endMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              {fy.isCurrent && (
                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-medium">Current</span>
              )}
            </div>

            <div className="flex gap-2">
              {!fy.isCurrent && (
                <button
                  onClick={() => handleSetCurrentFY(fy.id)}
                  className="flex-1 btn-secondary"
                >
                  <CheckCircle2 size={11} /> Set Current
                </button>
              )}
              <button className="p-1.5 bg-muted rounded text-red-400 hover:bg-red-50 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">System Configuration</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Root administration control panel.</p>
          </div>
        </div>

        <div className="flex p-1 bg-muted rounded-md gap-0.5 flex-wrap">
          {[
            { id: 'general', icon: Settings, label: 'General' },
            { id: 'schedulers', icon: Timer, label: 'Schedulers' },
            { id: 'numbers', icon: Hash, label: 'Number Series' },
            { id: 'locks', icon: Lock, label: 'Timesheet Locks' },
            { id: 'fy', icon: Calendar, label: 'Financial Years' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon size={12} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Loading configuration…</p>
        </div>
      ) : (
        <div>
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'schedulers' && (
            <SchedulersTab
              configs={configs}
              onSave={handleUpdateConfig}
              saving={saving}
            />
          )}
          {activeTab === 'numbers' && renderNumberSeries()}
          {activeTab === 'locks' && renderTimesheetLocks()}
          {activeTab === 'fy' && renderFinancialYears()}
        </div>
      )}
    </div>
  );
}
