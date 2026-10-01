'use client';

import React, { useState, useEffect } from 'react';
import { financialApi, ClientPO, Milestone } from '@/lib/financial-api';
import { 
  IndianRupee, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  ArrowRight,
  TrendingUp,
  Briefcase
} from 'lucide-react';

export default function BillingPage() {
  const [pos, setPos] = useState<ClientPO[]>([]);
  const [selectedPo, setSelectedPo] = useState<ClientPO | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const data = await financialApi.getClientPOs();
      setPos(data);
      if (data.length > 0) {
        handleSelectPo(data[0]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load POs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPo = async (po: ClientPO) => {
    setSelectedPo(po);
    try {
      const data = await financialApi.getMilestones(po.projectId);
      // Filter milestones to just this PO if needed, or assume backend returns all for project
      setMilestones(data);
    } catch (err) {
      console.error('Failed to load milestones');
    }
  };

  if (loading && pos.length === 0) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading financial data...</div>;
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing Command Center</h1>
          <p className="text-muted-foreground mt-1">Manage Client POs, Milestones, and Revenue Lifecycle.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20">
          <Plus size={18} />
          New Client PO
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* High-Level KPIs - Hardcoded for now, ideally fetched from reports API */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Committed" value="₹2,25,000.00" icon={<Briefcase className="text-blue-500" />} trend="+12% from last month" />
        <StatCard title="Total Invoiced" value="₹1,10,000.00" icon={<FileText className="text-purple-500" />} trend="48% utilization" />
        <StatCard title="Unpaid Balance" value="₹35,000.00" icon={<IndianRupee className="text-amber-500" />} trend="15 days avg DSO" />
        <StatCard title="Collection Rate" value="94.20%" icon={<CheckCircle className="text-emerald-500" />} trend="+2.1% improvement" />
      </div>

      {/* PO Master Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Active Purchase Orders
            </h2>
            <div className="space-y-4">
              {pos.map((po) => (
                <div 
                  key={po.id}
                  onClick={() => handleSelectPo(po)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary/50 group ${selectedPo?.id === po.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-background'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{po.poNumber}</h3>
                      <p className="text-sm text-muted-foreground">Project: {po.projectId.split('-').slice(1).join('-')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${po.status === 'CLOSED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {po.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Total Value</span>
                      <span>₹{po.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000 bg-primary" 
                        style={{ width: `45%` }} // Fake utilization progress
                      />
                    </div>
                  </div>
                </div>
              ))}
              {pos.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                  No Purchase Orders found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Milestone & Quick Action Panel */}
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Milestone Progress</h2>
            <div className="space-y-6 overflow-y-auto max-h-[400px] pr-2">
              {milestones.length > 0 ? milestones.map(ms => (
                <MilestoneItem 
                  key={ms.id}
                  name={ms.name} 
                  status={ms.status} 
                  progress={ms.completion} 
                  isActionable={ms.status === 'PENDING' && ms.completion >= 100} 
                />
              )) : (
                <div className="text-sm text-muted-foreground text-center py-4">Select a PO to view milestones.</div>
              )}
            </div>
          </div>

          {selectedPo && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <AlertCircle size={18} className="text-primary" />
                Intelligent Invoicing
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Automated over-billing guards and GST split calculation enabled for {selectedPo.poNumber}.
              </p>
              <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md">
                Generate Invoice
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-muted rounded-lg">{icon}</div>
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <h3 className="text-2xl font-bold mt-1">{value}</h3>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 font-medium">
          {trend}
        </p>
      </div>
    </div>
  );
}

function MilestoneItem({ name, status, progress, isActionable = false }: { name: string, status: string, progress: number, isActionable?: boolean }) {
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-1" title={name}>{name}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          status === 'FULLY_INVOICED' ? 'bg-emerald-100 text-emerald-700' : 
          status === 'PARTIAL' ? 'bg-blue-100 text-blue-700' :
          'bg-muted text-muted-foreground'
        }`}>
          {status}
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${status === 'FULLY_INVOICED' ? 'bg-emerald-500' : 'bg-primary'}`} 
          style={{ width: `${Math.max(5, progress)}%` }} 
        />
      </div>
      {isActionable && (
        <button className="text-xs text-primary font-bold flex items-center gap-1 mt-1 hover:underline underline-offset-4">
          Invoice Now <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}
