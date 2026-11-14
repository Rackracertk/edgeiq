# EDGEIQ Sports Intelligence

An independent NBA/NFL historical research dashboard built with React, TypeScript and Vite. Existing research UI includes player search, game logs, over/under hit rates and historical defensive comparisons. **This is research, not a forecast of betting outcomes.**

## Launch readiness
- `edgeiq-player-search-fix`: prior locally working NBA/NFL research version.
- `edgeiq-launch-foundation-2026`: launch work with Supabase Auth, Stripe Checkout/Customer Portal, secure subscription-state database and optional normalized, shared sports data feeds.
- **No live subscribers, customer accounts, hosted URL or licensed data provider have been connected by committing this code.**
- Paid Checkout stays off until the verified provider and environment variables are configured. The old browser ESPN path remains available for development/preview when `VITE_RESEARCH_MODE` is unset.

For complete owner-side setup and acceptance tests, read [docs/LAUNCH.md](docs/LAUNCH.md).

## Local development
```sh
npm install
npm run dev
```
For Windows PowerShell with script execution restrictions: `npm.cmd install` and `npm.cmd run dev`.

## Production configuration
Copy `.env.example` to `.env.local` and insert the Supabase URL and publishable key (never secret/service-role keys in Vite). Until licensed feeds work, leave `VITE_RESEARCH_MODE` unset. See [launch instructions](docs/LAUNCH.md).

```sh
npm run build
npm run lint
npm test
```
