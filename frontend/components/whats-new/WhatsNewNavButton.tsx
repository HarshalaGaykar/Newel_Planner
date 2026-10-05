'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { whatsNewApi } from '@/lib/whats-new-api';
import Link from 'next/link';

export function WhatsNewNavButton() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkUnread = async () => {
      try {
        const { unreadCount } = await whatsNewApi.getUnreadCount();
        setUnreadCount(unreadCount);
      } catch (error) {
        console.error('Failed to get whats-new count', error);
      }
    };
    
    checkUnread();
    
    // Poll every 2 minutes
    const interval = setInterval(checkUnread, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/whats-new"
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20 font-medium text-xs sm:text-sm"
      title="What's New"
    >
      <Sparkles size={14} className="animate-pulse" />
      What's New
      
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-card"></span>
        </span>
      )}
    </Link>
  );
}
