# EDGEIQ authorized sportsbook market integration

The historical Cheat Sheet uses reference thresholds and is **not** an odds feed. This integration adds a distinct, server-generated `marketVerified` section. Without current provider quotes, it intentionally displays **no verified market opportunities**.

## Connecting a licensed feed
1. Obtain contractual/authorized API access to real sportsbook odds, including player props and both side prices.
2. In your **server-side** data ingestion job, normalize the provider payload to JSON:
   `{"quotes":[{"sport":"NBA","eventId":"<ESPN event id>","playerId":"<ESPN athlete id>","category":"Points","sportsbook":"<actual book>","line":24.5,"overOdds":-110,"underOdds":-110,"observedAt":"<UTC ISO timestamp>","source":"<licensed feed identifier>"}]}`.
   These bracketed placeholders are schema instructions, **not offered odds**.
3. Set the secret-free server environment variable `EDGEIQ_AUTHORIZED_ODDS_FILE` to the path of the generated JSON file. The file must exist in the publisher job's filesystem before `scripts/publish-daily-cheatsheet.mjs` starts.
4. Configure your vendor's sportsbook, event, athlete, and market identifiers to map to the same IDs and categories EDGEIQ uses. Unmapped rows do not validate.
5. Supply quotes no older than 15 minutes at publish time. Only matching **exact thresholds**, sport, event, athlete and category are counted. Each book supplies both over/under prices to calculate a no-vig probability. Invalid, suspended, stale or unmatched feeds produce no market-verified cards.
6. Connect the data export to the GitHub Actions job securely. Do not use client-side API keys, expose sportsbook credentials in `VITE_` variables, or commit live quote exports to Git.
7. Run `npm test`, `npm run build`, and a controlled `workflow_dispatch` publishing run. Confirm the actual hosting branch and deployment before promoting this integration.

## Important limits
- This does not supply a sportsbook subscription or guarantee that an offered line will remain available.
- Only exact threshold matches are shown. The current verified section does not compute a consensus **across distinct thresholds**; that requires separately presenting available line distributions and enforcing comparable alternate-market rules.
- The displayed implied and no-vig probabilities are **market prices**, not model predictions. No expected value is claimed until a calibrated out-of-sample model exists.
- Historical research cards remain clearly labeled as **reference thresholds**, not wagers.
- A new verified section is shown only for eligible published slates, not browser-generated fallback research.
- The publishing job is scheduled but a successful production deployment and scheduled execution have not been established by this code change.
