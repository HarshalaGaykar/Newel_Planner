'use client';

import { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Bell, 
  Shield, 
  Save, 
  Loader2, 
  CheckCircle2,
  Clock,
  CalendarDays,
  FileText,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { notificationsApi, NotificationPreference } from '@/lib/notifications-api';
import { cn } from '@/lib/utils';

const NOTIFICATION_TYPES = [
  { id: 'TASK_ASSIGNED', label: 'Task Assignments', desc: 'When a task is assigned to you.' },
  { id: 'TIMESHEET_REMINDER', label: 'Timesheet Reminders', desc: 'Alerts for missing or late timesheets.' },
  { id: 'APPROVAL_PENDING', label: 'Approval Requests', desc: 'When someone needs your approval.' },
  { id: 'APPROVED', label: 'Approval Status', desc: 'When your requests are approved or rejected.' },
  { id: 'CONTRACT_EXPIRY', label: 'Contract Alerts', desc: 'Warning for expiring freelancer contracts.' },
  { id: 'MILESTONE_OVERDUE', label: 'Project Milestones', desc: 'Alerts for missed project deadlines.' },
  { id: 'BUDGET_EXCEEDED', label: 'Budget Warnings', desc: 'Alerts when project costs exceed budget.' },
  { id: 'GENERAL', label: 'System Alerts', desc: 'General maintenance and system notifications.' },
];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<Record<string, { inApp: boolean; email: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const { data } = await notificationsApi.getPreferences();
        const prefMap: Record<string, { inApp: boolean; email: boolean }> = {};
        data.forEach(p => {
          prefMap[p.type] = { inApp: p.inApp, email: p.email };
        });
        setPreferences(prefMap);
      } catch (error) {
        console.error('Failed to fetch preferences', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const handleToggle = async (type: string, channel: 'inApp' | 'email') => {
    const current = preferences[type] || { inApp: true, email: true };
    const next = { ...current, [channel]: !current[channel] };
    
    setSaving(type);
    try {
      await notificationsApi.updatePreference(type, next.inApp, next.email);
      setPreferences(prev => ({ ...prev, [type]: next }));
    } catch (error) {
      console.error('Failed to update preference', error);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-foreground">User Profile</h1>
        <p className="text-muted-foreground mt-1 font-medium">Manage your personal settings and notification preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-3xl font-black text-primary mb-4 shadow-inner">
                {user?.email?.substring(0, 1).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">{user?.email?.split('@')[0]}</h2>
              <p className="text-sm text-muted-foreground font-medium">{user?.email}</p>
              <div className="mt-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-sm">
                {user?.role}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Permissions: Managed by Admin</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email verified</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Changes to email preferences may take up to 5 minutes to reflect across all automated systems.
            </p>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest">Notification Preferences</h3>
              </div>
            </div>

            <div className="divide-y divide-border">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-muted mb-4" />
                  <div className="h-4 w-48 bg-muted rounded" />
                </div>
              ) : (
                NOTIFICATION_TYPES.map((type) => {
                  const pref = preferences[type.id] || { inApp: true, email: true };
                  const isSaving = saving === type.id;

                  return (
                    <div key={type.id} className="px-6 py-5 flex items-center justify-between gap-6 hover:bg-muted/10 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{type.label}</h4>
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{type.desc}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* In-App Toggle */}
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleToggle(type.id, 'inApp')}
                            disabled={isSaving}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative flex items-center px-1",
                              pref.inApp ? "bg-primary" : "bg-muted-foreground/30"
                            )}
                          >
                            <div className={cn(
                              "h-3 w-3 rounded-full bg-card transition-all shadow-sm",
                              pref.inApp ? "ml-5" : "ml-0"
                            )} />
                          </button>
                          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">App</span>
                        </div>

                        {/* Email Toggle */}
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleToggle(type.id, 'email')}
                            disabled={isSaving}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative flex items-center px-1",
                              pref.email ? "bg-primary" : "bg-muted-foreground/30"
                            )}
                          >
                            <div className={cn(
                              "h-3 w-3 rounded-full bg-card transition-all shadow-sm",
                              pref.email ? "ml-5" : "ml-0"
                            )} />
                          </button>
                          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Account Security
            </h3>
            <p className="text-xs text-muted-foreground">
              To change your password or email address, please contact your system administrator. 
              Security settings are strictly enforced to maintain compliance.
            </p>
            <div className="pt-2">
              <button className="text-xs font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                View Access Logs <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
