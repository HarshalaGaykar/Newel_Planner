'use client';

import React, { useEffect, useState } from 'react';
import { adminApi, Department } from '@/lib/admin-api';
import { Plus, Edit2, Trash2, Building2, AlertCircle } from 'lucide-react';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDept, setCurrentDept] = useState<Partial<Department>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDepartments();
      setDepartments(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (dept?: Department) => {
    if (dept) {
      setCurrentDept(dept);
    } else {
      setCurrentDept({ name: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDept.name) return;

    try {
      setIsSubmitting(true);
      if (currentDept.id) {
        await adminApi.updateDepartment(currentDept.id, {
          name: currentDept.name,
          description: currentDept.description,
        });
      } else {
        await adminApi.createDepartment({
          name: currentDept.name,
          description: currentDept.description,
        });
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      await adminApi.deleteDepartment(id);
      fetchDepartments();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete department');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading departments...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="text-primary" />
            Departments
          </h1>
          <p className="text-muted-foreground mt-1">Manage organizational departments and divisions.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={18} />
          Add Department
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-muted-foreground">Department Name</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Description</th>
              <th className="px-6 py-4 font-medium text-muted-foreground w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-muted/20 transition-colors group">
                <td className="px-6 py-4 font-semibold">{dept.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{dept.description || '-'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(dept)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(dept.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">{currentDept.id ? 'Edit Department' : 'New Department'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={currentDept.name || ''}
                  onChange={(e) => setCurrentDept({...currentDept, name: e.target.value})}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={currentDept.description || ''}
                  onChange={(e) => setCurrentDept({...currentDept, description: e.target.value})}
                  className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Brief description..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
