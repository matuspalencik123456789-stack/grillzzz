'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@grillz/shared-types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@grillz/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? 'Registration failed');
      return;
    }
    // account exists — establish the Auth.js session with the same credentials
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      setError('Account created, but sign-in failed. Try logging in.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Create your studio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void signIn('google', { callbackUrl: '/dashboard' })}
          >
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or with email <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create account'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already a member?{' '}
            <Link href="/login" className="text-gold-300 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
