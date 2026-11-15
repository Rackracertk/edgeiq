// Server-only PropLine importer. Requires EDGEIQ_PROPLINE_API_KEY in GitHub Actions secrets.
// Never send the API key to the browser, source control or public JSON.
// The public file contains only a small, research-matched selection, not an odds feed mirror.
const MARKETS = {
  NBA: {
    player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',
    player_threes:'3-Pointers Made',player_points_rebounds_assists:'PRA',
    player_points_assists:'Points + Assists (PA)',
    player_points_rebounds:'Points + Rebounds (PR)',
    player_rebounds_assists:'Assists + Rebounds (AR)',
    player_steals:'Steals',player_blocks:'Blocks'
  },
  NFL: {
    player_pass_yds:'Passing Yards',player_pass_completions:'Passing Completions',
    player_pass_attempts:'Passing Attempts',player_pass_tds:'Passing TDs',
    player_pass_interceptions:'Interceptions Thrown',player_rush_yds:'Rushing Yards',
    player_rush_attempts:'Rushing Attempts',player_reception_yds:'Receiving Yards',
    player_receptions:'Receptions',player_rush_longest:'Longest Rush',
    player_reception_longest:'Longest Reception'
  }
}
const normalize = s => String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
function extract(payload,sport,rosters,now,eventIds) {
  const result=[]
  const events=Array.isArray(payload)?payload:Array.isArray(payload?.events)?payload.events:[payload]
  for(const event of events) {
    if(!event?.id || Date.parse(event.commence_time)<=now || event.live===true)continue
    for(const book of event.bookmakers??[])for(const market of book.markets??[]) {
      const category=MARKETS[sport][market.key]
      if(!category || market.period)continue
      const pairs=new Map()
      for(const outcome of market.outcomes??[]) {
        const side=String(outcome.name??'').toLowerCase()
        if(side!=='over' && side!=='under')continue
        const line=Number(outcome.point)
        const odds=Number(outcome.price)
        if(!Number.isFinite(line)||!Number.isInteger(odds)||Math.abs(odds)<100)continue
        const player=String(outcome.description??'').trim()
        if(!player)continue
        const key=normalize(player)+':'+line
        const pair=pairs.get(key)??{player,line}
        pair[side]=odds
        pairs.set(key,pair)
      }
      for(const pair of pairs.values()) {
        if(!pair.over || !pair.under)continue
        const players=Object.entries(rosters).filter(([,r])=>normalize(r.name)===normalize(pair.player))
        if(players.length!==1)continue // Never guess an ambiguous player identity.
        const [playerId]=players[0]
        const observedAt=String(market.last_update??book.last_update??'')
        if(!Number.isFinite(Date.parse(observedAt))||now-Date.parse(observedAt)>15*60_000)continue
        result.push({sport,eventId:String(eventIds.get(String(event.id))??''),playerId,category,
          sportsbook:String(book.title??book.key??''),line:pair.line,
          overOdds:pair.over,underOdds:pair.under,observedAt,source:'PropLine'})
      }
    }
  }
  return result.filter(q=>q.eventId && q.sportsbook)
}
export async function fetchPropLineQuotes(sport,rosters) {
  const key=process.env.EDGEIQ_PROPLINE_API_KEY
  if(!key)return []
  const sportKey=sport==='NBA'?'basketball_nba':'football_nfl'
  const markets=Object.keys(MARKETS[sport]).join(',')
  const url='https://api.prop-line.com/v1/sports/'+sportKey+'/odds?markets='+encodeURIComponent(markets)
  const response=await fetch(url,{headers:{'X-API-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw Error('PropLine '+sport+' returned HTTP '+response.status)
  const odds=await response.json()
  const idsResponse=await fetch('https://api.prop-line.com/v1/sports/'+sportKey+'/ids',{headers:{'X-API-Key':key},signal:AbortSignal.timeout(20000)})
  if(!idsResponse.ok)throw Error('PropLine event crosswalk HTTP '+idsResponse.status)
  const ids=await idsResponse.json()
  const eventIds=new Map((Array.isArray(ids)?ids:[]).filter(row=>row.id&&row.espn_event_id).map(row=>[String(row.id),String(row.espn_event_id)]))
  return extract(odds,sport,rosters,Date.now(),eventIds)
}
