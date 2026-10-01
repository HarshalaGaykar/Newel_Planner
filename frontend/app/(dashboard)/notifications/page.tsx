'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, 
  Check, 
  Clock, 
  Trash2, 
  Mail, 
  Search, 
  Filter, 
  MoreVertical,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ClipboardList,
  ExternalLink
} from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/notifications-api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [search, setSearch] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await notificationsApi.getAll(50);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all read', error);
    }
  };

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD' && n.isRead) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED': return <ClipboardList className="h-5 w-5 text-indigo-500" />;
      case 'TIMESHEET_REMINDER': return <Clock className="h-5 w-5 text-amber-500" />;
      case 'APPROVAL_PENDING': return <Mail className="h-5 w-5 text-blue-500" />;
      case 'APPROVED': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'REJECTED': return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Stay updated with your latest alerts and activities.</p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs font-black uppercase tracking-widest hover:bg-secondary transition-all"
        >
          <Check className="h-3.5 w-3.5" />
          Mark All Read
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 px-6 py-4 border-b border-border bg-muted/20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-10 pr-4 h-10 rounded-xl border border-input bg-background/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setFilter('ALL')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                filter === 'ALL' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                filter === 'UNREAD' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unread
            </button>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-border min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted mb-4" />
              <div className="h-4 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No notifications found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {search ? "Try adjusting your search or filters." : "You're all caught up! No new alerts to show."}
              </p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group relative flex gap-4 px-6 py-5 transition-all hover:bg-muted/30",
                  !n.isRead && "bg-primary/5"
                )}
              >
                {!n.isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                
                <div className="mt-1 shrink-0">
                  <div className={cn(
                    "p-2.5 rounded-xl border transition-colors",
                    !n.isRead ? "bg-card border-primary/20 shadow-sm" : "bg-muted/50 border-border"
                  )}>
                    {getTypeIcon(n.type)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className={cn(
                        "text-[15px] font-bold leading-snug",
                        !n.isRead ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {n.title}
                      </h4>
                      <p className={cn(
                        "text-sm mt-1 whitespace-pre-wrap",
                        !n.isRead ? "text-muted-foreground" : "text-muted-foreground/70"
                      )}>
                        {n.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-muted-foreground/60">
                        <Calendar size={12} />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {format(new Date(n.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground/60 border-l border-border pl-3">
                        <Clock size={12} />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {format(new Date(n.createdAt), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                    {n.metadata?.link && (
                      <Link
                        href={n.metadata.link}
                        className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink size={10} />
                        View Details
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
