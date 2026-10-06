'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  Upload,
  Search,
  Users,
  X,
  Loader2,
  AlertTriangle,
  Check,
  ToggleLeft,
  ToggleRight,
  Download,
  ChevronLeft,
  ChevronRight,
  Unlock,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { effectiveUserStatus } from '@/lib/user-status';
import { PermissionGate } from '@/components/auth/PermissionGate';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Role { id: string; name: string }
interface Department { id: string; name: string }
interface Skill { id: string; name: string }

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  employmentStatus: string;
  failedAttempts: number;
  role: Role;
  department: Department | null;
  reportingAuthorityId: string | null;
  reportingAuthority: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  skills: Skill[];
  createdAt: string;
}

interface UserFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  skillIds: string[];
  isActive: boolean;
  employmentStatus: string;
  reportingAuthorityId: string;
}

// Mirrors STATUS_TRANSITIONS in backend/src/users/users.service.ts. The Status
// dropdown only offers reachable states, so an illegal transition can't be
// submitted and rejected.
const EMPLOYMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['INACTIVE', 'RESIGNED', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'RESIGNED'],
  RESIGNED: [],
  TERMINATED: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    DRAFT: 'bg-muted text-muted-foreground border-border',
    INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200',
    LOCKED: 'bg-red-50 text-red-700 border-red-200',
    RESIGNED: 'bg-orange-50 text-orange-700 border-orange-200',
    TERMINATED: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', map[status] ?? map['INACTIVE'])}>
      {status || '—'}
    </span>
  );
}

function fullName(user: User) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || '—';
}

// ─── User Form Modal ──────────────────────────────────────────────────────────

interface UserFormModalProps {
  editUser: User | null;
  roles: Role[];
  departments: Department[];
  skills: Skill[];
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ editUser, roles, departments, skills, users, onClose, onSaved }: UserFormModalProps) {
  const isEdit = editUser !== null;
  const [form, setForm] = useState<UserFormState>({
    email: editUser?.email ?? '',
    password: '',
    firstName: editUser?.firstName ?? '',
    lastName: editUser?.lastName ?? '',
    roleId: editUser?.role?.id ?? '',
    departmentId: editUser?.department?.id ?? '',
    skillIds: editUser?.skills.map((s) => s.id) ?? [],
    isActive: editUser?.isActive ?? true,
    employmentStatus: editUser?.employmentStatus ?? 'ACTIVE',
    reportingAuthorityId: editUser?.reportingAuthorityId ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Current status plus whatever it can legally move to.
  const statusChoices = useMemo(() => {
    const current = editUser?.employmentStatus ?? 'ACTIVE';
    return [current, ...(EMPLOYMENT_STATUS_TRANSITIONS[current] ?? [])];
  }, [editUser?.employmentStatus]);

  function validate(): boolean {
    const e: Partial<Record<keyof UserFormState, string>> = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!isEdit && !form.password) e.password = 'Password is required';
    if (!isEdit && form.password && form.password.length < 8) e.password = 'Minimum 8 characters';
    if (isEdit && form.password && form.password.length < 8) e.password = 'Minimum 8 characters';
    if (!form.roleId) e.roleId = 'Role is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError(null);

    const payload: Record<string, unknown> = {
      email: form.email.trim().toLowerCase(),
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      roleId: form.roleId,
      departmentId: form.departmentId || null,
      reportingAuthorityId: form.reportingAuthorityId || null,
      skillIds: form.skillIds,
      isActive: form.isActive,
    };
    if (!isEdit) payload.password = form.password;
    if (isEdit && form.password) payload.password = form.password;
    // Only send the status when it actually changed — the backend validates
    // transitions, and an unchanged value has nothing to validate.
    if (isEdit && form.employmentStatus !== editUser.employmentStatus) {
      payload.employmentStatus = form.employmentStatus;
    }

    try {
      if (isEdit) {
        await api.patch(`/users/${editUser.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      onSaved();
    } catch (err: any) {
      setServerError(err.response?.data?.message ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  function toggleSkill(id: string) {
    setForm((f) => ({
      ...f,
      skillIds: f.skillIds.includes(id) ? f.skillIds.filter((s) => s !== id) : [...f.skillIds, id],
    }));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Jane"
                className="field-input"
              />
            </Field>
            <Field label="Last Name">
              <input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Doe"
                className="field-input"
              />
            </Field>
          </div>

          {/* Email */}
          <Field label="Email" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase().trim() }))}
              placeholder="jane@company.com"
              className={cn('field-input', errors.email && 'border-destructive')}
            />
          </Field>

          {/* Password */}
          <Field
            label={isEdit ? 'New Password' : 'Password'}
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? 'Leave blank to keep current' : undefined}
          >
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 8 characters"
              className={cn('field-input', errors.password && 'border-destructive')}
            />
          </Field>

          {/* Role */}
          <Field label="Role" required error={errors.roleId}>
            <select
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className={cn('field-input', errors.roleId && 'border-destructive')}
            >
              <option value="">— Select role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>

          {/* Department */}
          <Field label="Department">
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="field-input"
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>

          {/* Reporting Authority */}
          <Field label="Reporting Authority (RA)">
            <select
              value={form.reportingAuthorityId}
              onChange={(e) => setForm((f) => ({ ...f, reportingAuthorityId: e.target.value }))}
              className="field-input"
            >
              <option value="">— Select RA —</option>
              {users
                .filter(u => u.id !== editUser?.id) // Can't report to self
                .map((u) => (
                <option key={u.id} value={u.id}>{fullName(u)} ({u.email})</option>
              ))}
            </select>
          </Field>

          {/* Skills multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Skills</label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
              {skills.map((s) => {
                const checked = form.skillIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSkill(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-secondary',
                    )}
                  >
                    <div className={cn('h-4 w-4 rounded shrink-0 border flex items-center justify-center', checked ? 'bg-primary border-primary' : 'border-input')}>
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
              {skills.length === 0 && <p className="text-sm text-muted-foreground col-span-2 py-2">No skills defined</p>}
            </div>
          </div>

          {/* Status (edit only) + Active toggle */}
          <div className="flex items-center gap-4">
            {isEdit && (
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={form.employmentStatus}
                  onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))}
                  className="field-input"
                  disabled={statusChoices.length <= 1}
                >
                  {statusChoices.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {statusChoices.length <= 1 && (
                  <p className="text-xs text-muted-foreground">
                    {form.employmentStatus} is a final status — it cannot be changed.
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between flex-1">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Allow login</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} className="text-primary">
                {form.isActive ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md premium-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({ user, onClose, onDeleted }: { user: User; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/users/${user.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to delete user');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-destructive/10">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="font-bold">Delete User</h2>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm">
          Are you sure you want to delete <span className="font-semibold">{fullName(user)}</span>{' '}
          <span className="text-muted-foreground">({user.email})</span>?
        </p>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Bulk Upload Modal ────────────────────────────────────────────────────────

interface BulkResult { email: string; status: 'created' | 'skipped'; reason?: string }

const PAGE_SIZE = 10;

function BulkUploadModal({
  roles,
  departments,
  skills,
  onClose,
  onDone,
}: {
  roles: Role[];
  departments: Department[];
  skills: Skill[];
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkResult[] | null>(null);

  const roleMap = Object.fromEntries(roles.map((r) => [r.name.toUpperCase(), r.id]));
  const deptMap = Object.fromEntries(departments.map((d) => [d.name.toUpperCase(), d.id]));
  const skillMap = Object.fromEntries(skills.map((s) => [s.name.toUpperCase(), s.id]));

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setCsvRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target?.result as string);
        if (!rows[0].hasOwnProperty('email')) throw new Error('CSV must have an "email" column');
        setCsvRows(rows);
      } catch (err: any) {
        setParseError(err.message);
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    setUploading(true);
    try {
      const users = csvRows.map((row) => {
        const skillNames = (row.skills ?? '').split(';').map((s) => s.trim().toUpperCase()).filter(Boolean);
        return {
          email: row.email,
          password: row.password || 'Password@123',
          firstName: row.firstname || row.first_name || undefined,
          lastName: row.lastname || row.last_name || undefined,
          roleId: roleMap[row.role?.toUpperCase()] ?? roles[0]?.id,
          departmentId: deptMap[row.department?.toUpperCase()] ?? undefined,
          skillIds: skillNames.map((n) => skillMap[n]).filter(Boolean),
        };
      });
      const res = await api.post('/users/bulk-upload', { users });
      setResults(res.data.results);
    } catch (err: any) {
      setParseError(err.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const header = 'email,password,first_name,last_name,role,department,skills';
    const example = 'john@example.com,Password@123,John,Smith,USER,Engineering,TypeScript;React';
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const created = results?.filter((r) => r.status === 'created').length ?? 0;
  const skipped = results?.filter((r) => r.status === 'skipped').length ?? 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Upload className="h-5 w-5" /> Bulk Upload Users
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!results ? (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">email, password, first_name, last_name, role, department, skills</code>.
                Skills are separated by <code className="text-xs bg-muted px-1 py-0.5 rounded">;</code>.
              </p>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Download className="h-4 w-4" />
                Download template CSV
              </button>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">{csvRows.length ? `${csvRows.length} row(s) ready` : 'Click to select CSV file'}</p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </div>

              {parseError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {parseError}
                </div>
              )}

              {csvRows.length > 0 && (
                <div className="rounded-lg border border-border overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {Object.keys(csvRows[0]).map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-1.5 text-foreground">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{created}</p>
                  <p className="text-xs text-emerald-600 mt-1">Created</p>
                </div>
                <div className="flex-1 p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <p className="text-2xl font-bold text-amber-700">{skipped}</p>
                  <p className="text-xs text-amber-600 mt-1">Skipped</p>
                </div>
              </div>
              <div className="rounded-lg border border-border overflow-auto max-h-56">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className="px-3 py-1.5">
                          <span className={cn('font-medium', r.status === 'created' ? 'text-emerald-600' : 'text-amber-600')}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={results ? onDone : onClose} className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors">
            {results ? 'Done' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handleUpload}
              disabled={csvRows.length === 0 || uploading}
              className="px-4 py-2 rounded-md premium-gradient text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Upload {csvRows.length > 0 && `(${csvRows.length})`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
        {hint && <span className="text-muted-foreground text-xs ml-1">({hint})</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function UsersPageContent() {
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');

  const [editUser, setEditUser] = useState<User | null | undefined>(undefined);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [usersRes, rolesRes, deptsRes, skillsRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
        api.get('/departments'),
        api.get('/skills'),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setDepartments(deptsRes.data);
      setSkills(skillsRes.data);
    } catch {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUnlock(user: User) {
    setUnlockingId(user.id);
    try {
      await api.post(`/users/${user.id}/unlock`);
      await load();
    } catch {
      setError('Failed to unlock user');
    } finally {
      setUnlockingId(null);
    }
  }

  const [statusCardFilter, setStatusCardFilter] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE' | 'OFFBOARDED' | 'ALL'>('ACTIVE');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    let active = 0;
    let draft = 0;
    let inactive = 0;
    let offboarded = 0;

    for (const u of users) {
      const st = effectiveUserStatus(u);
      if (st === 'ACTIVE') active++;
      else if (st === 'DRAFT') draft++;
      else if (st === 'RESIGNED' || st === 'TERMINATED') offboarded++;
      else inactive++;
    }

    return {
      active,
      draft,
      inactive,
      offboarded,
      all: users.length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const st = effectiveUserStatus(u);

      if (statusCardFilter === 'ACTIVE' && st !== 'ACTIVE') return false;
      if (statusCardFilter === 'DRAFT' && st !== 'DRAFT') return false;
      if (statusCardFilter === 'INACTIVE' && st !== 'INACTIVE' && st !== 'LOCKED') return false;
      if (statusCardFilter === 'OFFBOARDED' && st !== 'RESIGNED' && st !== 'TERMINATED') return false;

      const q = search.toLowerCase();
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q) ||
        u.role.name.toLowerCase().includes(q) ||
        (u.department?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, statusCardFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamped rather than reset in an effect — a stale page after filtering would
  // otherwise render blank until the effect catches up.
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const isFormOpen = editUser !== undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-7 w-7" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, departments, and skills.</p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="USER_CREATE">
            <button
              onClick={() => setBulkOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Upload className="h-4 w-4" />
              Bulk Upload
            </button>
          </PermissionGate>
          <PermissionGate permission="USER_CREATE">
            <button
              onClick={() => setEditUser(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg premium-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add User
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Status Summary KPI Cards (Active by default, click to filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => { setStatusCardFilter('ACTIVE'); setPage(1); }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusCardFilter === 'ACTIVE'
              ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-emerald-950/40 shadow-sm'
              : 'bg-card border-border hover:bg-muted/40 hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Active</span>
            <span className="size-2 rounded-full bg-emerald-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1.5">{counts.active}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active employees (default)</p>
        </button>

        <button
          type="button"
          onClick={() => { setStatusCardFilter('INACTIVE'); setPage(1); }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusCardFilter === 'INACTIVE'
              ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 dark:bg-amber-950/40 shadow-sm'
              : 'bg-card border-border hover:bg-muted/40 hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Inactive</span>
            <span className="size-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1.5">{counts.inactive}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Inactive or locked</p>
        </button>

        <button
          type="button"
          onClick={() => { setStatusCardFilter('OFFBOARDED'); setPage(1); }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusCardFilter === 'OFFBOARDED'
              ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20 dark:bg-red-950/40 shadow-sm'
              : 'bg-card border-border hover:bg-muted/40 hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400">Resigned / Terminated</span>
            <span className="size-2 rounded-full bg-red-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1.5">{counts.offboarded}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Offboarded staff</p>
        </button>

        <button
          type="button"
          onClick={() => { setStatusCardFilter('ALL'); setPage(1); }}
          className={`text-left p-4 rounded-xl border transition-all ${
            statusCardFilter === 'ALL'
              ? 'bg-primary/5 border-primary ring-2 ring-primary/20 shadow-sm'
              : 'bg-card border-border hover:bg-muted/40 hover:border-border/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-primary">All Employees</span>
            <Users className="size-3.5 text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1.5">{counts.all}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Total registered users</p>
        </button>
      </div>

      {/* Search + table panel */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users…"
              className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background/50 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''} ({statusCardFilter === 'ACTIVE' ? 'Active only' : statusCardFilter === 'DRAFT' ? 'Drafts' : statusCardFilter === 'INACTIVE' ? 'Inactive' : statusCardFilter === 'OFFBOARDED' ? 'Resigned/Terminated' : 'All'})
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading users…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-destructive text-sm">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search
                ? 'No users match your search'
                : `No users found in status "${statusCardFilter === 'ACTIVE' ? 'Active' : statusCardFilter === 'DRAFT' ? 'Draft' : statusCardFilter === 'INACTIVE' ? 'Inactive' : statusCardFilter === 'OFFBOARDED' ? 'Resigned/Terminated' : 'All'}"`}
            </p>
            {statusCardFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => { setStatusCardFilter('ALL'); setPage(1); }}
                className="text-xs text-primary underline mt-1.5 font-medium"
              >
                View all {counts.all} users
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">RA</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skills</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{fullName(user)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                        {user.role.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.department?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {user.reportingAuthority ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-xs">{user.reportingAuthority.firstName} {user.reportingAuthority.lastName}</span>
                          <span className="text-xs text-muted-foreground">{user.reportingAuthority.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.skills.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          user.skills.slice(0, 3).map((s) => (
                            <span key={s.id} className="px-1.5 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                              {s.name}
                            </span>
                          ))
                        )}
                        {user.skills.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-xs text-muted-foreground">
                            +{user.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(effectiveUserStatus(user))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <PermissionGate permission="USER_UPDATE">
                          <button
                            onClick={() => setEditUser(user)}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </PermissionGate>
                        {effectiveUserStatus(user) === 'LOCKED' && (
                          <PermissionGate permission="USER_UPDATE">
                            <button
                              onClick={() => handleUnlock(user)}
                              disabled={unlockingId === user.id}
                              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                              title="Unlock"
                            >
                              {unlockingId === user.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Unlock className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </PermissionGate>
                        )}
                        <PermissionGate permission="USER_DELETE">
                          <button
                            onClick={() => setDeleteUser(user)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pager hidden on a single page — a lone "1 of 1" is just noise. */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {pageStart + 1}–{pageStart + pageRows.length} of {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isFormOpen && (
          <UserFormModal
            editUser={editUser}
            roles={roles}
            departments={departments}
            skills={skills}
            users={users}
            onClose={() => setEditUser(undefined)}
            onSaved={() => {
              setEditUser(undefined);
              load();
            }}
          />
        )}
        {deleteUser && (
          <DeleteModal
            user={deleteUser}
            onClose={() => setDeleteUser(null)}
            onDeleted={() => { setDeleteUser(null); load(); }}
          />
        )}
        {bulkOpen && (
          <BulkUploadModal
            roles={roles}
            departments={departments}
            skills={skills}
            onClose={() => setBulkOpen(false)}
            onDone={() => { setBulkOpen(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersPageContent />
    </Suspense>
  );
}
