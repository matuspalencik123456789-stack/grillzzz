'use client';

import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const session = await getSession();
  if (!session?.accessToken) return null;
  // the Auth.js session endpoint is rate-limit friendly but not free; cache briefly
  cachedToken = { value: session.accessToken, expiresAt: Date.now() + 30_000 };
  return session.accessToken;
}

/** Typed fetch wrapper for the NestJS API. */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (res.status === 204) return undefined as T;
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

/** Uploads a file straight to S3 via a presigned URL (no API transit). */
export async function uploadToPresignedUrl(
  url: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new ApiError(0, 'Upload network error'));
    xhr.send(file);
  });
}
