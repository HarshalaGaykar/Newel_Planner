'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, AlertCircle, Monitor, HardDrive, Key, UserCheck, Loader2, ArrowRightLeft, FileText, ChevronRight, ChevronDown, Laptop, Plug, Download } from 'lucide-react';
import { assetsApi, Asset } from '@/lib/assets-api';
import { clientsApi, Client } from '@/lib/clients-api';
import { locationsApi, Location } from '@/lib/locations-api';
import { usersApi, User as AppUser } from '@/lib/users-api';
import { projectsApi, Project } from '@/lib/projects-api';
import { usePermission } from '@/lib/hooks/usePermission';
import { SpokespersonCombobox } from '@/components/assets/SpokespersonCombobox';

type ApiError = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ApiError).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

function fmt(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function userName(u?: { firstName: string | null; lastName: string | null; email?: string } | null) {
  if (!u) return '—';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email || '—';
}

function inputCls() {
  return 'w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  HARDWARE: <Monitor className="h-4 w-4 text-blue-500" />,
  SOFTWARE: <HardDrive className="h-4 w-4 text-purple-500" />,
  LICENSE: <Key className="h-4 w-4 text-amber-500" />,
  LAPTOP: <Laptop className="h-4 w-4 text-cyan-500" />,
  CHARGER: <Plug className="h-4 w-4 text-emerald-500" />,
  OTHER: <FileText className="h-4 w-4 text-gray-500" />,
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  ALLOCATED: 'bg-blue-100 text-blue-700',
  IN_MAINTENANCE: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-gray-100 text-gray-600',
  LOST: 'bg-red-100 text-red-700',
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<Asset['type'] | ''>('');
  const [filterStatus, setFilterStatus] = useState<Asset['status'] | ''>('');
  const [filterClient, setFilterClient] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});

  const [modal, setModal] = useState<'create' | 'edit' | 'assign' | null>(null);
  const [current, setCurrent] = useState<Partial<Asset>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const { can } = usePermission();
  const canManage = can('ASSET_MANAGE') || true; // Assuming true for now

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, c, l, u] = await Promise.all([
        assetsApi.getAssets({
          type: filterType || undefined,
          status: filterStatus || undefined,
          clientId: filterClient || undefined,
          search: search || undefined,
        }),
        clientsApi.getClients().catch(() => []),
        locationsApi.getLocations().catch(() => []),
        usersApi.getUsers().catch(() => []),
      ]);
      setAssets(a);
      setClients(c);
      setLocations(l);
      setUsers(u);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load assets'));
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterClient, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  // Load the selected client's projects for the asset form's project dropdown.
  useEffect(() => {
    if (!current.clientId) {
      setClientProjects([]);
      return;
    }
    let cancelled = false;
    setProjectsLoading(true);
    projectsApi
      .getAll({ clientId: current.clientId })
      .then((data) => {
        if (!cancelled) setClientProjects(data);
      })
      .catch(() => {
        if (!cancelled) setClientProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current.clientId]);

  const toggleExpand = async (asset: Asset) => {
    const next = new Set(expanded);
    if (next.has(asset.id)) {
      next.delete(asset.id);
      setExpanded(next);
      return;
    }
    
    next.add(asset.id);
    setExpanded(next);

    if (!asset.history) {
      try {
        setHistoryLoading(p => ({ ...p, [asset.id]: true }));
        const fullAsset = await assetsApi.getAsset(asset.id);
        setAssets(prev => prev.map(a => a.id === asset.id ? fullAsset : a));
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setHistoryLoading(p => ({ ...p, [asset.id]: false }));
      }
    }
  };

  const openCreate = () => {
    setCurrent({ type: 'HARDWARE', status: 'AVAILABLE', isClientProvided: false });
    setModal('create');
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError('');
      await assetsApi.exportAssets({
        type: filterType || undefined,
        status: filterStatus || undefined,
        clientId: filterClient || undefined,
      });
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to export assets'));
    } finally {
      setExporting(false);
    }
  };

  const openEdit = (asset: Asset) => {
    setCurrent({ ...asset });
    setModal('edit');
  };

  const openAssign = (asset: Asset) => {
    setCurrent({ ...asset });
    setModal('assign');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await assetsApi.createAsset(current);
      } else if (modal === 'edit') {
        await assetsApi.updateAsset(current.id!, current);
      } else if (modal === 'assign') {
        await assetsApi.assignAsset(current.id!, {
          allocatedToId: current.allocatedToId || null,
          currentlyUsedById: current.currentlyUsedById || null,
          locationId: current.locationId || null,
          status: current.status,
          notes: current.notes,
        });
      }
      setModal(null);
      load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to save asset'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetsApi.deleteAsset(id);
      load();
    } catch (e: unknown) {
      alert(getErrorMessage(e, 'Failed to delete asset'));
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Asset Management</h1>
        <p className="text-slate-500 mt-1 text-sm">Track hardware and software licenses across your organization.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-9 h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500" value={filterType} onChange={(e) => setFilterType(e.target.value as Asset['type'] | '')}>
          <option value="">All Types</option>
          <option value="HARDWARE">Hardware</option>
          <option value="SOFTWARE">Software</option>
          <option value="LICENSE">License</option>
          <option value="LAPTOP">Laptop</option>
          <option value="CHARGER">Charger</option>
          <option value="OTHER">Other</option>
        </select>
        <select className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Asset['status'] | '')}>
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="ALLOCATED">Allocated</option>
          <option value="IN_MAINTENANCE">In Maintenance</option>
          <option value="RETIRED">Retired</option>
          <option value="LOST">Lost</option>
        </select>
        <select className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
          <option value="">All Owners (Internal & Client)</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 h-10 px-4 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download
        </button>

        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Asset
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm">
          <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No assets found</p>
          <p className="text-sm mt-1">Adjust filters or create a new asset to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Asset Tag & Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ownership</th>
                  <th className="px-4 py-3 font-medium">Allocated To</th>
                  <th className="px-4 py-3 font-medium">Currently Used By</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assets.map((asset) => (
                  <React.Fragment key={asset.id}>
                    <tr className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleExpand(asset)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                          {expanded.has(asset.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-md border border-slate-200">
                            {TYPE_ICONS[asset.type]}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{asset.assetTag}</p>
                            <p className="text-xs text-slate-500">{asset.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[asset.status]?.replace('bg-', 'border-').replace('100', '200')} ${STATUS_COLOR[asset.status]}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {asset.isClientProvided ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded w-max">
                            <UserCheck className="h-3.5 w-3.5" />
                            Client: {asset.client?.name || 'Unknown'}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-medium">Internal</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {userName(asset.allocatedTo)}
                      </td>
                      <td className="px-4 py-3">
                        {asset.currentlyUsedById !== asset.allocatedToId ? (
                          <span className="text-amber-600 font-medium flex items-center gap-1">
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                            {userName(asset.currentlyUsedBy)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAssign(asset)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Assign / Reassign">
                            <UserCheck className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(asset)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded History Row */}
                    {expanded.has(asset.id) && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={7} className="px-8 py-5">
                          <div className="grid grid-cols-3 gap-8">
                            <div className="col-span-1 space-y-4">
                              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Asset Details</h3>
                              <div className="text-xs space-y-2 text-slate-600">
                                <div className="flex justify-between"><span className="text-slate-400">Serial No:</span> <span className="font-medium text-slate-900">{asset.serialNumber || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Vendor:</span> <span className="font-medium text-slate-900">{asset.vendor || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Location:</span> <span className="font-medium text-slate-900">{asset.location?.name || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Purchase Date:</span> <span className="font-medium text-slate-900">{fmt(asset.purchaseDate as string)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Warranty Expiry:</span> <span className="font-medium text-slate-900">{fmt(asset.warrantyExpiry as string)}</span></div>
                              </div>
                              {asset.notes && (
                                <div className="mt-3 p-3 bg-white rounded-md border border-slate-200 text-xs text-slate-600">
                                  <strong>Notes:</strong> {asset.notes}
                                </div>
                              )}
                            </div>
                            
                            <div className="col-span-2">
                              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">Audit History</h3>
                              {historyLoading[asset.id] ? (
                                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading history...</div>
                              ) : asset.history && asset.history.length > 0 ? (
                                <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                  {asset.history.map((record) => (
                                    <div key={record.id} className="relative pl-4 border-l-2 border-indigo-100">
                                      <div className="absolute -left-1.5 top-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-slate-50"></div>
                                      <div className="text-xs text-slate-500 mb-0.5">{fmt(record.createdAt)} by <span className="font-medium text-slate-700">{userName(record.recordedBy)}</span></div>
                                      <div className="text-sm font-medium text-slate-900 mb-0.5">
                                        {record.action.replace('_', ' ')}
                                      </div>
                                      {record.notes && <p className="text-xs text-slate-600">{record.notes}</p>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">No history available.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{modal === 'create' ? 'Add New Asset' : 'Edit Asset'}</h2>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"><AlertCircle className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Asset Tag *</label>
                  <input
                    required
                    className={inputCls()}
                    value={current.assetTag || ''}
                    onChange={(e) => setCurrent({ ...current, assetTag: e.target.value })}
                    placeholder="e.g. LPT-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Name / Model *</label>
                  <input
                    required
                    className={inputCls()}
                    value={current.name || ''}
                    onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                    placeholder="e.g. MacBook Pro 16"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Type</label>
                  <select
                    className={inputCls()}
                    value={current.type || 'HARDWARE'}
                    onChange={(e) => setCurrent({ ...current, type: e.target.value as Asset['type'] })}
                  >
                    <option value="HARDWARE">Hardware</option>
                    <option value="SOFTWARE">Software</option>
                    <option value="LICENSE">License</option>
                    <option value="LAPTOP">Laptop</option>
                    <option value="CHARGER">Charger</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Status</label>
                  <select
                    className={inputCls()}
                    value={current.status || 'AVAILABLE'}
                    onChange={(e) => setCurrent({ ...current, status: e.target.value as Asset['status'] })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="ALLOCATED">Allocated</option>
                    <option value="IN_MAINTENANCE">In Maintenance</option>
                    <option value="RETIRED">Retired</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Serial Number / License Key</label>
                  <input
                    className={inputCls()}
                    value={current.serialNumber || ''}
                    onChange={(e) => setCurrent({ ...current, serialNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Vendor</label>
                  <input
                    className={inputCls()}
                    value={current.vendor || ''}
                    onChange={(e) => setCurrent({ ...current, vendor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Purchase Date</label>
                  <input
                    type="date"
                    className={inputCls()}
                    value={current.purchaseDate ? current.purchaseDate.split('T')[0] : ''}
                    onChange={(e) => setCurrent({ ...current, purchaseDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Warranty / Expiry Date</label>
                  <input
                    type="date"
                    className={inputCls()}
                    value={current.warrantyExpiry ? current.warrantyExpiry.split('T')[0] : ''}
                    onChange={(e) => setCurrent({ ...current, warrantyExpiry: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isClientProvided"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={current.isClientProvided || false}
                    onChange={(e) => setCurrent({ ...current, isClientProvided: e.target.checked })}
                  />
                  <label htmlFor="isClientProvided" className="text-sm font-semibold text-slate-700">Client Provided Asset</label>
                </div>
                
                {current.isClientProvided && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Client Owner *</label>
                      <select
                        required={current.isClientProvided}
                        className={inputCls()}
                        value={current.clientId || ''}
                        onChange={(e) =>
                          setCurrent({
                            ...current,
                            clientId: e.target.value,
                            // Spokesperson & project belong to a client — reset them when the client changes.
                            spokespersonId: undefined,
                            spokesperson: null,
                            projectId: undefined,
                            project: null,
                          })
                        }
                      >
                        <option value="">Select client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <SpokespersonCombobox
                      clientId={current.clientId}
                      value={current.spokespersonId}
                      initialLabel={current.spokesperson?.name}
                      onChange={(id, name) =>
                        setCurrent({
                          ...current,
                          spokespersonId: id,
                          spokesperson: id ? { id, name: name || '' } : null,
                        })
                      }
                    />

                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Project</label>
                      <select
                        className={inputCls()}
                        disabled={!current.clientId || projectsLoading}
                        value={current.projectId || ''}
                        onChange={(e) => {
                          const proj = clientProjects.find((p) => p.id === e.target.value);
                          setCurrent({
                            ...current,
                            projectId: e.target.value || undefined,
                            project: proj ? { id: proj.id, name: proj.name } : null,
                          });
                        }}
                      >
                        <option value="">
                          {!current.clientId
                            ? 'Please select a client'
                            : projectsLoading
                            ? 'Loading projects...'
                            : clientProjects.length === 0
                            ? 'No projects for this client'
                            : 'Select project...'}
                        </option>
                        {clientProjects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={current.notes || ''}
                  onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modal === 'create' ? 'Create Asset' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {modal === 'assign' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Assign Asset</h2>
              <p className="text-sm text-slate-500 mt-1">{current.assetTag} - {current.name}</p>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Officially Allocated To</label>
                <select
                  className={inputCls()}
                  value={current.allocatedToId || ''}
                  onChange={(e) => setCurrent({ ...current, allocatedToId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{userName(u)}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">The resource responsible for this asset.</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Currently Used By</label>
                <select
                  className={inputCls()}
                  value={current.currentlyUsedById || ''}
                  onChange={(e) => setCurrent({ ...current, currentlyUsedById: e.target.value })}
                >
                  <option value="">Same as allocated / None</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{userName(u)}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">If practically being used by someone else.</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Physical Location</label>
                <select
                  className={inputCls()}
                  value={current.locationId || ''}
                  onChange={(e) => setCurrent({ ...current, locationId: e.target.value })}
                >
                  <option value="">Select location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Asset Status</label>
                <select
                  className={inputCls()}
                  value={current.status || 'AVAILABLE'}
                  onChange={(e) => setCurrent({ ...current, status: e.target.value as Asset['status'] })}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="ALLOCATED">Allocated</option>
                  <option value="IN_MAINTENANCE">In Maintenance</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Assignment Notes</label>
                <input
                  className={inputCls()}
                  value={current.notes || ''}
                  onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
                  placeholder="Reason for reassignment..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
