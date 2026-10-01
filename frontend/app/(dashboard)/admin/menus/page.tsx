'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Layout, Edit2, Trash2, Plus,
  Loader2, AlertCircle,
  X, ChevronRight, ChevronDown,
  Lock, ListTree, Settings,
  Layers, ExternalLink, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MENU_ICON_OPTIONS, MenuIcon } from '@/lib/menu-icons';

interface Permission {
  id: string;
  name: string;
}

interface MenuNode {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  order: number;
  parentId: string | null;
  children: MenuNode[];
  permissions: { permission: Permission }[];
}

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

function MenuModal({
  node,
  allNodes,
  allPermissions,
  onClose,
  onSave,
}: {
  node?: MenuNode;
  allNodes: MenuNode[];
  allPermissions: Permission[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: node?.name || '',
    path: node?.path || '',
    icon: node?.icon || '',
    order: node?.order || 0,
    parentId: node?.parentId || null as string | null,
    permissionIds: node?.permissions.map(p => p.permission.id) || [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const menuPayload = {
        name: formData.name,
        path: formData.path,
        icon: formData.icon || null,
        order: formData.order,
        parentId: formData.parentId,
      };

      if (node) {
        await api.patch(`/menu/${node.id}`, menuPayload);
        await api.patch(`/menu/${node.id}/permissions`, { permissionIds: formData.permissionIds });
      } else {
        const { data: newNode } = await api.post('/menu', menuPayload);
        if (formData.permissionIds.length > 0) {
          await api.patch(`/menu/${newNode.id}/permissions`, { permissionIds: formData.permissionIds });
        }
      }
      onSave();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save menu node'));
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (id: string) => {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter(pid => pid !== id)
        : [...prev.permissionIds, id]
    }));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-lg">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-sm font-semibold">{node ? 'Edit Menu Node' : 'New Menu Node'}</h2>
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
                <label className="form-label">Label</label>
                <input type="text" required className="field-input" placeholder="e.g. Dashboard"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Path</label>
                <input type="text" required className="field-input" placeholder="/dashboard"
                  value={formData.path} onChange={(e) => setFormData({ ...formData, path: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Icon</label>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                    <MenuIcon
                      icon={formData.icon}
                      fallback={<Layout size={14} className="text-muted-foreground" />}
                    />
                  </div>
                  <input
                    type="text"
                    list="menu-icon-options"
                    className="field-input"
                    placeholder="LayoutDashboard"
                    value={formData.icon || ''}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  />
                  <datalist id="menu-icon-options">
                    {MENU_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="form-label">Parent</label>
                <select className="field-select" value={formData.parentId || ''}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}>
                  <option value="">Top Level</option>
                  {allNodes.filter(n => n.id !== node?.id).map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Order</label>
                <input type="number" className="field-input"
                  value={formData.order} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })} />
              </div>
            </div>

            <div className="pt-2 border-t">
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Lock size={11} className="text-muted-foreground" /> Required Permissions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {allPermissions.map(p => (
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
                    <div className={cn(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                      formData.permissionIds.includes(p.id) ? "bg-primary border-primary" : "bg-muted border-border"
                    )}>
                      {formData.permissionIds.includes(p.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="font-medium truncate">{p.name.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
              {node ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MenuManagementPage() {
  const [menuTree, setMenuTree] = useState<MenuNode[]>([]);
  const [flatMenus, setFlatMenus] = useState<MenuNode[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<MenuNode | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes, permRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/flat'),
        api.get('/permissions')
      ]);
      setMenuTree(treeRes.data);
      setFlatMenus(flatRes.data);
      setPermissions(permRes.data);
    } catch (err) {
      console.error('Failed to fetch menu management data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu node?')) return;
    try {
      await api.delete(`/menu/${id}`);
      fetchData();
    } catch {
      alert('Failed to delete menu node');
    }
  };

  const renderNode = (node: MenuNode, depth = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded border transition-colors",
            depth === 0 ? "bg-card border-border" : "bg-muted/20 border-transparent hover:bg-muted/30"
          )}
          style={{ marginLeft: depth * 20 }}
        >
          <div
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={cn("text-muted-foreground", hasChildren ? "cursor-pointer" : "opacity-20")}
          >
            {hasChildren ? (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <MoreHorizontal size={12} />}
          </div>

          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs shrink-0">
            <MenuIcon
              icon={node.icon}
              className="h-3.5 w-3.5 text-muted-foreground"
              fallback={<Layout size={11} className="text-muted-foreground" />}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {node.name}
              {node.permissions.length > 0 && <Lock size={9} className="text-blue-500" />}
            </div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <ExternalLink size={9} /> {node.path}
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 border-x border-border hidden md:flex">
            <div className="text-center">
              <div className="text-xs font-medium text-foreground">{node.order}</div>
              <div className="text-xs text-muted-foreground">Order</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-medium text-foreground">{node.permissions.length}</div>
              <div className="text-xs text-muted-foreground">Gates</div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditingNode(node); setModalOpen(true); }}
              className="p-1.5 border rounded text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={() => handleDelete(node.id)}
              className="p-1.5 border rounded text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5 mt-0.5">
            {node.children.sort((a, b) => a.order - b.order).map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListTree size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">Menu Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Navigation architecture & routing.</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingNode(undefined); setModalOpen(true); }}
          className="btn-primary"
        >
          <Plus size={13} /> New Node
        </button>
      </div>

      <div className="bg-card border rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ListTree size={12} className="text-blue-500" />
            <span>{flatMenus.length} nodes</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Settings size={12} className="text-emerald-500" />
            <span>Live interface</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setExpandedIds(new Set(flatMenus.map(m => m.id)))} className="text-primary hover:underline">
            Expand all
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button onClick={() => setExpandedIds(new Set())} className="text-muted-foreground hover:underline">
            Collapse
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {loading ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          menuTree.sort((a, b) => a.order - b.order).map(node => renderNode(node))
        )}
        {!loading && menuTree.length === 0 && (
          <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            No menu nodes defined.
          </div>
        )}
      </div>

      {isModalOpen && (
        <MenuModal
          node={editingNode}
          allNodes={flatMenus}
          allPermissions={permissions}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}
