# EDGEIQ NBA + NFL Cheat Sheet — free beta

## Live publishing
- **Unattended publishing is running.** GitHub Actions' `.github/workflows/edgeiq-daily-publish.yml` is enabled on `main`; it runs eight scheduled UTC times daily and can be manually dispatched. The job checks out the site's deployment branch (`edgeiq-launch-foundation-2026`), ingests ESPN completed-game scores, checks injuries, and commits published research snapshots back to that branch.
- Outputs: `public/edgeiq-daily.json` (upcoming NBA/NFL boards, research evidence, injury status), `public/edgeiq-nba-history.json` (shared NBA player game logs), and `data/edgeiq-research-cache.json` (incremental completed-game boxes).
- Schedule is subject to GitHub Actions delays and feed outages. The site shows the published timestamp and falls back to clearly labeled client-side research when a usable publication cannot be loaded.
- Publication refuses to replace a valid slate on major source failure. It never invents missing games, player stat lines, player positions or injury clearance.

## Cheat sheet modes
- **All Props:** At least 8 verified historical game samples, at least 3 of the last 5 crossed the reference line, and at least 60% observed historical hit rate. This is a research browser, **not** a 60% forecast of the next game's outcome. Both Over and Under are evaluated where sufficient data exists.
- **Elite 90%+:** At least 10 valid games for NBA or 8 for NFL, at least 4 of the last 5 crossed the line, and at least 90% observed historical rate.
- Both modes diversify final card slots across available stat categories and directions before filling by research score. Low-information extreme event unders are capped to prevent crowding out the main categories.
- NBA: Points, Rebounds, Assists, PRA, PA (Points + Assists), PR (Points + Rebounds), AR (Assists + Rebounds), 3-Pointers Made, Steals, Blocks, SB (Steals + Blocks), Double-Double, Triple-Double.
- NFL: Passing Yards, Passing Completions, Passing Attempts, Passing TDs, Interceptions Thrown, Rushing Yards, Rushing Attempts, Rushing TDs, Longest Rush, Receiving Yards, Receptions, Receiving Targets, Receiving TDs, Longest Reception, Sacks, Tackles, Solo Tackles.
- **No artificial coverage guarantee:** A category/direction is not presented when player history fails the screen, even if the UI offers that filter. Reference thresholds are not live bookmaker lines and may not be tradable.

## Evidence and availability
- NBA defensive evidence uses real source G/F/C position groups (G combines PG+SG; F combines SF+PF), at least 18 minutes, 8 opposing player appearances and 4 distinct games.
- NFL opponent-position evidence requires recorded position, at least 8 appearances and 4 distinct games. Unknown values remain N/A.
- The research score is an evidence-ranking heuristic from past rates, head-to-head, position-versus-defense and volatility. It is **not** future win probability, expected profit or betting value.
- Injury exclusions are applied **only when the injury feed is available**. Without it, the UI marks source screening unavailable; do not imply clearance.
- Users can enter an actual American price to calculate arithmetic break-even probability. There is no licensed sportsbook price or available-moneyline verification for player props.

## Still needed for commercial EDGEIQ Pro
1. License dependable distributable NBA/NFL game-log, lineup/injury and **book-specific player prop lines and odds**. ESPN public endpoints used for beta are unofficial and have no documented redistribution guarantee.
2. Test completeness, injury/line movement and published source freshness on full slates, including weekends and no-game days. Publish alerts if GitHub Actions misses its expected window.
3. Backtest against real offered odds and real closing lines with time-accurate injury screens. Calibrate any predictive probabilities separately; do not equate historical 90–100% hit rate with next-game likelihood.
4. Keep beta access free until validation, licensing, and paid subscription entitlements (verified checkout/webhooks with server-side access control) are operational.

## Verification
- `npm run build` and `npm test` run in GitHub Actions on the deployment branch.
- `tests/cheatsheet-all-props.test.mjs` checks NBA core and combo stats, NFL expanded prop coverage and both sides under verified fixture conditions.
- `tests/nfl-expanded-props.test.mjs` validates real ESPN passing C/ATT, rushing TD, receiving targets, long-play and tackle fields.
- The scheduled publisher's logs report dates, number of games and elite/all-card counts, categories, Over/Under counts, injury availability and upstream failures.
