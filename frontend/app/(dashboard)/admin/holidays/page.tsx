'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import {
  Calendar, Edit2, Trash2, Plus,
  Loader2, AlertCircle,
  Search, ChevronLeft, ChevronRight,
  CalendarDays, X, Check, Download, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLIDAY_TYPES = ['NATIONAL', 'REGIONAL', 'FESTIVAL', 'COMPANY', 'OTHER'] as const;

interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  type: string;
  description?: string;
}

interface HolidayUploadRow {
  name: string;
  date: string;
  type: string;
  description: string;
}

interface BulkUploadResult {
  total: number;
  results: { name: string; status: 'created' | 'skipped'; reason?: string }[];
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (inQuotes) throw new Error('The CSV contains an unclosed quoted value.');

  row.push(value.trim());
  if (row.some(cell => cell)) rows.push(row);
  return rows;
}

function parseHolidayCsv(text: string): HolidayUploadRow[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('The CSV must contain a header row and at least one holiday.');

  const headers = rows[0].map(header => header.trim().toLowerCase());
  const requiredHeaders = ['name', 'date'];
  const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Missing required CSV column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}.`);
  }

  const getValue = (row: string[], header: string) => row[headers.indexOf(header)]?.trim() ?? '';

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const name = getValue(row, 'name');
    const date = getValue(row, 'date');
    const type = (getValue(row, 'type') || 'NATIONAL').toUpperCase();
    const description = getValue(row, 'description');
    const parsedDate = new Date(`${date}T00:00:00Z`);

    if (!name) throw new Error(`Row ${rowNumber}: name is required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error(`Row ${rowNumber}: date must use YYYY-MM-DD format.`);
    }
    if (!HOLIDAY_TYPES.includes(type as (typeof HOLIDAY_TYPES)[number])) {
      throw new Error(`Row ${rowNumber}: type must be one of ${HOLIDAY_TYPES.join(', ')}.`);
    }

    return { name, date, type, description };
  });
}

function downloadHolidayCsvTemplate() {
  const csv = [
    'name,date,type,description',
    'Independence Day,2026-08-15,NATIONAL,Public holiday',
    'Diwali,2026-11-08,FESTIVAL,"Festival holiday, office closed"',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'holiday_master_template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function HolidayModal({
  holiday,
  onClose,
  onSave,
}: {
  holiday?: PublicHoliday;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: holiday?.name || '',
    date: holiday ? new Date(holiday.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    type: holiday?.type || 'NATIONAL',
    description: holiday?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (holiday) {
        await api.patch(`/public-holidays/${holiday.id}`, formData);
      } else {
        await api.post('/public-holidays', formData);
      }
      onSave();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to save holiday'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">{holiday ? 'Edit Holiday' : 'Declare Holiday'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="form-label">Holiday Name *</label>
            <input
              type="text"
              required
              className="field-input"
              placeholder="e.g. Independence Day"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Date *</label>
            <input
              type="date"
              required
              className="field-input"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select
              className="field-select"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="NATIONAL">National Holiday</option>
              <option value="REGIONAL">Regional Holiday</option>
              <option value="FESTIVAL">Religious Festival</option>
              <option value="COMPANY">Corporate Specific</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              rows={2}
              className="field-textarea"
              placeholder="Optional details..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {holiday ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkUploadModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<HolidayUploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setResults(null);
    try {
      const parsedHolidays = parseHolidayCsv(await file.text());
      setFileName(file.name);
      setHolidays(parsedHolidays);
    } catch (err) {
      setFileName('');
      setHolidays([]);
      setError(err instanceof Error ? err.message : 'Failed to read CSV file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!holidays.length) { setError('Please select a valid CSV file first.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post<BulkUploadResult>('/public-holidays/bulk-upload', { holidays });
      setResults(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to upload holidays'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-xl shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">Bulk Import Holidays</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {!results ? (
          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Required CSV Columns</p>
              <code className="block text-xs text-foreground font-mono">name,date,type,description</code>
              <p className="text-xs text-muted-foreground">
                Required: <span className="font-medium text-foreground">name</span> and <span className="font-medium text-foreground">date</span> in YYYY-MM-DD format.
                Optional: <span className="font-medium text-foreground">type</span> and <span className="font-medium text-foreground">description</span>.
              </p>
              <p className="text-xs text-muted-foreground">Type defaults to NATIONAL. Allowed values: {HOLIDAY_TYPES.join(', ')}.</p>
              <button type="button" onClick={downloadHolidayCsvTemplate} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <Download size={12} /> Download Template CSV
              </button>
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed rounded-lg p-6 text-center hover:bg-muted/20 transition-colors"
            >
              <Upload size={20} className="mx-auto text-muted-foreground mb-1" />
              <span className="block text-xs font-medium">{fileName || 'Click to select CSV file'}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {holidays.length ? `${holidays.length} holiday record${holidays.length !== 1 ? 's' : ''} ready` : 'Upload a .csv file using the template columns'}
              </span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            {holidays.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {holidays.map((holiday, index) => (
                      <tr key={`${holiday.date}-${index}`}>
                        <td className="px-2 py-1.5 font-medium">{holiday.name}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{holiday.date}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{holiday.type}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{holiday.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={handleUpload} disabled={loading || holidays.length === 0} className="btn-primary">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                Upload {holidays.length > 0 && `(${holidays.length})`}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Import Results</span>
                <span className="text-xs font-medium bg-blue-100 text-blue-600 px-2 py-0.5 rounded">{results.total} Processed</span>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {results.results.map((res, i) => (
                  <div key={i} className="p-2 bg-card border rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate pr-3">{res.name}</span>
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        res.status === 'created' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      )}>
                        {res.status}
                      </span>
                    </div>
                    {res.reason && <p className="text-xs text-red-600 mt-1">{res.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => { onSave(); onClose(); }} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HolidayMasterPage() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/public-holidays?year=${currentYear}`);
      setHolidays(res.data);
    } catch (err) {
      console.error('Failed to fetch holiday data', err);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  // Loading remote holiday data on mount and year changes is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await api.delete(`/public-holidays/${id}`);
      fetchData();
    } catch {
      alert('Failed to delete holiday');
    }
  };

  const filteredHolidays = holidays.filter(h =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const typeBadge = (type: string) => {
    switch (type) {
      case 'NATIONAL': return 'bg-orange-100 text-orange-600';
      case 'FESTIVAL': return 'bg-purple-100 text-purple-600';
      case 'COMPANY': return 'bg-blue-100 text-blue-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Holiday Calendar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Public holidays and institutional closures.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkModalOpen(true)} className="btn-secondary">Bulk Upload</button>
          <button onClick={() => { setEditingHoliday(undefined); setModalOpen(true); }} className="btn-primary">
            <Plus size={13} /> Add Holiday
          </button>
        </div>
      </div>

      {/* Year + Search bar */}
      <div className="bg-card border rounded-lg p-3 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 shrink-0">
          <button onClick={() => setCurrentYear(currentYear - 1)} className="p-1 hover:bg-card rounded transition-colors text-muted-foreground">
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold text-foreground w-12 text-center">{currentYear}</span>
          <button onClick={() => setCurrentYear(currentYear + 1)} className="p-1 hover:bg-card rounded transition-colors text-muted-foreground">
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search holidays..."
            className="field-input pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 shrink-0">
          <CalendarDays size={12} className="text-blue-600" />
          <span className="text-xs font-medium text-blue-600">{holidays.length} Events</span>
        </div>
      </div>

      {/* Holiday List */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground border-2 border-dashed m-4 rounded-lg">
            No holidays scheduled for {currentYear}.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredHolidays.map((h) => {
                const date = new Date(h.date);
                return (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div>
                      <div className="text-muted-foreground">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{h.name}</td>
                    <td className="px-3 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', typeBadge(h.type))}>
                        {h.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground line-clamp-1 max-w-xs">{h.description || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingHoliday(h); setModalOpen(true); }} className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => handleDelete(h.id)} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <HolidayModal
          holiday={editingHoliday}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); fetchData(); }}
        />
      )}
      {isBulkModalOpen && (
        <BulkUploadModal
          onClose={() => setBulkModalOpen(false)}
          onSave={() => { fetchData(); }}
        />
      )}
    </div>
  );
}
