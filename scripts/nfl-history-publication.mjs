// Reuse completed NFL box scores already collected by the existing daily publisher.
export function nflHistoryPublication(cache,now=Date.now()){
 if(cache?.version!==1||!cache.nfl||typeof cache.nfl!=='object')return null
 const grouped=new Map()
 for(const [gameId,game] of Object.entries(cache.nfl)){
  if(!Number.isFinite(Date.parse(game.date))||Date.parse(game.date)>=now||!Array.isArray(game.rows))continue
  for(const row of game.rows){
   if(String(row.gameId)!==gameId||!row.playerId||!row.player||!row.stats||Date.parse(row.date)!==Date.parse(game.date))continue
   const values=Object.fromEntries(Object.entries(row.stats).filter(([k,v])=>k&&typeof v==='number'&&Number.isFinite(v)))
   if(!Object.keys(values).length)continue
   const id=String(row.playerId),player=grouped.get(id)??{name:row.player,games:{}}
   const old=player.games[gameId]??{date:row.date,gameId,stats:{}}
   // Existing parser creates separate rows per stat group. Merge once per game.
   for(const [k,v] of Object.entries(values))if(!(k in old.stats))old.stats[k]=v
   player.games[gameId]=old;grouped.set(id,player)
  }
 }
 const players=Object.fromEntries([...grouped].map(([id,p])=>[id,{name:p.name,games:Object.values(p.games).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30)}]))
 return Object.keys(players).length?{schemaVersion:1,source:'ESPN completed NFL box scores, cached by EDGEIQ',generatedAt:new Date(now).toISOString(),players}:null
}
