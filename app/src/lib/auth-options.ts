// Login settings shared by the running site (src/lib/auth.ts, on Cloudflare D1)
// and the schema generator (auth.schema.ts, run in Node). Keep plugins here so
// both agree on the tables.
import type { BetterAuthOptions } from 'better-auth';
import { twoFactor, username } from 'better-auth/plugins';

export const authOptions = {
  appName: 'Open Hangar',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  // "Delete my account" on /account. Rows in our own tables go with it
  // (foreign keys cascade on user deletion).
  user: { deleteUser: { enabled: true } },
  plugins: [
    twoFactor({ issuer: 'Open Hangar' }),
    // Public handle (shown to org members instead of the email); sign in with
    // either. 3–24 letters, numbers, _ or -.
    username({ minUsernameLength: 3, maxUsernameLength: 24 }),
  ],
} satisfies BetterAuthOptions;
