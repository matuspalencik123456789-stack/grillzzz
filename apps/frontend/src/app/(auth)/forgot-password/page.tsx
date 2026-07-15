'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordDto } from '@grillz/shared-types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@grillz/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setError('Something went wrong. Please try again in a few minutes.');
      return;
    }
    setSent(true);
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md animate-fade-in-up">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Reset your password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <>
              <p className="text-sm text-muted-foreground">
                If an account exists for that address, we just sent it a reset link. The link is
                valid for 1 hour — check your spam folder too.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-gold-300 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter your account email and we will send you a link to choose a new password.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" {...register('email')} />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                Remembered it?{' '}
                <Link href="/login" className="text-gold-300 hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
