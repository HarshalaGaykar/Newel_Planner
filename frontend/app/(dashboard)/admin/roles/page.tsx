'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Shield, Edit2, Trash2, ShieldCheck,
  Plus, Loader2, AlertCircle,
  X, CheckSquare, Square, Search,
  Lock, Settings, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Permission {
  id: string;
  name: string;
  description?: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: { permission: Permission }[];
  _count?: { users: number };
}

function RoleModal({
  role,
  allPermissions,
  onClose,
  onSave,
}: {
  role?: Role;
  allPermissions: Permission[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissionIds: role?.permissions.map(p => p.permission.id) || [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const groupedPermissions = allPermissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  const togglePermission = (id: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter(pid => pid !== id)
        : [...prev.permissionIds, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (role) {
        await api.patch(`/roles/${role.id}`, formData);
      } else {
        await api.post('/roles', formData);
      }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-lg">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-sm font-semibold">{role ? 'Edit Role' : 'New Role'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Role Name *</label>
                <input type="text" required className="field-input" placeholder="e.g. OPERATIONS_DIRECTOR"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Description</label>
                <input type="text" className="field-input" placeholder="Brief description..."
                  value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5 border-b pb-2">
                <Lock size={11} className="text-muted-foreground" /> Permissions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="space-y-1.5">
                    <h4 className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit">{category}</h4>
                    <div className="space-y-1">
                      {perms.map(p => (
                        <div
                          key={p.id}
                          onClick={() => togglePermission(p.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all text-xs",
                            formData.permissionIds.includes(p.id)
                              ? "bg-primary/10 border-primary/40 text-foreground"
                              : "bg-card border-border text-muted-foreground hover:border-border/60"
                          )}
                        >
                          {formData.permissionIds.includes(p.id) ? <CheckSquare size={12} className="text-primary shrink-0" /> : <Square size={12} className="shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{p.name.replace(/_/g, ' ')}</div>
                            {p.description && <div className="text-muted-foreground truncate">{p.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              {role ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRes, permRes] = await Promise.all([
        api.get('/roles'),
        api.get('/permissions')
      ]);
      setRoles(roleRes.data);
      setPermissions(permRes.data);
    } catch (err) {
      console.error('Failed to fetch roles & permissions data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this role? This may impact resource access.')) return;
    try {
      await api.delete(`/roles/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete role');
    }
  };

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Roles & Permissions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Role-based access control (RBAC).</p>
          </div>
        </div>
        <button onClick={() => { setEditingRole(undefined); setModalOpen(true); }} className="btn-primary">
          <Plus size={13} /> New Role
        </button>
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search roles..." className="field-input pl-8"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-blue-500" />
            <span>{roles.length} roles</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-orange-500" />
            <span>{permissions.length} permissions</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRoles.map((role) => (
            <div key={role.id} className="bg-card border rounded-lg p-3 shadow-sm hover:border-primary/30 transition-colors group flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Shield size={16} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingRole(role); setModalOpen(true); }} className="p-1 hover:bg-blue-50 text-blue-600 rounded transition-colors">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDelete(role.id)} className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-xs font-semibold text-foreground">{role.name.replace(/_/g, ' ')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 min-h-[28px]">
                  {role.description || 'No description.'}
                </p>

                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Users size={11} /> {role._count?.users || 0} members</div>
                    <div className="flex items-center gap-1"><Settings size={11} /> {role.permissions.length} permissions</div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 4).map(p => (
                      <span key={p.permission.id} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                        {p.permission.name.split('_').pop()}
                      </span>
                    ))}
                    {role.permissions.length > 4 && (
                      <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                        +{role.permissions.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredRoles.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No roles found.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <RoleModal
          role={editingRole}
          allPermissions={permissions}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}
