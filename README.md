# Waluga Park Lot 9

Marketing site for a new home in Lake Oswego, Oregon. Static front end in `public/`,
one Cloudflare Pages Function for the inquiry form in `functions/api/inquire.js`.

## Run locally

    npm install
    npm run dev          # http://localhost:8788, includes /api/inquire

Static only (no form backend): `cd public && python3 -m http.server 8788`

## Where things live

| What | File |
| --- | --- |
| Copy, specs, palette, broker block, floor plan list | `public/data/site.json` |
| Room-by-room finishes (extracted from the House West deck) | `public/data/rooms.json` |
| Carousel (`reel`) and progress timeline (photos, drone, video) | `public/data/media.json` |
| Look and feel (design tokens at the top) | `public/css/styles.css` |
| Rendering, hero, carousel, lightbox, form handling | `public/js/main.js` |
| Inquiry email | `functions/api/inquire.js` |

## Adding media

Optimized photos live in `public/assets/media/`; list them in `media.json`. Each `reel` item is
`{ "src", "title", "type": "render|photo|drone", "fallback?" }`. Titles for the on-site frames are
generic ("Interior framing (3)"): rename them once each frame is identified. Anything missing
falls back to a labeled placeholder. Raw originals stay in `_originals/` (git-ignored).

Hero: `hero.jpg` is the exterior render cut from the deck (1644 px wide; swap in the full-res
render when available). With no `hero.mp4`, the hero does a slow push-in and the "Watch the
film" button opens a "film is on its way" mock. Drop `public/assets/media/hero.mp4` in place and
both switch to the real video automatically (checked with a HEAD request, no code change).

Progress entries: `{ "date": "YYYY-MM-DD", "title", "note", "type", "src", "video" }` in `progress`.

Targets: hero ~2400 px wide, under 400 KB (AVIF or WebP preferred); photos ~2200 px, ~1 MB or less
(current JPEGs are about 1 MB each; convert to WebP/AVIF before launch if load time matters);
hero video muted, 6 to 10 s loop, under 4 MB, H.264 MP4. Video and motion are skipped for visitors
with reduced-motion or data-saver on. Cloudflare Pages allows 25 MiB per file.

## Inquiry form setup (Cloudflare Pages > Settings > Variables and Secrets)

Always: `INQUIRY_TO` (comma-separated), `INQUIRY_FROM` (address on a verified sending domain).
Pick one provider:

- Cloudflare Email Service (beta): `CF_ACCOUNT_ID`, `CF_EMAIL_TOKEN` (API token with Email Sending: Edit).
  Needs a Workers Paid plan (3,000 emails/month included, then $0.35 per 1,000) and a domain on
  Cloudflare DNS that is onboarded for sending. The function calls the REST API, because binding
  support in Pages Functions is not documented. The reply-to field name is not confirmed in the docs I
  could read: if Cloudflare rejects it (400) the function retries without it, so verify on the first
  live send that Reply works.
- Resend: `RESEND_API_KEY`. Also needs a verified domain for real sending.
- `EMAIL_PROVIDER=cloudflare|resend` forces one when both are set (default: Cloudflare if configured).

Optional spam protection: create a Turnstile widget, set `TURNSTILE_SECRET`, and add
`"turnstileSiteKey": "<site key>"` at the top level of `public/data/site.json`.
Locally, put the same values in `.dev.vars` (git-ignored).

## Deploy

    npm run deploy       # wrangler pages deploy public --project-name=waluga-park-lot-9

or connect the git repo in Cloudflare Pages with build output directory `public` and no build command.

## Open items before launch

- Domain: not purchased. The listing agent must confirm the final address. Until then use the
  `*.pages.dev` URL; add canonical and OG URLs and the email sending domain afterwards.
- Listing block: agent Abigail Moschetti, TEC Real Estate (from her Zillow profile). Confirm the exact
  legal brokerage name and add the Oregon license number (placeholder shows in the footer).
- Launch is Spring 2027 (confirmed by T).
- `exterior-finished.jpg` looks digitally finished from a site photo: confirm it is a rendering and keep its label.
- Real shoot dates for the progress timeline; drone, video, and interior renders to come.
- Neighborhood copy, with verified facts only.
- Rows flagged `review` in `rooms.json` (typo-looking or conflicting finish entries).
- Items the deck marks optional show an Optional badge; confirm which are standard.
- Palette hex values were sampled by eye from the deck; check against the paint and finish samples.
- Self-host the two Google Fonts (Marcellus, Jost) for privacy and speed.
- Equal Housing graphic if the broker requires it, plus OG image and favicon.
