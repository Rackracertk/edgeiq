# EDGEIQ multi-sport beta — MLB, NHL, NCAAF, NCAAB and soccer

This feature adds five sports to the existing launch branch, preserving NBA/NFL player research. The new MultiSportBoard is integrated into sport-specific research and Daily Cheat Sheet.

## Layers and current limitations

1. Matchups & recent team form: the publisher fetches unofficial ESPN public scoreboards for the past 20 and upcoming 9 days. It uses only completed recorded scores, with W/D/L, scored and conceded averages, last-five sample counts. College football may have fewer than five matches in the current window.
2. Bookmaker odds: if configured, a server-only The Odds API v4 connector fetches **actual offered lines**, prices, sports, bookmaker names and timestamps. This includes game lines and supported event-level player props for MLB, NHL, NCAAF, NCAAB, and six soccer leagues (EPL, La Liga, Bundesliga, Serie A, Ligue 1, MLS). Coverage varies and MLB is off-season in November.
3. Price comparison: same selection and threshold across books; no-vig probability is normalized from two-sided bookmaker quotes. **This is a market price, NOT a calibrated model win probability or proof of positive expected value.**
4. Player historical hit rates, team-versus-position defense, depth charts, injury status, starting pitchers/goalies, travel and schematics have **not** yet been integrated for these five sports. Do not imply that they were researched or invent them. An actual licensed stats feed and backtests are required before EDGEIQ calls them elite picks.

## Run

    node scripts/publish-multisport.mjs

Generates public/edgeiq-multisport.json. With no odds credential, team fixtures and form are published but **no sportsbook picks appear**. The browser never receives API keys. Public ESPN scoreboards are unofficial and may not grant commercial redistribution rights; confirm licenses before monetization.

## Server-side configuration

Set a GitHub Actions **secret** named EDGEIQ_ODDS_API_KEY with your The Odds API v4 key.
Set GitHub Actions variable EDGEIQ_ODDS_DISPLAY_AUTHORIZED=true **only after confirming rights for your particular plan and use**.
Optional variable EDGEIQ_PROPS_ENABLED=true requests event-specific bookmaker player props.
Optional variable EDGEIQ_MAX_PROP_EVENTS=8 caps event calls per job. One request can consume quota across markets, regions and bookmakers; monitor provider usage. Do not expose keys in VITE_ variables or commit them.

The Odds API sport keys: baseball_mlb, icehockey_nhl, americanfootball_ncaaf, basketball_ncaab, soccer_epl, soccer_spain_la_liga, soccer_germany_bundesliga, soccer_italy_serie_a, soccer_france_ligue_one and soccer_usa_mls. Official market keys and pricing are documented at https://the-odds-api.com/sports-odds-data/betting-markets.html

The scheduled GitHub Action must live on default branch main; it checks out the active Cloudflare Pages deployment branch edgeiq-launch-foundation-2026 and commits only the refreshed public/edgeiq-multisport.json file. GitHub schedules are not truly real time, so odds snapshots are clearly dated and quotes older than 120 minutes are hidden. Published research older than 36 hours is rejected.

## Validation and commercial readiness

    npm ci
    npm test
    npm run build
    npm run lint

The test suite checks price validity, fresh two-sided quotations, no-vig arithmetic, ESPN event parsing and last-five team form. Network publication and live Cloudflare deployment require separate end-to-end validation.

Before offering paid multi-sport "elite picks", acquire rights for live/injury/roster data, actual historical offered lines, completed player game logs, team defensive splits and settlement data, and complete time-aware backtests with out-of-sample calibration. No 80–100% hit rate is promised. Follow the relevant gambling laws, age restrictions and responsible-gambling disclosures.
