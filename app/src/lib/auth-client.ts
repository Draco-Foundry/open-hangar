// Browser-side auth calls (sign in/up/out, 2FA). Same origin as the site.
import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Signed in with a password but 2FA is on: finish on the code page.
      onTwoFactorRedirect() {
        const next = new URLSearchParams(location.search).get('next') || '/hangar';
        location.href = `/two-factor?next=${encodeURIComponent(next)}`;
      },
    }),
  ],
});
