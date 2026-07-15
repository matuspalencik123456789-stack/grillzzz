'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@grillz/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const formSchema = z
  .object({
    password: z.string().min(10, 'At least 10 characters').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
    });
    if (!res.ok) {
      setError(
        res.status === 401
          ? 'This link is invalid or has expired. Request a new one.'
          : 'Something went wrong. Please try again.',
      );
      return;
    }
    setDone(true);
  });

  return (
    <Card className="w-full max-w-md animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Choose a new password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {done ? (
          <>
            <p className="text-sm text-muted-foreground">
              Your password has been changed and all other sessions were signed out.
            </p>
            <Link href="/login" className="block">
              <Button variant="gold" className="w-full">Sign in</Button>
            </Link>
          </>
        ) : !token ? (
          <>
            <p className="text-sm text-red-400">This reset link is missing its token.</p>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="text-gold-300 hover:underline">
                Request a new link
              </Link>
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
              {errors.confirm && <p className="text-xs text-red-400">{errors.confirm.message}</p>}
            </div>
            {error && (
              <p className="text-sm text-red-400">
                {error}{' '}
                <Link href="/forgot-password" className="text-gold-300 hover:underline">
                  Request a new link
                </Link>
              </p>
            )}
            <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
