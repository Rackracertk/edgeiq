# EDGEIQ — Launch checklist and handoff

## Current state
The React/Vite dashboard, NBA/NFL research UI, Supabase Auth UI, Stripe billing functions, RLS migrations and a **gated** shared research-feed API are in this branch. They are **not live** until the owner's provider accounts, credentials, data license and deployment are configured and tested. Do not advertise a guaranteed hit rate or paid Pro capabilities that are not operational.

## 1. Keep the existing working branch safe
The older `main` and `edgeiq-player-search-fix` branches have unrelated ancestry. This launch branch starts from the working `edgeiq-player-search-fix`. Point Cloudflare Pages production to `edgeiq-launch-foundation-2026` after verification rather than force-merging into `main`.

## 2. Prepare Supabase (owner action)
1. Create or connect a Supabase project. Enable email magic-link authentication; configure the site URL and allowed callback URLs to the actual Pages domain, and set up reliable SMTP before inviting real users.
2. In Supabase SQL editor apply, in order, `supabase/migrations/20261114_launch.sql` and `supabase/migrations/20261114_sports_cache.sql`.
3. Deploy Edge Functions: `create-checkout`, `manage-billing`, `stripe-webhook`, `sports-research`, `refresh-research`, `pro-insights` using the Supabase CLI. `supabase/config.toml` disables platform JWT checks for these functions; user functions authenticate tokens against Supabase Auth, the webhook verifies Stripe's signed raw body, and refresh uses a dedicated secret.
4. Configure Edge Function secrets (NEVER commit values): `APP_URL` (exact final https:// origin), `ALLOWED_ORIGINS` (optional comma-separated preview origins), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for legacy-key projects; confirm those exist for the selected project. For projects using only named modern keys, adapt the server helper to the supported auth and service keys first.
5. Configure Supabase Auth email redirect allowed URLs, verify login/signup/logout and session renewal, and test that users cannot read or change other users' saved research or subscription rows.

## 3. Prepare Stripe (owner action)
1. Activate a Stripe account; add three recurring USD Prices: $3.99/week, $9.99/month and $79.99/year. Put their `price_...` IDs in the Edge Function secrets above.
2. Enable Stripe Customer Portal cancellation and payment-method management.
3. Register webhook endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`. Subscribe to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the webhook signing secret into Supabase secrets.
4. Test in Stripe **test mode** first: successful Checkout, failed payment, canceled renewal, expired period, and replayed webhook events. Confirm the database reflects each change before switching to live Stripe keys.
5. Checkout is blocked by the server until `SPORTS_LICENSE_APPROVED=true`; the browser also disables subscribe buttons until `VITE_RESEARCH_MODE=licensed`. Do not bypass this compliance gate to collect money early.

## 4. Sports data — required for a paid launch
The original code loads ESPN public pages directly in the browser for local research/demo. That is **not** a verified commercial license or a scalable subscriber architecture.

Secure an appropriate contract with a sports-data provider for the NBA and NFL statistics you intend to republish. Configure:
- `SPORTS_LICENSE_APPROVED=true` only after validating contract terms (including public redisplay and paid subscriptions).
- `SPORTS_DATA_FEED_NBA` and `SPORTS_DATA_FEED_NFL`: trusted HTTPS endpoints producing the normalized JSON described below.
- `SPORTS_DATA_API_KEY`: provider token, server-side ONLY.
- `SPORTS_DATA_SOURCE_LABEL`: accurately named data provider.
- `RESEARCH_REFRESH_SECRET`: high-entropy secret for trusted scheduled refresh requests.

A trusted scheduler calls `POST /functions/v1/refresh-research` with `x-edgeiq-refresh-key: <secret>` and JSON `{"sport":"NBA"}` or `{"sport":"NFL"}` periodically (e.g. after completed games and on the next morning). This validates and stores normalized snapshots in Supabase. Public research uses `GET /functions/v1/sports-research?sport=NBA|NFL`. Stale over-24-hour snapshots are rejected (requiring a healthy refresh pipeline before launch). Server/cache access alone does not create data licensing rights.

**NBA normalized feed shape** (current 2026–27 regular season only):
```json
{
  "players": [{"id":"3975","name":"Stephen Curry","team":"Golden State Warriors","position":"PG","points":24,"rebounds":4,"assists":6,"threes":4}],
  "history": {
    "3975": [{"id":"3975","name":"Stephen Curry","team":"Golden State Warriors","date":"2026-11-12T03:00:00Z","gameId":"example-real-id","opponent":"Los Angeles Lakers","homeAway":"away","points":24,"rebounds":4,"assists":6,"threes":4}]
  }
}
```
This is a **schema example, not real statistics**. Do not publish invented values. Player histories must be newest first, deduplicated by game ID, and supported by complete box scores. Verify at least 10 random player/date/prop records against the licensed provider before launch.

**NFL normalized feed shape** (current regular season):
```json
{"rows":[{"gameId":"example-real-id","date":"2026-11-01T18:00:00Z","playerId":"example-id","player":"Example Player","team":"Example Team","stats":{"Passing Yards":250}}]}
```
This too is only a schema example. Check actual stat key names against `src/NFLResearch.tsx` and required matchups.

## 5. Deploy Cloudflare Pages (owner action)
Connect the GitHub repo to Cloudflare Pages and use:
- Production branch: `edgeiq-launch-foundation-2026` (after tests and review; do not point at outdated `main`)
- Build command: `npm run build`; output directory: `dist`
- Build environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_RESEARCH_MODE=licensed` **only after** the licensed data API is working.
- Node version: 24 compatible with project build dependencies.

A Pages `*.pages.dev` URL is provided only after the account owner deploys. Set up a custom domain and HTTPS if desired. No public URL has been provisioned by these GitHub commits.

## 6. Testing and legal gates before collecting money
- Browser: Chrome, Firefox, mobile sizes, keyboard use, page loading and meaningful unavailable-data messaging.
- Auth: magic-link delivery, account session, expired JWT, logout, RLS isolation.
- Billing: test-mode Checkout, webhook signature rejection, cancellation and renewal, no accidental duplicate subscription.
- Data: source licensing, freshness, NBA+NFL season filtering, complete game logs, over/under/L5/L10/L20 correctness, missing games and request-rate monitoring.
- Business: publish accurate Terms, Privacy Policy, auto-renewal/cancellation disclosures, customer support contact, refund policy, age/jurisdiction considerations, required taxes and branding usage rights. Obtain counsel where appropriate.
- Monitor: endpoint response failures, stale snapshot alerts and Stripe webhook errors.

## Commands for local verification
```sh
npm install
npm run build
npm run lint
npm test
```
The first `npm install` updates `package-lock.json` for the new Supabase client dependency. The launch branch's CI workflow can generate and commit this lockfile when GitHub Actions has write permission.

## Premium insights
The authenticated `pro-insights` Edge Function verifies active billing status server-side and calculates NBA/NFL season, L5/L10/L20, home/away and opponent breakdowns from the licensed snapshots. It never accepts stat totals or access flags from the client. Set NFL feed row `opponent` and `homeAway` when available to populate those splits; absent fields appear as unavailable. Test Pro vs Free access with different test users before enabling checkout.

## Upcoming opponents in licensed mode
Provide an optional `nextOpponents` mapping on both league feeds (team name/abbreviation as used by the player records → opponent name), plus optional NBA `teamAbbreviations`. In licensed mode, schedules must come from the approved feed, never ESPN directly. Without this mapping, the dashboard shows “No upcoming opponent supplied” rather than inventing a matchup.
