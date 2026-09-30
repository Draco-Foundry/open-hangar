// Login settings shared by the running site (src/lib/auth.ts, on Cloudflare D1)
// and the schema generator (auth.schema.ts, run in Node). Keep plugins here so
// both agree on the tables.
import type { BetterAuthOptions } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';

export const authOptions = {
  appName: 'Open Hangar',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // A used reset link signs out every other session.
    revokeSessionsOnPasswordReset: true,
  },
  // Senders live in auth.ts (they need secrets); the switches live here.
  emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
  // Discord and email can share one account. Discord isn't in trustedProviders,
  // so Better Auth only links it when Discord says the email is verified (and
  // the local email is verified too, its default).
  account: { accountLinking: { enabled: true } },
  // "Delete my account" on /account. Rows in our own tables go with it
  // (foreign keys cascade on user deletion).
  user: { deleteUser: { enabled: true } },
  plugins: [twoFactor({ issuer: 'Open Hangar' })],
} satisfies BetterAuthOptions;
