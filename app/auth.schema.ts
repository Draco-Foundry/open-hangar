// Only for generating migrations: `npm run db:generate`. Uses Node's built-in
// SQLite so the Better Auth CLI can read the schema; the site itself uses D1.
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { authOptions } from './src/lib/auth-options';

export const auth = betterAuth({
  ...authOptions,
  database: new DatabaseSync(':memory:'),
});
