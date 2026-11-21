// Pure, defensive normalization. No inferred athlete statistics or invented market lines.
export const SPORTS = Object.freeze({
  MLB: { label: 'MLB', feeds: [{ league: 'MLB', espn: 'baseball/mlb', odds: 'baseball_mlb' }],
    props: ['batter_hits','batter_total_bases','batter_rbis','batter_runs_scored','batter_hits_runs_rbis','pitcher_strikeouts','pitcher_outs','pitcher_hits_allowed'] },
  NHL: { label: 'NHL', feeds: [{ league: 'NHL', espn: 'hockey/nhl', odds: 'icehockey_nhl' }],
    props: ['player_points','player_assists','player_shots_on_goal','player_goals','player_blocked_shots','player_total_saves'] },
  NCAAF: { label: 'College Football', feeds: [{ league: 'NCAAF', espn: 'football/college-football', odds: 'americanfootball_ncaaf' }],
    props: ['player_pass_yds','player_pass_tds','player_pass_completions','player_rush_yds','player_reception_yds','player_receptions'] },
  NCAAB: { label: 'College Basketball', feeds: [{ league: 'NCAAB', espn: 'basketball/mens-college-basketball', odds: 'basketball_ncaab' }],
    props: ['player_points','player_rebounds','player_assists','player_threes','player_points_rebounds_assists','player_points_assists','player_points_rebounds','player_rebounds_assists'] },
  SOCCER: { label: 'Soccer', feeds: [
    { league: 'Premier League', espn: 'soccer/eng.1', odds: 'soccer_epl' },
    { league: 'La Liga', espn: 'soccer/esp.1', odds: 'soccer_spain_la_liga' },
    { league: 'Bundesliga', espn: 'soccer/ger.1', odds: 'soccer_germany_bundesliga' },
    { league: 'Serie A', espn: 'soccer/ita.1', odds: 'soccer_italy_serie_a' },
    { league: 'Ligue 1', espn: 'soccer/fra.1', odds: 'soccer_france_ligue_one' },
    { league: 'MLS', espn: 'soccer/usa.1', odds: 'soccer_usa_mls' }
  ], props: ['player_shots','player_shots_on_target','player_assists','player_goal_scorer_anytime'] }
});
export const LABELS = {
 h2h:'Moneyline / Match Winner',spreads:'Point Spread / Handicap',totals:'Game Total',
 batter_hits:'Batter Hits',batter_total_bases:'Total Bases',batter_rbis:'RBIs',
 batter_runs_scored:'Runs Scored',batter_hits_runs_rbis:'Hits + Runs + RBIs',
 pitcher_strikeouts:'Pitcher Strikeouts',pitcher_outs:'Pitcher Outs',pitcher_hits_allowed:'Hits Allowed',
 player_points:'Points',player_assists:'Assists',player_rebounds:'Rebounds',
 player_shots_on_goal:'Shots on Goal',player_goals:'Goals',player_blocked_shots:'Blocked Shots',
 player_total_saves:'Goalie Saves',player_pass_yds:'Passing Yards',player_pass_tds:'Passing TDs',
 player_pass_completions:'Passing Completions',player_rush_yds:'Rushing Yards',
 player_reception_yds:'Receiving Yards',player_receptions:'Receptions',
 player_threes:'3-Pointers Made',player_points_rebounds_assists:'PRA',
 player_points_assists:'Points + Assists',player_points_rebounds:'Points + Rebounds',
 player_rebounds_assists:'Assists + Rebounds',player_shots:'Shots',player_shots_on_target:'Shots on Target',
 player_goal_scorer_anytime:'Anytime Goalscorer'
};
export function americanProbability(odds) {
  if(!Number.isInteger(odds) || (odds > -100 && odds < 100)) return null;
  return odds > 0 ? 100/(odds+100) : -odds/(-odds+100);
}
export function comparableName(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\b(fc|cf|sc|afc|united states)\b/g,'')
    .replace(/[^a-z0-9]/g,'').trim();
}
export function parseESPNEvent(event, league) {
  const sides=event?.competitions?.[0]?.competitors;
  if(!Array.isArray(sides) || sides.length!==2) return null;
  const home=sides.find(t=>t.homeAway==='home');
  const away=sides.find(t=>t.homeAway==='away');
  if(!home?.team?.id || !away?.team?.id) return null;
  const when=String(event.date||'');
  if(!Number.isFinite(Date.parse(when))) return null;
  function side(team) {
    const raw=team.score?.displayValue ?? team.score?.value ?? team.score;
    const score=raw === '' || raw === undefined || raw === null ? null : Number(raw);
    return { id:String(team.team.id), name: String(team.team.displayName||team.team.name||''),
      short:String(team.team.abbreviation||''),score:Number.isFinite(score)?score:null };
  }
  return { id:String(event.id), league, time:when,
    home:side(home), away:side(away), completed:event.status?.type?.completed===true,
    status:String(event.status?.type?.description||'Scheduled') };
}
export function recentForm(games,teamId) {
  const played=games.filter(game=>game.completed && game.home.score!==null &&
    game.away.score!==null && (game.home.id===teamId || game.away.id===teamId))
    .sort((a,b)=>b.time.localeCompare(a.time)).slice(0,5);
  const results=played.map(game=>{
    const home=game.home.id===teamId;
    const scored=home?game.home.score:game.away.score;
    const conceded=home?game.away.score:game.home.score;
    return {result:scored>conceded?'W':scored<conceded?'L':'D',scored,conceded};
  });
  const n=results.length;
  return {games:n,wins:results.filter(r=>r.result==='W').length,
    draws:results.filter(r=>r.result==='D').length,
    losses:results.filter(r=>r.result==='L').length,
    scoredAvg:n?Number((results.reduce((s,r)=>s+r.scored,0)/n).toFixed(2)):null,
    concededAvg:n?Number((results.reduce((s,r)=>s+r.conceded,0)/n).toFixed(2)):null,
    results:results.map(r=>r.result)};
}
export function pairMarketQuotes(bookmakers,now=new Date()) {
  const cutoff=now.getTime()-90*60000;
  const groups=new Map();
  for(const book of Array.isArray(bookmakers)?bookmakers:[]) {
    if(!book?.key || !Array.isArray(book.markets))continue;
    for(const market of book.markets){
      if(!LABELS[market.key] || !Array.isArray(market.outcomes))continue;
      const updated=Date.parse(market.last_update ?? book.last_update ?? '');
      if(!Number.isFinite(updated) || updated<cutoff || updated>now.getTime()+120000)continue;
      const prices=market.outcomes.filter(o=>americanProbability(o.price)!==null);
      for(const outcome of prices){
        const line=Number.isFinite(outcome.point)?outcome.point:null;
        const athlete=String(outcome.description||'').trim();
        const key=[market.key,athlete,outcome.name,line===null?'':line].join('|');
        const prob=americanProbability(outcome.price);
        const other=prices.filter(p=>p!==outcome && String(p.description||'').trim()===athlete &&
           (market.key==='h2h' || (market.key==='spreads' ? Math.abs(Number(p.point))===Math.abs(Number(line)) : p.point===line)));
        const normalization=prob+other.reduce((a,p)=>a+(americanProbability(p.price)??0),0);
        const noVig=other.length && normalization>0 ? prob/normalization:null;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push({sportsbook:String(book.title||book.key),bookId:String(book.key),odds:outcome.price,
          updatedAt:new Date(updated).toISOString(),noVig});
      }
    }
  }
  const output=[];
  for(const [key,quotes] of groups) {
    const parts=key.split('|');
    const distinct=[...new Map(quotes.map(q=>[q.bookId,q])).values()];
    if(!distinct.length)continue;
    const best=[...distinct].sort((a,b)=>b.odds-a.odds)[0];
    const credible=distinct.map(q=>q.noVig).filter(v=>v!==null);
    const consensus=credible.length?credible.reduce((a,b)=>a+b,0)/credible.length:null;
    const breakEven=americanProbability(best.odds);
    output.push({id:key,market:parts[0],category:LABELS[parts[0]],
      participant:parts[1],side:parts[2],line:parts[3]===''?null:Number(parts[3]),
      odds:best.odds,sportsbook:best.sportsbook,books:distinct.length,
      noVigProbability:consensus===null?null:Number((consensus*100).toFixed(1)),
      breakEvenProbability:breakEven===null?null:Number((breakEven*100).toFixed(1)),
      priceComparison:consensus===null||breakEven===null?null:Number(((consensus-breakEven)*100).toFixed(1)),
      observedAt:best.updatedAt
    });
  }
  return output.sort((a,b)=>(b.books-a.books)||((b.priceComparison??-100)-(a.priceComparison??-100))).slice(0,120);
}
export function matchByFixture(events,home,away,time) {
  const h=comparableName(home),a=comparableName(away),t=Date.parse(time);
  return events.find(g=>Math.abs(Date.parse(g.time)-t)<24*3600000 &&
    comparableName(g.home.name)===h && comparableName(g.away.name)===a);
}

export function matchupEvidence(completedGames,upcoming) {
  const valid=completedGames.filter(g=>g.completed && g.home.score!==null && g.away.score!==null &&
    Date.parse(g.time)<Date.parse(upcoming.time));
  const home=upcoming.home.id,away=upcoming.away.id;
  function since(teamId) {
    const recent=valid.filter(g=>g.home.id===teamId||g.away.id===teamId)
      .sort((a,b)=>b.time.localeCompare(a.time))[0];
    if(!recent)return null;
    return Math.max(0,Math.floor((Date.parse(upcoming.time)-Date.parse(recent.time))/86400000));
  }
  const h2h=valid.filter(g=>(g.home.id===home&&g.away.id===away) ||
    (g.home.id===away&&g.away.id===home)).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,5);
  const homeWins=h2h.filter(g=>(g.home.id===home?g.home.score:g.away.score)>
    (g.home.id===home?g.away.score:g.home.score)).length;
  const awayWins=h2h.filter(g=>(g.home.id===away?g.home.score:g.away.score)>
    (g.home.id===away?g.away.score:g.home.score)).length;
  return {
    daysSinceLastGame:{home:since(home),away:since(away)},
    homeVenue:recentForm(valid.filter(g=>g.home.id===home),home),
    awayVenue:recentForm(valid.filter(g=>g.away.id===away),away),
    headToHead:{games:h2h.length,homeWins,awayWins,draws:h2h.length-homeWins-awayWins,
      avgCombinedScore:h2h.length?Number((h2h.reduce((total,g)=>total+g.home.score+g.away.score,0)/h2h.length).toFixed(2)):null,
      latest:h2h.length?{time:h2h[0].time,homeTeam:h2h[0].home.name,
        homeScore:h2h[0].home.score,awayTeam:h2h[0].away.name,awayScore:h2h[0].away.score}:null}
  };
}
