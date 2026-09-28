// Better Auth on Cloudflare D1 (through Kysely's D1 dialect). One instance per
// Worker isolate; bindings come from `cloudflare:workers`.
import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { D1Dialect } from 'kysely-d1';
import { authOptions } from './auth-options';

// Optional secrets (set with `wrangler secret put`); Discord login only turns on
// once both exist.
type OptionalSecrets = { DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string };

function build() {
  const extra = env as unknown as OptionalSecrets;
  return betterAuth({
    ...authOptions,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: { dialect: new D1Dialect({ database: env.DB }), type: 'sqlite' },
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

let instance: ReturnType<typeof build> | null = null;
export function getAuth() {
  instance ??= build();
  return instance;
}

export const discordEnabled = () => {
  const extra = env as unknown as OptionalSecrets;
  return Boolean(extra.DISCORD_CLIENT_ID && extra.DISCORD_CLIENT_SECRET);
};
