# RSI / CIG — compliance notes

Short, practical notes on staying in bounds with Cloud Imperium Games (CIG) when
distributing Open Hangar. Not legal advice — just the lay of the land.

## Where Open Hangar sits

There is an **established, long-running ecosystem** of session-based RSI tools in
the Chrome Web Store and beyond (e.g. CCUGame, hangar exporters). They read the
signed-in user's own account the same way Open Hangar does, and have operated
publicly for years without incident. Open Hangar is squarely in that tolerated
space — it just covers more of the available data and is open-source so others can
improve it.

## Why it fits CIG's stated stance

CIG's [Fandom FAQ](https://support.robertsspaceindustries.com/hc/en-us/articles/115013196127-Fandom-FAQ-Videos-writing-and-more)
and [Fankit FAQ](https://support.robertsspaceindustries.com/hc/en-us/articles/360006895793-Star-Citizen-Fankit-and-Fandom-FAQ)
permit **personal, non-commercial** fan use of their IP. Open Hangar is:

- **Non-commercial** — free, MIT-licensed, no resale of data.
- **Personal & read-only** — only the user's own account, rate-limited.
- **Credential-safe** — CIG explicitly warns users never to give their RSI login to
  third-party tools. Open Hangar asks for **no credentials**; it uses only the
  browser session you're already signed in with. That makes it _more_ aligned with
  CIG's guidance than tools that ask for logins.

## Good-practice guardrails (cheap, worth keeping)

These aren't risk mitigation so much as the same conventions the established tools
follow:

- **Keep "Open Hangar" as the product name** — brand (Star Citizen / RSI) stays out
  of the title; describe the function in the body with the unaffiliated disclaimer
  nearby. (Already the case.)
- **Use your own art** in store promo images — not CIG logos/screenshots.
- **Keep the "unofficial, not affiliated with CIG/RSI" disclaimer** visible in the
  listing, README, and privacy policy. (Already present.)
- **Stay non-commercial and rate-limited** — don't add bulk fetching; keep the
  politeness delay in `lib.js`.
- If CIG ever requests changes, be responsive — but there's no indication that's a
  live concern for this class of tool.

## Bottom line

Public store listing is a normal, well-precedented path for this kind of tool. No
special hedging needed beyond the good-practice items above.
