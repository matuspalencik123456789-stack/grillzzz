import Link from 'next/link';
import { Button } from '@grillz/ui';
import { auth } from '@/auth';
import { ScrollShowcase } from '@/features/landing/ScrollShowcase';

export default async function LandingPage() {
  const session = await auth();
  return (
    <main className="relative">
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 backdrop-blur-sm md:px-16">
        <Link href="/" className="font-display text-lg tracking-wide text-gold-300">
          GRILLZ STUDIO
        </Link>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard">
              <Button variant="gold" size="sm">
                Open Studio
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="gold" size="sm">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <ScrollShowcase authed={Boolean(session)} />

      <footer className="relative z-10 flex items-center justify-between border-t border-border/40 px-6 py-8 text-xs text-muted-foreground md:px-16">
        <span>© {new Date().getFullYear()} Grillz Studio</span>
        <span>Scan · Design · Cast</span>
      </footer>
    </main>
  );
}
