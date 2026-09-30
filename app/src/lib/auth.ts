// Better Auth on Cloudflare D1 (through Kysely's D1 dialect). One instance per
// Worker isolate; bindings come from `cloudflare:workers`.
import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { D1Dialect } from 'kysely-d1';
import { authOptions } from './auth-options';
import { resetPasswordEmail, verifyEmail } from './email';

// DISCORD_CLIENT_ID is a plain var, DISCORD_CLIENT_SECRET a secret (`wrangler
// secret put`). Discord login only turns on once both are set.
type OptionalSecrets = {
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  SIGNUPS_OPEN?: string;
  SIGNUP_ALLOWLIST?: string;
};

// New accounts are closed until launch unless SIGNUPS_OPEN is "true". Testers go
// in the SIGNUP_ALLOWLIST secret (comma-separated emails), so their addresses
// never land in the public repo. Existing accounts always sign in.
export const SIGNUPS_CLOSED = 'Open Hangar accounts aren’t open yet. They’re coming soon!';
export function signupsOpen() {
  return (env as unknown as OptionalSecrets).SIGNUPS_OPEN === 'true';
}
function mayCreateAccount(email: string) {
  if (signupsOpen()) return true;
  const allow = String((env as unknown as OptionalSecrets).SIGNUP_ALLOWLIST || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(String(email || '').toLowerCase());
}

function build() {
  const extra = env as unknown as OptionalSecrets;
  return betterAuth({
    ...authOptions,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: { dialect: new D1Dialect({ database: env.DB }), type: 'sqlite' },
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      sendResetPassword: ({ user, url }) => resetPasswordEmail(user.email, url),
    },
    emailVerification: {
      ...authOptions.emailVerification,
      sendVerificationEmail: ({ user, url }) => verifyEmail(user.email, url),
    },
    // Runs for email sign-up and for a first Discord login alike.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!mayCreateAccount(user.email))
              throw new APIError('FORBIDDEN', { message: SIGNUPS_CLOSED });
          },
        },
      },
    },
    socialProviders:
      extra.DISCORD_CLIENT_ID && extra.DISCORD_CLIENT_SECRET
        ? {
            discord: {
              clientId: extra.DISCORD_CLIENT_ID,
              clientSecret: extra.DISCORD_CLIENT_SECRET,
            },
          }
        : {},
  });
}

// Reuse the instance while the D1 binding is the same object; rebuild if it
// changes (dev hot reloads hand out a fresh binding, and a cached instance
// holding a stale one breaks every request).
let instance: ReturnType<typeof build> | null = null;
let boundTo: unknown = null;
export function getAuth() {
  if (!instance || boundTo !== env.DB) {
    if (!env.DB) throw new Error('D1 binding "DB" is missing (check wrangler.jsonc).');
    instance = build();
    boundTo = env.DB;
  }
  return instance;
}

export function discordEnabled() {
  const extra = env as unknown as OptionalSecrets;
  return Boolean(extra.DISCORD_CLIENT_ID && extra.DISCORD_CLIENT_SECRET);
}
