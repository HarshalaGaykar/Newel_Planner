'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, AlertCircle, MapPin, Loader2, Globe, Clock } from 'lucide-react';
import { locationsApi, Location } from '@/lib/locations-api';
import { usePermission } from '@/lib/hooks/usePermission';

function inputCls() {
  return 'w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Location>>({});
  const [saving, setSaving] = useState(false);

  const { can } = usePermission();
  const canManage = can('ADMIN_CONFIG_VIEW') || true;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await locationsApi.getLocations();
      setLocations(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setCurrent({ isActive: true });
    setModal('create');
  };

  const openEdit = (loc: Location) => {
    setCurrent({ ...loc });
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await locationsApi.createLocation(current);
      } else {
        await locationsApi.updateLocation(current.id!, current);
      }
      setModal(null);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;
    try {
      await locationsApi.deleteLocation(id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to delete location');
    }
  };

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    (l.city && l.city.toLowerCase().includes(search.toLowerCase())) ||
    (l.country && l.country.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Location Master</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage physical office locations and facilities.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="w-full pl-9 h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            placeholder="Search locations by name, city, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Location
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
      ) : filteredLocations.length === 0 ? (
        <div className="text-center py-20 text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No locations found</p>
          <p className="text-sm mt-1">Adjust search or add a new location.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Location Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Timezone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLocations.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span className="font-semibold text-slate-900">{loc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{loc.city || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {loc.country ? (
                      <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-slate-400" /> {loc.country}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {loc.timezone ? (
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" /> {loc.timezone}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${loc.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {loc.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(loc)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(loc.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{modal === 'create' ? 'Add Location' : 'Edit Location'}</h2>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 p-6 space-y-5">
              
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Location Name *</label>
                <input
                  required
                  className={inputCls()}
                  value={current.name || ''}
                  onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                  placeholder="e.g. Head Office"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">City</label>
                <input
                  className={inputCls()}
                  value={current.city || ''}
                  onChange={(e) => setCurrent({ ...current, city: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Country</label>
                <input
                  className={inputCls()}
                  value={current.country || ''}
                  onChange={(e) => setCurrent({ ...current, country: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Timezone</label>
                <input
                  className={inputCls()}
                  value={current.timezone || ''}
                  onChange={(e) => setCurrent({ ...current, timezone: e.target.value })}
                  placeholder="e.g. Asia/Kolkata"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={current.isActive ?? true}
                  onChange={(e) => setCurrent({ ...current, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700">Active Location</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
