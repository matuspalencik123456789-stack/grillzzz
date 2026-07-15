'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@grillz/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type State = 'verifying' | 'done' | 'failed' | 'missing';

function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing');
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true; // strict mode double-invokes effects; the token is single-use
    void fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(
      (res) => setState(res.ok ? 'done' : 'failed'),
      () => setState('failed'),
    );
  }, [token]);

  return (
    <Card className="w-full max-w-md animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Email verification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'verifying' && <p className="text-sm text-muted-foreground">Verifying your email…</p>}
        {state === 'done' && (
          <>
            <p className="text-sm text-muted-foreground">
              Your email is verified. Thanks — your account is all set.
            </p>
            <Link href="/dashboard" className="block">
              <Button variant="gold" className="w-full">Go to dashboard</Button>
            </Link>
          </>
        )}
        {(state === 'failed' || state === 'missing') && (
          <>
            <p className="text-sm text-red-400">
              {state === 'missing'
                ? 'This verification link is missing its token.'
                : 'This link is invalid or has expired.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Sign in and request a new verification email from your dashboard.
            </p>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">Sign in</Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}
