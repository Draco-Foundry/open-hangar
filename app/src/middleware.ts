// Puts the signed-in user (or null) on Astro.locals, and sends signed-out
// visitors of account-only pages to /sign-in.
import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './lib/auth';

const PRIVATE = ['/hangar', '/account', '/link'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  // The auth API and the extension's sync API handle their own auth.
  if (pathname.startsWith('/api/')) return next();

  const got = await getAuth().api.getSession({ headers: context.request.headers });
  context.locals.user = (got?.user as App.Locals['user']) ?? null;
  context.locals.session = got?.session ?? null;

  if (!context.locals.user && PRIVATE.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return context.redirect(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return next();
});
