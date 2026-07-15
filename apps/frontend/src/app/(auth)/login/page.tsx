'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@grillz/shared-types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@grillz/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await signIn('credentials', { ...values, redirect: false });
    if (result?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  });

  return (
    <Card className="w-full max-w-md animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void signIn('google', { callbackUrl })}
        >
          Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-gold-300 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/register" className="text-gold-300 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
