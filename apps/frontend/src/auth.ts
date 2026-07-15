import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { AuthTokens, Role } from '@grillz/shared-types';

// Server-side calls may need a different origin than the browser (e.g. the
// docker network hostname). API_INTERNAL_URL is read at runtime, while
// NEXT_PUBLIC_API_URL is inlined at build time.
const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface BackendSession {
  user: { id: string; email: string; name: string | null; image: string | null; role: Role };
  tokens: AuthTokens;
}

async function backendLogin(path: string, body: unknown, internal = false): Promise<BackendSession | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(internal ? { 'x-internal-auth': process.env.AUTH_SECRET ?? '' } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendSession;
  } catch {
    return null;
  }
}

async function backendRefresh(refreshToken: string): Promise<AuthTokens | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthTokens;
  } catch {
    return null;
  }
}

/**
 * Auth.js session bridged to the NestJS API: whatever the provider (Google
 * or credentials), sign-in ends with backend-issued JWTs stored in the
 * Auth.js JWT cookie. The access token auto-refreshes ~1 min before expiry.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // self-hosted deployments (Docker, bare Node) — host comes from the request
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const session = await backendLogin('login', {
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!session) return null;
        return {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          role: session.user.role,
          backendTokens: session.tokens,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // initial sign-in with credentials: tokens ride on the user object
      if (user && 'backendTokens' in user) {
        const tokens = user.backendTokens as AuthTokens;
        return {
          ...token,
          userId: user.id,
          role: (user as unknown as { role: Role }).role,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessExpiresAt: Date.now() + tokens.expiresIn * 1000,
        };
      }
      // initial sign-in with Google: exchange the verified profile server-side
      if (account?.provider === 'google' && profile?.email) {
        const session = await backendLogin(
          'federated',
          {
            provider: 'google',
            providerAccountId: account.providerAccountId,
            email: profile.email,
            name: profile.name ?? undefined,
            image: typeof profile.picture === 'string' ? profile.picture : undefined,
          },
          true,
        );
        if (session) {
          return {
            ...token,
            userId: session.user.id,
            role: session.user.role,
            accessToken: session.tokens.accessToken,
            refreshToken: session.tokens.refreshToken,
            accessExpiresAt: Date.now() + session.tokens.expiresIn * 1000,
          };
        }
        return { ...token, error: 'FederatedExchangeFailed' as const };
      }
      // refresh when close to expiry
      const expiresAt = token.accessExpiresAt as number | undefined;
      if (expiresAt && Date.now() > expiresAt - 60_000 && token.refreshToken) {
        const refreshed = await backendRefresh(token.refreshToken as string);
        if (refreshed) {
          return {
            ...token,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            accessExpiresAt: Date.now() + refreshed.expiresIn * 1000,
            error: undefined,
          };
        }
        return { ...token, error: 'RefreshFailed' as const };
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: (token.userId as string) ?? '',
          role: (token.role as Role) ?? 'CUSTOMER',
        },
        accessToken: token.accessToken as string | undefined,
        error: token.error as string | undefined,
      };
    },
  },
  pages: { signIn: '/login' },
});

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: string;
    user: {
      id: string;
      role: Role;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
