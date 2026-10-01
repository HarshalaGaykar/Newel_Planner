'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink, Clock, Trash2, Mail } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/notifications-api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

export function NotificationBell() {
  const [unread, setUnread] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ids already surfaced to the user. Seeded on the first fetch so a page load
  // does not replay a backlog of older unread notifications as toasts.
  const seenIds = useRef<Set<string> | null>(null);

  const fetchUnread = async () => {
    try {
      const { data } = await notificationsApi.getUnread();
      setUnread(data.items);
      setCount(data.count);

      if (seenIds.current === null) {
        seenIds.current = new Set(data.items.map((item) => item.id));
        return;
      }

      const fresh = data.items.filter((item) => !seenIds.current!.has(item.id));
      for (const item of fresh) {
        seenIds.current.add(item.id);
        toast(item.title, { description: item.body });
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchUnread();
    // Polling interval — a notification raised elsewhere surfaces as a toast on
    // the next tick, so this is also the worst-case toast latency.
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setUnread(prev => prev.filter(n => n.id !== id));
      setCount(prev => prev - 1);
    } catch (error) {
      console.error('Failed to mark read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await notificationsApi.markAllRead();
      setUnread([]);
      setCount(0);
    } catch (error) {
      console.error('Failed to mark all read', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TIMESHEET_REMINDER': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'APPROVAL_PENDING': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'APPROVED': return <Check className="h-4 w-4 text-emerald-500" />;
      case 'REJECTED': return <Trash2 className="h-4 w-4 text-destructive" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground shadow-sm ring-2 ring-card">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-bold">Notifications</h3>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-xs font-black uppercase tracking-widest text-primary hover:underline disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {unread.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No new notifications at the moment.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {unread.map((notification) => (
                    <div
                      key={notification.id}
                      className="group relative flex gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5 shrink-0">
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground leading-tight">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-primary/10 text-primary transition-all"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full py-2.5 text-center text-xs font-black uppercase tracking-widest bg-muted/50 hover:bg-primary hover:text-primary-foreground border-t border-border transition-all"
            >
              View all notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
