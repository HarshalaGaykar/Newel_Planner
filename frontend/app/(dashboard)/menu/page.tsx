'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  GripVertical,
  Shield,
  FolderTree,
  X,
  Loader2,
  Check,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { MENU_ICON_OPTIONS, MenuIcon } from '@/lib/menu-icons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface MenuPermissionItem {
  permission: Permission;
}

interface MenuItem {
  id: string;
  name: string;
  path: string;
  icon: string | null;
  order: number;
  isActive: boolean;
  parentId: string | null;
  children: MenuItem[];
  permissions: MenuPermissionItem[];
}

interface FlatMenuItem extends Omit<MenuItem, 'children'> {
  children?: FlatMenuItem[];
}

interface FormState {
  name: string;
  path: string;
  icon: string;
  parentId: string;
  order: string;
  isActive: boolean;
  permissionIds: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flattenTree(nodes: MenuItem[]): FlatMenuItem[] {
  const result: FlatMenuItem[] = [];
  const visit = (node: MenuItem) => {
    result.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PermissionBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      <Shield className="h-2.5 w-2.5" />
      {name}
    </span>
  );
}

interface TreeNodeProps {
  node: MenuItem;
  depth: number;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onEdit: (node: MenuItem) => void;
  onDelete: (node: MenuItem) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeNode({
  node,
  depth,
  draggedId,
  dragOverId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onDelete,
  expandedIds,
  onToggleExpand,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isDragging = draggedId === node.id;
  const isDragOver = dragOverId === node.id && draggedId !== node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        draggable
        onDragStart={() => onDragStart(node.id)}
        onDragOver={(e) => onDragOver(e, node.id)}
        onDrop={() => onDrop(node.id)}
        onDragEnd={onDragEnd}
        style={{ paddingLeft: depth * 24 + 8 }}
        className={cn(
          'group flex items-center gap-2 py-2 pr-3 rounded-lg transition-all cursor-grab active:cursor-grabbing select-none',
          isDragging && 'opacity-40',
          isDragOver && 'bg-primary/10 ring-1 ring-primary/40',
          !isDragging && !isDragOver && 'hover:bg-secondary',
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />

        <button
          onClick={() => hasChildren && onToggleExpand(node.id)}
          className={cn(
            'h-4 w-4 shrink-0 transition-transform',
            hasChildren ? 'text-muted-foreground hover:text-foreground' : 'invisible',
            isExpanded && 'rotate-90',
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground" aria-label="icon">
          <MenuIcon icon={node.icon} className="h-4 w-4" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-medium', !node.isActive && 'text-muted-foreground line-through')}>
              {node.name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{node.path}</span>
            {!node.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactive</span>
            )}
          </div>
          {node.permissions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {node.permissions.map(({ permission }) => (
                <PermissionBadge key={permission.id} name={permission.name} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <PermissionGate permission="MENU_UPDATE">
            <button
              onClick={() => onEdit(node)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>
          <PermissionGate permission="MENU_DELETE">
            <button
              onClick={() => onDelete(node)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGate>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                draggedId={draggedId}
                dragOverId={dragOverId}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onEdit={onEdit}
                onDelete={onDelete}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Menu Form Modal ──────────────────────────────────────────────────────────

interface MenuFormModalProps {
  editNode: MenuItem | null;
  flatMenus: FlatMenuItem[];
  allPermissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}

function MenuFormModal({ editNode, flatMenus, allPermissions, onClose, onSaved }: MenuFormModalProps) {
  const isEdit = editNode !== null;
  const [form, setForm] = useState<FormState>({
    name: editNode?.name ?? '',
    path: editNode?.path ?? '/',
    icon: editNode?.icon ?? '',
    parentId: editNode?.parentId ?? '',
    order: editNode?.order?.toString() ?? '0',
    isActive: editNode?.isActive ?? true,
    permissionIds: editNode?.permissions.map((p) => p.permission.id) ?? [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Exclude the item being edited and its descendants from parent choices
  const descendantIds = new Set<string>();
  if (editNode) {
    const collect = (node: FlatMenuItem) => {
      descendantIds.add(node.id);
      node.children?.forEach(collect);
    };
    const self = flatMenus.find((m) => m.id === editNode.id);
    if (self) collect(self as FlatMenuItem);
  }

  const parentChoices = flatMenus.filter(
    (m) => !descendantIds.has(m.id),
  );

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.path.trim()) e.path = 'Path is required';
    else if (!/^\/[a-zA-Z0-9\-/]*$/.test(form.path))
      e.path = 'Path must start with / and use only letters, numbers, hyphens, slashes';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        path: form.path.trim(),
        icon: form.icon.trim() || null,
        parentId: form.parentId || null,
        order: parseInt(form.order, 10) || 0,
        isActive: form.isActive,
      };

      if (isEdit) {
        await api.patch(`/menu/${editNode.id}`, payload);
        // Sync permissions separately
        await api.patch(`/menu/${editNode.id}/permissions`, {
          permissionIds: form.permissionIds,
        });
      } else {
        const res = await api.post('/menu', payload);
        if (form.permissionIds.length > 0) {
          await api.patch(`/menu/${res.data.id}/permissions`, {
            permissionIds: form.permissionIds,
          });
        }
      }
      onSaved();
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Failed to save menu');
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(id: string) {
    setForm((f) => ({
      ...f,
      permissionIds: f.permissionIds.includes(id)
        ? f.permissionIds.filter((p) => p !== id)
        : [...f.permissionIds, id],
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Menu' : 'New Menu'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {serverError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Dashboard"
              className={cn(
                'flex h-10 w-full rounded-md border bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errors.name ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Path */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Path <span className="text-destructive">*</span></label>
            <input
              value={form.path}
              onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
              placeholder="/dashboard"
              className={cn(
                'flex h-10 w-full rounded-md border bg-background/50 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                errors.path ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.path && <p className="text-xs text-destructive">{errors.path}</p>}
          </div>

          {/* Icon + Order row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Icon <span className="text-muted-foreground text-xs">(emoji / class)</span></label>
              <input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                list="legacy-menu-icon-options"
                placeholder="LayoutDashboard"
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <datalist id="legacy-menu-icon-options">
                {MENU_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Order</label>
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Parent */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Parent Menu</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— None (root) —</option>
              {parentChoices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.path})
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive menus are hidden from navigation</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className="text-primary"
            >
              {form.isActive ? (
                <ToggleRight className="h-7 w-7" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Permissions multi-select */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Required Permissions
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {allPermissions.map((p) => {
                const checked = form.permissionIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePermission(p.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-secondary',
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded shrink-0 border flex items-center justify-center',
                        checked ? 'bg-primary border-primary' : 'border-input',
                      )}
                    >
                      {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
              {allPermissions.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 py-2">No permissions available</p>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md premium-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Menu'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  node: MenuItem;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ node, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/menu/${node.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete menu');
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
            <h2 className="font-bold">Delete Menu</h2>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm">
          Are you sure you want to delete <span className="font-semibold">{node.name}</span>{' '}
          <span className="font-mono text-xs text-muted-foreground">({node.path})</span>?
        </p>

        {node.children?.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm border border-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            This menu has {node.children.length} child item(s). Remove them first.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || node.children?.length > 0}
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [tree, setTree] = useState<MenuItem[]>([]);
  const [flatMenus, setFlatMenus] = useState<FlatMenuItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editNode, setEditNode] = useState<MenuItem | null | undefined>(undefined); // undefined = closed
  const [deleteNode, setDeleteNode] = useState<MenuItem | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [treeRes, flatRes, permRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/flat'),
        api.get('/permissions'),
      ]);
      setTree(treeRes.data);
      setFlatMenus(flatRes.data);
      setAllPermissions(permRes.data);
      // Auto-expand root-level items
      setExpandedIds(new Set((treeRes.data as MenuItem[]).map((n) => n.id)));
    } catch {
      setError('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDragStart(id: string) {
    setDraggedId(id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  async function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    // Find the dragged item and target — they must share the same parentId
    const all = flatMenus;
    const dragged = all.find((m) => m.id === draggedId);
    const target = all.find((m) => m.id === targetId);

    if (!dragged || !target || dragged.parentId !== target.parentId) {
      handleDragEnd();
      return;
    }

    // Collect siblings (same parent, sorted by current order)
    const siblings = all
      .filter((m) => m.parentId === dragged.parentId)
      .sort((a, b) => a.order - b.order);

    // Remove dragged, insert before target
    const withoutDragged = siblings.filter((m) => m.id !== draggedId);
    const insertIdx = withoutDragged.findIndex((m) => m.id === targetId);
    withoutDragged.splice(insertIdx, 0, dragged);

    const reorderPayload = withoutDragged.map((m, i) => ({ id: m.id, order: i }));

    handleDragEnd();

    try {
      await api.patch('/menu/reorder', { items: reorderPayload });
      await load();
    } catch {
      // silently reload to reset state
      load();
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const isFormOpen = editNode !== undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FolderTree className="h-7 w-7" />
            Menu Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage navigation menus, hierarchy, and permission requirements.
          </p>
        </div>
        <PermissionGate permission="MENU_CREATE">
          <button
            onClick={() => setEditNode(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg premium-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Menu
          </button>
        </PermissionGate>
      </div>

      {/* Tree panel */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            Drag items within the same level to reorder
          </div>
          <span className="text-xs text-muted-foreground">
            {flatMenus.length} item{flatMenus.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading menus…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-destructive text-sm">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FolderTree className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No menus yet</p>
              <p className="text-xs mt-1">Click "Add Menu" to create your first menu item</p>
            </div>
          ) : (
            <div>
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  draggedId={draggedId}
                  dragOverId={dragOverId}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onEdit={(n) => setEditNode(n)}
                  onDelete={(n) => setDeleteNode(n)}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary/60" />
          Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted" />
          Inactive
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3" />
          Required permission
        </span>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isFormOpen && (
          <MenuFormModal
            editNode={editNode}
            flatMenus={flatMenus}
            allPermissions={allPermissions}
            onClose={() => setEditNode(undefined)}
            onSaved={() => {
              setEditNode(undefined);
              load();
            }}
          />
        )}
        {deleteNode && (
          <DeleteModal
            node={deleteNode}
            onClose={() => setDeleteNode(null)}
            onDeleted={() => {
              setDeleteNode(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
