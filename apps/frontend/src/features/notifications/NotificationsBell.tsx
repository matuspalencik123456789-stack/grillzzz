'use client';

import Link from 'next/link';
import { useUnreadCount } from '@/features/api/hooks';

export function NotificationsBell() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  return (
    <Link
      href="/notifications"
      className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-zinc-950">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
