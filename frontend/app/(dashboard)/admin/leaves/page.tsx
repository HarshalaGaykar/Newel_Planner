'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { operationsApi, AdminUserBalance } from '@/lib/operations-api';
import { formatLeaveDays } from '@/lib/leave-format';
import {
  Palmtree, Search, Upload, Edit2, AlertCircle, CheckCircle,
  RefreshCw, Download, X, Loader2,
} from 'lucide-react';

interface LeaveTypeInfo { code: string; name: string; isPaid: boolean }

interface EditForm {
  userId: string;
  userName: string;
  balances: { leaveTypeCode: string; leaveTypeName: string; earned: number; carryForward: number; used: number }[];
}

interface CsvRow { email: string; balances: Record<string, number> }

function typeColor(code: string) {
  const map: Record<string, string> = {
    CL: 'bg-blue-100 text-blue-700',
    SL: 'bg-rose-100 text-rose-700',
    EL: 'bg-emerald-100 text-emerald-700',
    LOP: 'bg-muted text-foreground',
    CO: 'bg-violet-100 text-violet-700',
  };
  return map[code] ?? 'bg-amber-100 text-amber-700';
}

function parseCSV(text: string): CsvRow[] | null {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim());
  const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
  if (emailIdx === -1) return null;
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const email = cols[emailIdx] ?? '';
    const balances: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (i === emailIdx) return;
      const val = cols[i];
      if (val !== '' && val !== undefined && !isNaN(Number(val))) {
        balances[h.toUpperCase()] = Number(val);
      }
    });
    return { email, balances };
  }).filter(r => r.email);
}

function buildCSVTemplate(leaveTypes: LeaveTypeInfo[]) {
  const codes = leaveTypes.map(lt => lt.code).join(',');
  return `email,${codes}\nuser@example.com,12,10,21`;
}

function EditModal({
  form, leaveTypes, onClose, onSave,
}: {
  form: EditForm;
  leaveTypes: LeaveTypeInfo[];
  onClose: () => void;
  onSave: (userId: string, changes: { leaveTypeCode: string; earnedBalance: number; carryForward: number }[]) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, { earned: string; carry: string }>>(
    () => Object.fromEntries(
      form.balances.map(b => [b.leaveTypeCode, { earned: String(b.earned), carry: String(b.carryForward) }])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const changes = Object.entries(values).map(([code, v]) => ({
      leaveTypeCode: code,
      earnedBalance: Number(v.earned) || 0,
      carryForward: Number(v.carry) || 0,
    }));
    try {
      setSaving(true);
      setError('');
      await onSave(form.userId, changes);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="flex min-h-full items-center justify-center py-8 px-4">
        <div className="bg-card rounded-lg shadow-lg w-full max-w-lg">
          <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Edit Leave Balances</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{form.userName}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
              <div>Type</div>
              <div>Earned</div>
              <div>Carry Fwd</div>
              <div>Used</div>
            </div>
            {form.balances.map(b => {
              const lt = leaveTypes.find(l => l.code === b.leaveTypeCode);
              const v = values[b.leaveTypeCode];
              return (
                <div key={b.leaveTypeCode} className="grid grid-cols-4 gap-2 items-center">
                  <div>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeColor(b.leaveTypeCode)}`}>
                      {lt?.name ?? b.leaveTypeCode}
                    </span>
                  </div>
                  <input type="number" min={0} step={0.5} value={v?.earned ?? '0'}
                    onChange={e => setValues(prev => ({ ...prev, [b.leaveTypeCode]: { ...prev[b.leaveTypeCode], earned: e.target.value } }))}
                    className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <input type="number" min={0} step={0.5} value={v?.carry ?? '0'}
                    onChange={e => setValues(prev => ({ ...prev, [b.leaveTypeCode]: { ...prev[b.leaveTypeCode], carry: e.target.value } }))}
                    className="w-full h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground pl-1">{b.used}</span>
                </div>
              );
            })}
            {error && (
              <div className="bg-destructive/10 text-destructive p-2 rounded flex items-center gap-2 text-xs font-medium">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>

          <div className="px-4 pb-4 flex gap-2 justify-end">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving && <Loader2 size={12} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CsvModal({
  leaveTypes, onClose, onDone,
}: {
  leaveTypes: LeaveTypeInfo[];
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ updated: number; errors: string[] } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed) {
        setParseError('Invalid CSV format. First row must contain "email" and leave type code columns.');
        setRows(null);
      } else {
        setParseError('');
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!rows) return;
    const updates = rows.flatMap(row =>
      Object.entries(row.balances).map(([leaveTypeCode, earnedBalance]) => ({
        email: row.email,
        leaveTypeCode,
        earnedBalance,
      }))
    );
    try {
      setUploading(true);
      const res = await operationsApi.bulkUpdateLeaveBalances(updates);
      setResult(res);
    } catch (err: any) {
      setParseError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = buildCSVTemplate(leaveTypes);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leave_balances_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="flex min-h-full items-center justify-center py-8 px-4">
        <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl">
          <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Bulk Upload Leave Balances</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Upload a CSV to update earned balances for all resources.</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors"><X size={14} /></button>
          </div>

          <div className="p-4 space-y-3">
            {!result ? (
              <>
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">CSV Format</p>
                  <code className="block text-xs text-foreground font-mono">
                    email,{leaveTypes.map(lt => lt.code).join(',')}<br />
                    user@company.com,12,10,21,0,0
                  </code>
                  <p className="text-xs text-muted-foreground">Leave cells blank to skip updating that leave type.</p>
                  <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <Download size={12} /> Download Template
                  </button>
                </div>

                <div
                  className="border border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={20} className="mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs font-medium">Click to select CSV file</p>
                  <p className="text-xs text-muted-foreground">or drag and drop</p>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                </div>

                {parseError && (
                  <div className="bg-destructive/10 text-destructive p-2 rounded flex items-center gap-2 text-xs font-medium">
                    <AlertCircle size={12} /> {parseError}
                  </div>
                )}

                {rows && rows.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Preview — {rows.length} user(s) found</p>
                    <div className="max-h-40 overflow-y-auto rounded border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Email</th>
                            {leaveTypes.map(lt => (
                              <th key={lt.code} className="px-2 py-1.5 text-center font-medium text-muted-foreground">{lt.code}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-2 py-1.5 text-muted-foreground">{row.email}</td>
                              {leaveTypes.map(lt => (
                                <td key={lt.code} className="px-2 py-1.5 text-center">
                                  {row.balances[lt.code] !== undefined
                                    ? <span className="font-medium">{row.balances[lt.code]}</span>
                                    : <span className="text-muted-foreground">—</span>
                                  }
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Upload Complete</p>
                    <p className="text-xs text-emerald-700">{result.updated} balance record(s) updated successfully.</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive">{result.errors.length} error(s)</p>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive bg-destructive/5 px-3 py-1 rounded">{e}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-4 pb-4 flex gap-2 justify-end">
            <button onClick={() => { onClose(); if (result) onDone(); }} className="btn-secondary">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleUpload} disabled={!rows || uploading} className="btn-primary">
                {uploading && <Loader2 size={12} className="animate-spin" />}
                {uploading ? 'Uploading…' : `Upload ${rows ? `(${rows.length} users)` : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminLeavesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeInfo[]>([]);
  const [users, setUsers] = useState<AdminUserBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await operationsApi.getAdminAllBalances();
      setLeaveTypes(data.leaveTypes);
      setUsers(data.users);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeCode ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const openEdit = (u: AdminUserBalance) => {
    setEditForm({
      userId: u.userId,
      userName: `${u.firstName} ${u.lastName} (${u.email})`,
      balances: u.balances.map(b => ({
        leaveTypeCode: b.leaveTypeCode,
        leaveTypeName: leaveTypes.find(lt => lt.code === b.leaveTypeCode)?.name ?? b.leaveTypeCode,
        earned: b.earned,
        carryForward: b.carryForward,
        used: b.used,
      })),
    });
  };

  const handleSave = async (
    userId: string,
    changes: { leaveTypeCode: string; earnedBalance: number; carryForward: number }[],
  ) => {
    await Promise.all(
      changes.map(c => operationsApi.updateLeaveBalance(userId, c.leaveTypeCode, c.earnedBalance, c.carryForward))
    );
    await fetchData();
  };

  if (loading) return <div className="py-20 text-center text-xs text-muted-foreground">Loading leave data…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Palmtree size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Leave Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">View and manage leave balances for all resources.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setCsvOpen(true)} className="btn-primary">
            <Upload size={12} /> Upload CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-xs font-medium">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {leaveTypes.map(lt => (
            <span key={lt.code} className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeColor(lt.code)}`}>
              {lt.name}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/30 border-b">
              <tr className="text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Employee</th>
                {leaveTypes.map(lt => (
                  <th key={lt.code} className="px-3 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${typeColor(lt.code)}`}>{lt.name}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {filtered.map(u => (
                <tr key={u.userId} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-3 py-2">
                    <p className="font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-muted-foreground">{u.email}</p>
                    {u.employeeCode && <p className="text-muted-foreground font-mono">{u.employeeCode}</p>}
                  </td>
                  {u.balances.map(b => {
                    const avail = b.available;
                    return (
                      <td key={b.leaveTypeCode} className="px-3 py-2 text-center">
                        <p className={`text-sm font-semibold ${avail <= 0 ? 'text-destructive' : avail <= 3 ? 'text-amber-600' : 'text-foreground'}`}>
                          {formatLeaveDays(avail)}
                        </p>
                        <p className="text-muted-foreground">{formatLeaveDays(b.earned)}e / {formatLeaveDays(b.used)}u</p>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => openEdit(u)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-medium ml-auto"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={leaveTypes.length + 2} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    {search ? 'No employees match your search.' : 'No employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t bg-muted/10 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} of {users.length} employee(s)</p>
          <p className="text-xs text-muted-foreground">Available = Earned + Carry − Used · Red = 0 · Amber ≤ 3</p>
        </div>
      </div>

      {editForm && (
        <EditModal form={editForm} leaveTypes={leaveTypes} onClose={() => setEditForm(null)} onSave={handleSave} />
      )}
      {csvOpen && (
        <CsvModal leaveTypes={leaveTypes} onClose={() => setCsvOpen(false)} onDone={fetchData} />
      )}
    </div>
  );
}
