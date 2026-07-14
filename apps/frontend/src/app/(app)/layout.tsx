import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { Button } from '@grillz/ui';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';

const NAV = [
  { href: '/dashboard', label: 'Projects' },
  { href: '/designs', label: 'Saved Designs' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/orders', label: 'Orders' },
  { href: '/notifications', label: 'Notifications' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="glass fixed inset-y-4 left-4 z-40 hidden w-56 flex-col rounded-xl p-5 lg:flex">
        <Link href="/dashboard" className="mb-8 block font-display text-lg tracking-wide text-gold-300">
          GRILLZ STUDIO
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {session.user.role === 'ADMIN' && (
            <Link
              href="/admin"
              className="mt-4 rounded-md border border-gold-500/20 px-3 py-2 text-sm text-gold-300 transition-colors hover:bg-gold-500/10"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <Button variant="ghost" size="sm" className="w-full justify-start px-3">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-md lg:justify-end">
          <Link href="/dashboard" className="font-display text-gold-300 lg:hidden">
            GRILLZ STUDIO
          </Link>
          <NotificationsBell />
        </header>
        <main className="px-6 pb-16">{children}</main>
      </div>
    </div>
  );
}
