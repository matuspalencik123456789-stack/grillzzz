'use client';

import { Badge, Button, Card, Skeleton } from '@grillz/ui';
import { useMarkAllRead, useNotifications } from '@/features/api/hooks';
import { formatDate } from '@/lib/format';

const TYPE_VARIANT = {
  SCAN_READY: 'success',
  SCAN_FAILED: 'destructive',
  QUOTE_READY: 'gold',
  ORDER_STATUS: 'default',
  PRODUCTION_UPDATE: 'gold',
  SYSTEM: 'outline',
} as const;

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markAllRead = useMarkAllRead();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all read
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !notifications || notifications.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">All quiet.</Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 ${notification.readAt ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Badge variant={TYPE_VARIANT[notification.type] ?? 'outline'}>
                  {notification.type.replace(/_/g, ' ').toLowerCase()}
                </Badge>
                <span className="text-sm font-medium">{notification.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(notification.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{notification.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
