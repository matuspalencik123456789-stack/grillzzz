import Link from 'next/link';
import { Button } from '@grillz/ui';
import { auth } from '@/auth';

const FEATURES = [
  {
    title: 'Scan-perfect fit',
    body: 'Upload professional dental scans (STL, PLY, OBJ, glTF). Our pipeline validates, optimizes and segments every tooth automatically.',
  },
  {
    title: 'Design in realtime 3D',
    body: 'Select teeth, pick metals and finishes, flood with stones — and watch a manufacturing-accurate preview respond instantly.',
  },
  {
    title: 'AI-assisted styling',
    body: 'Describe the look — "Luxury Miami grillz" — and get manufacturable presets with live price tags, validated by our lab rules.',
  },
  {
    title: 'From click to cast',
    body: 'Transparent quotes down to the gram, secure checkout, and a production line you can follow stage by stage.',
  },
];

export default async function LandingPage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <header className="flex items-center justify-between py-8">
        <div className="font-display text-xl tracking-wide text-gold-300">GRILLZ STUDIO</div>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard">
              <Button variant="gold">Open Studio</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button variant="gold">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-gold-400/80">
          Custom dental jewelry, engineered
        </p>
        <h1 className="max-w-3xl font-display text-5xl leading-tight md:text-7xl">
          Your smile, cast in <span className="text-gold-300">gold</span>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-muted-foreground">
          Professional 3D dental scans in. Manufacturing-ready grillz out. Designed by you, in
          your browser, priced in realtime.
        </p>
        <div className="mt-10 flex gap-4">
          <Link href={session ? '/dashboard' : '/register'}>
            <Button variant="gold" size="lg">
              Start designing
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">
              I have an account
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="glass rounded-lg p-6">
            <h3 className="mb-2 font-medium text-gold-200">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
