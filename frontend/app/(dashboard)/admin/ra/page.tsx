'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import {
  CheckCircle2, Search, Shield, Building2,
  Loader2, AlertCircle, X, UserPlus,
  GitBranch, Network, Link2,
  ChevronDown, ChevronRight, List, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
  ) {
    const message = (error as { response: { data: { message: unknown } } }).response.data.message;
    return Array.isArray(message) ? message.join(', ') : String(message);
  }

  return error instanceof Error ? error.message : fallback;
}

// Roles eligible to be selected as a Reporting Authority.
const RA_ELIGIBLE_ROLES = ['TL', 'ADMIN', 'HR', 'PM'];

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive?: boolean;
  designation?: string;
  grade?: string;
  role: { name: string };
  department?: { name: string };
  reportingAuthority?: { id: string; firstName: string | null; lastName: string | null; email: string };
}

interface TreeNode extends User {
  children: TreeNode[];
}

function buildTree(users: User[]): { roots: TreeNode[]; cycleIds: Set<string> } {
  const nodeMap = new Map<string, TreeNode>();
  users.forEach(u => nodeMap.set(u.id, { ...u, children: [] }));

  // Walk RA chain from userId to detect if it circles back to itself
  function isInCycle(userId: string): boolean {
    const seen = new Set<string>();
    let cur = nodeMap.get(userId)?.reportingAuthority?.id;
    while (cur && nodeMap.has(cur)) {
      if (cur === userId) return true;
      if (seen.has(cur)) return false; // different cycle, not involving userId
      seen.add(cur);
      cur = nodeMap.get(cur)?.reportingAuthority?.id;
    }
    return false;
  }

  const cycleIds = new Set<string>();
  nodeMap.forEach((_, id) => { if (isInCycle(id)) cycleIds.add(id); });

  const roots: TreeNode[] = [];
  nodeMap.forEach(node => {
    const raId = node.reportingAuthority?.id;
    if (!raId || !nodeMap.has(raId) || cycleIds.has(node.id)) {
      roots.push(node);
    } else {
      nodeMap.get(raId)!.children.push(node);
    }
  });
  return { roots, cycleIds };
}

function getUserName(user: Pick<User, 'firstName' | 'lastName' | 'email'>) {
  return [user.firstName, user.lastName].filter(isNonEmptyString).join(' ') || user.email;
}

function getUserInitials(user: Pick<User, 'firstName' | 'lastName' | 'email'>) {
  const nameParts = [user.firstName, user.lastName].filter(isNonEmptyString);
  if (nameParts.length > 0) return nameParts.map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function userMatchesSearch(user: User, searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;

  return [
    user.email,
    user.firstName,
    user.lastName,
    getUserName(user),
    user.role?.name,
    user.department?.name,
    user.designation,
    user.grade,
    user.reportingAuthority ? getUserName(user.reportingAuthority) : null,
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(query));
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function MappingModal({
  user, potentialRAs, onClose, onSave,
}: {
  user: User; potentialRAs: User[]; onClose: () => void; onSave: () => void;
}) {
  const [selectedRA, setSelectedRA] = useState(user.reportingAuthority?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.patch(`/users/${user.id}`, { reportingAuthorityId: selectedRA || null });
      onSave();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to update mapping'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="bg-background border rounded-lg p-4 w-full max-w-md shadow-lg max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">Set Reporting Authority</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground"><X size={14} /></button>
        </div>

        <div className="mb-3 p-2.5 bg-muted rounded-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {getUserInitials(user)}
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">{getUserName(user)}</div>
            <div className="text-xs text-muted-foreground">{user.role.name}</div>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded text-red-600 text-xs flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="form-label">Reporting Authority</label>
            <select className="field-select" value={selectedRA} onChange={(e) => setSelectedRA(e.target.value)}>
              <option value="">No Authority (Independent)</option>
              {potentialRAs.filter(r => r.id !== user.id).map(ra => (
                <option key={ra.id} value={ra.id}>{getUserName(ra)} ({ra.email})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Hierarchy tree node ──────────────────────────────────────────────────────

function TreeNodeRow({
  node, depth, onEdit, cycleIds,
}: {
  node: TreeNode; depth: number; onEdit: (u: User) => void; cycleIds?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 group hover:bg-muted/40 rounded-lg px-2 py-1.5 transition-colors"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {/* expand/collapse toggle */}
        <button
          className={cn('shrink-0 text-muted-foreground transition-colors', hasChildren ? 'hover:text-foreground' : 'invisible')}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* connector line for non-root */}
        {depth > 0 && (
          <GitBranch size={11} className="shrink-0 text-muted-foreground/40" />
        )}

        {/* avatar */}
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0',
          depth === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          {getUserInitials(node)}
        </div>

        {/* name + role */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground leading-tight flex items-center gap-1.5">
            {getUserName(node)}
            {cycleIds?.has(node.id) && (
              <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded" title="Cycle detected in reporting chain">
                ⚠ cycle
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield size={9} /> {node.role.name}
            </span>
            {node.designation && (
              <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Star size={8} /> {node.designation}{node.grade ? ` · ${node.grade}` : ''}
              </span>
            )}
            {node.department && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 size={9} /> {node.department.name}
              </span>
            )}
            {hasChildren && (
              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {node.children.length} report{node.children.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => onEdit(node)}
          className="btn-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <UserPlus size={11} /> Set RA
        </button>
      </div>

      {expanded && hasChildren && (
        <div className="border-l border-border/40 ml-6">
          {node.children.map(child => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} cycleIds={cycleIds} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RAMappingPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'hierarchy'>('list');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch RA mapping data', err);
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

  // Only active users are shown and mapped.
  const activeUsers = useMemo(() => users.filter(u => u.isActive !== false), [users]);

  // Active, RA-eligible users are the only valid choices in the RA dropdown.
  const potentialRAs = useMemo(
    () => activeUsers.filter(u => RA_ELIGIBLE_ROLES.includes(u.role?.name)),
    [activeUsers],
  );

  const filteredUsers = activeUsers.filter(u => userMatchesSearch(u, searchTerm));

  const { roots: treeRoots, cycleIds } = useMemo(() => buildTree(activeUsers), [activeUsers]);

  const filteredTree = useMemo(() => {
    if (!searchTerm) return treeRoots;
    // flatten search: filter users and rebuild partial tree
    const matched = new Set(filteredUsers.map(u => u.id));
    function filterNode(node: TreeNode): TreeNode | null {
      const filteredChildren = node.children.map(filterNode).filter(Boolean) as TreeNode[];
      if (matched.has(node.id) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    }
    return treeRoots.map(filterNode).filter(Boolean) as TreeNode[];
  }, [treeRoots, filteredUsers, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network size={15} className="text-primary" />
          <div>
            <h1 className="text-base font-semibold text-foreground">RA Mapping</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Reporting authority & governance mapping.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* view toggle */}
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors', view === 'list' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              <List size={11} /> List
            </button>
            <button
              onClick={() => setView('hierarchy')}
              className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors', view === 'hierarchy' ? 'bg-background shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              <GitBranch size={11} /> Hierarchy
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 size={12} className="text-green-500" />
            Validated
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email..."
          className="field-input pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : view === 'list' ? (
        /* ── List view ── */
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-card border rounded-lg px-3 py-2.5 hover:border-primary/30 transition-colors flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {getUserInitials(user)}
              </div>

              <div className="min-w-[180px] shrink-0">
                <div className="text-xs font-medium text-foreground">{getUserName(user)}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield size={9} /> {user.role.name}
                  </span>
                  {user.designation && (
                    <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Star size={8} /> {user.designation}{user.grade ? ` · ${user.grade}` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 flex items-center gap-2 bg-muted/30 px-3 py-2 rounded-md min-w-0">
                <GitBranch size={12} className="text-muted-foreground/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Reporting Authority</div>
                  {user.reportingAuthority ? (
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-foreground truncate">
                        {getUserName(user.reportingAuthority)}
                      </div>
                      <div className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-2 shrink-0">Linked</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/50 italic">Unassigned</div>
                  )}
                </div>
              </div>

              <div className="hidden md:flex flex-col items-center px-3 border-x border-border shrink-0">
                <Building2 size={12} className="text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground mt-0.5">{user.department?.name || '—'}</span>
              </div>

              <button onClick={() => setEditingUser(user)} className="btn-primary shrink-0">
                <UserPlus size={11} /> Set RA
              </button>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="py-16 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No users found.
            </div>
          )}
        </div>
      ) : (
        /* ── Hierarchy view ── */
        <div className="bg-card border rounded-lg p-3">
          {filteredTree.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredTree.map(root => (
                <TreeNodeRow key={root.id} node={root} depth={0} onEdit={setEditingUser} cycleIds={cycleIds} />
              ))}
            </div>
          )}
        </div>
      )}

      {editingUser && (
        <MappingModal
          user={editingUser}
          potentialRAs={potentialRAs}
          onClose={() => setEditingUser(null)}
          onSave={() => { setEditingUser(null); fetchData(); }}
        />
      )}
    </div>
  );
}
