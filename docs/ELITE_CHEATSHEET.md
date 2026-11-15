# EDGEIQ Elite Cheat Sheet — free beta

## What is running in this release
- The live React board builds upcoming NBA and NFL research from **completed games**, selects historical thresholds with >=90% hits in a supported recent window, and refreshes on page load, each 10 minutes while open, and when the window gains focus.
- NBA requires 10 recent game samples. NFL requires 8–10. Both require >=4/5 recent hits. L20 is shown only with 20 complete games.
- Games must be upcoming; excluded players are removed when a fresh injury feed is available. If the feed fails, the board is explicitly **unscreened**.
- Position defense samples compare the same statistic and same line **against the named upcoming opponent**. NBA needs >=18 recorded minutes, 8 opposing player appearances and >=4 distinct games; NFL needs an explicit player position, 8 appearances and >=4 games. Incomplete defensive evidence is never given a numeric rating.
- The research score is a ranking heuristic derived from historical rates, matchup data, head-to-head history and variability. It is **not** calibrated win probability or expected profit.
- Odds are **not** connected: visitors can enter a real American price to see its arithmetic break-even rate only. Reference thresholds may not be offered by sportsbooks.
- Free beta users can shortlist, filter to position-backed cards, and open player research without paying.

## What is NOT connected yet
- There is no unattended overnight publication pipeline or active Supabase Cron job. At present `sports_cache` and `edgeiq_slate_snapshots` have not been populated; the ESPN server-side endpoint has previously rejected requests (HTTP 403). Browser-side live fetches also may fail. **Do not claim server-side daily publishing is functioning.**
- There is no licensed live player-prop feed (market lines, odds, limits, venue, timestamp), nor a tested predictive model. You cannot use a 90–100% past hit rate as a future probability or profitability claim.
- There is no premium paywall for this board; checkout remains disabled for beta.

## Required next step for dependable daily publishing
1. License/approve dependable NBA and NFL game logs (with position, minutes/snaps, opponents, dates, injuries) and sportsbook **player prop** odds/lines. Validate provider rights to distribute in a paid product.
2. Run scheduled server-side ingestion using Supabase Cron + Edge Functions or equivalent, with secret keys in Vault. Maintain source timestamps, freshness limits, completeness and per-game stat coverage. Existing Supabase code is *not* proof the ingestion works.
3. Publish date-stamped NBA and NFL snapshots **before the first game of the US slate**, refresh injuries and markets periodically up to game time, and atomically replace invalid/outdated picks. RLS: beta reads permitted, only trusted service role writes. Never keep stale candidates on an incomplete feed.
4. Compute opponent-versus-position allowances from sufficient full-season game logs and isolate players eligible for each market. Support confirmed starter status, rest/back-to-back, home/away, likely rotation and injury-related role change only where trustworthy data exists.
5. Backtest on out-of-sample slates, recording actual offered lines and odds, closing-line movement, historical calibration (Brier/log loss), sample sizes, and net ROI at real prices. Show **model win probability** only after independent validation and ongoing monitoring.
6. For EDGEIQ Pro, enforce subscription authorization server-side using verified Stripe webhook state and Supabase RLS or an authenticated Edge Function; hiding a React element is not secure access control. Keep the free beta available until quality is confirmed and monetization is explicitly approved.

## Acceptance checks
`npm run build`, `npm run lint`, `npm test`, inspect mobile UI, simulate a missing injury report and failed data feed, verify exact opponent/position match, and audit newly added verified data after the next completed slate. The site should display **no picks** rather than fabricate results when qualified history is unavailable.
