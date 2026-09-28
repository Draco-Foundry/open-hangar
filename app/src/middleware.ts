// Puts the signed-in user (or null) on Astro.locals, and sends signed-out
// visitors of account-only pages to /sign-in.
import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './lib/auth';
import { db } from './lib/sync';

const PRIVATE = ['/hangar', '/account', '/link'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  // The auth API and the extension's sync API handle their own auth.
  if (pathname.startsWith('/api/')) return next();

  const got = await getAuth().api.getSession({ headers: context.request.headers });
  context.locals.user = (got?.user as App.Locals['user']) ?? null;
  context.locals.session = got?.session ?? null;
  // A signed-in user's saved Appearance beats this browser's cookie.
  context.locals.themePref = null;
  if (context.locals.user) {
    const pref = await db()
      .prepare('select theme from user_pref where user_id = ?')
      .bind(context.locals.user.id)
      .first<{ theme: string | null }>();
    context.locals.themePref = pref?.theme ?? null;
  }

  if (!context.locals.user && PRIVATE.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return context.redirect(`/sign-in?next=${encodeURIComponent(pathname + context.url.search)}`);
  }
  return next();
});
