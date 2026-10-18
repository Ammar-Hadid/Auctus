import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getStore, type Store } from './db/connection';
import * as schema from './db/auth-schema';

export function createAuth(store: Store, secret: string, baseURL: string) {
  return betterAuth({
    appName: 'Auctus',
    baseURL,
    secret,
    database: drizzleAdapter(store.orm, { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    trustedOrigins: [baseURL],
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: { '/sign-in/email': { window: 60, max: 5 } },
    },
    advanced: {
      useSecureCookies: baseURL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Set BETTER_AUTH_SECRET to at least 32 random characters.');
  return (instance ??= createAuth(
    getStore(),
    secret,
    process.env.BETTER_AUTH_URL || 'http://localhost:3105',
  ));
}
