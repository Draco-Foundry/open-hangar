# fix/bare-domain-404

Goal: openhangar.space answers an address it has no file or route for with a 404 page,
not the website's own pages (sign-in, privacy, account).

Steps: a site/404.html page; the site Worker returns it (status 404, noindex) for any
path that isn't a named route; tests; check with wrangler dev (local only).

Done: worker tests pass, npm test passes, local wrangler dev shows 404 for unknown paths
and 200 for files. Publishing the site is the owner's step.
