import test from 'node:test';
import assert from 'node:assert/strict';
import { SPORTS, americanProbability, comparableName, parseESPNEvent,
 recentForm, matchupEvidence, pairMarketQuotes, matchByFixture } from '../scripts/multisport-core.mjs';

test('five sports exist with official sport and league identifiers',()=>{
 assert.deepEqual(Object.keys(SPORTS),['MLB','NHL','NCAAF','NCAAB','SOCCER']);
 assert.equal(SPORTS.SOCCER.feeds.length,6);
 for(const sport of Object.values(SPORTS)) {
  assert.ok(sport.feeds.every(f=>f.espn && f.odds && f.league));
  assert.ok(sport.props.length>=4);
 }
});
const makeEvent=(id,when,homeScore,awayScore,completed=true)=>({
 id,date:when,status:{type:{completed,description:completed?'Final':'Scheduled'}},
 competitions:[{competitors:[
  {homeAway:'home',team:{id:'10',displayName:'The Home',abbreviation:'HOM'},score:homeScore},
  {homeAway:'away',team:{id:'20',displayName:'The Away',abbreviation:'AWY'},score:awayScore},
 ]}]
});
test('ESPN missing final score is never treated as a zero',()=>{
 const game=parseESPNEvent(makeEvent('a','2026-11-20T01:10:00Z',null,null,false),'NHL');
 assert.equal(game.home.score,null);
 assert.equal(game.away.score,null);
 assert.equal(game.completed,false);
});
test('observed form uses only completed scored games, newest first',()=>{
 const games=[
  parseESPNEvent(makeEvent('a','2026-11-01T00:00:00Z','3','1'),'NHL'),
  parseESPNEvent(makeEvent('b','2026-11-02T00:00:00Z','0','2'),'NHL'),
  parseESPNEvent(makeEvent('c','2026-11-03T00:00:00Z','5','5'),'NHL'),
  parseESPNEvent(makeEvent('d','2026-11-04T00:00:00Z',null,null,false),'NHL'),
 ];
 const result=recentForm(games,'10');
 assert.equal(result.games,3);
 assert.deepEqual(result.results,['D','L','W']);
 assert.equal(result.wins,1);
 assert.equal(result.draws,1);
 assert.equal(result.losses,1);
 assert.equal(result.scoredAvg,2.67);
});
test('American odds implied probabilities are mathematically valid',()=>{
 assert.equal(americanProbability(-110).toFixed(6),'0.523810');
 assert.equal(americanProbability(150),0.4);
 assert.equal(americanProbability(0),null);
 assert.equal(americanProbability(-90),null);
 assert.equal(americanProbability(100),0.5);
});
test('recent prop odds are genuine two-sided quotes, with no-vig price and best book',()=>{
 const now=new Date('2026-11-19T12:00:00Z');
 const bookmakers=[
  {key:'bookA',title:'First Book',markets:[{key:'player_shots_on_goal',
   last_update:'2026-11-19T11:55:00Z',outcomes:[
    {name:'Over',description:'Skater X',point:2.5,price:-115},
    {name:'Under',description:'Skater X',point:2.5,price:-105}]}]},
  {key:'bookB',title:'Second Book',markets:[{key:'player_shots_on_goal',
   last_update:'2026-11-19T11:55:00Z',outcomes:[
    {name:'Over',description:'Skater X',point:2.5,price:105},
    {name:'Under',description:'Skater X',point:2.5,price:-135}]}]}
 ];
 const markets=pairMarketQuotes(bookmakers,now);
 const over=markets.find(row=>row.side==='Over' && row.line===2.5);
 assert.ok(over);
 assert.equal(over.participant,'Skater X');
 assert.equal(over.sportsbook,'Second Book');
 assert.equal(over.odds,105);
 assert.equal(over.books,2);
 assert.ok(over.noVigProbability>0 && over.noVigProbability<100);
 assert.ok(over.priceComparison!==null);
 assert.equal(markets.some(m=>m.participant==='Fake Player'),false);
});
test('expired and one-sided quotes cannot manufacture a no-vig rate',()=>{
 const markets=pairMarketQuotes([{key:'expired',title:'Old',markets:[
  {key:'batter_hits',last_update:'2026-11-19T08:00:00Z',
   outcomes:[{name:'Over',description:'Hitter X',point:1.5,price:-110}]}
 ]},{key:'current',title:'One-sided',markets:[
  {key:'batter_hits',last_update:'2026-11-19T11:58:00Z',
   outcomes:[{name:'Over',description:'Hitter X',point:1.5,price:120}]}
 ]}],new Date('2026-11-19T12:00:00Z'));
 assert.equal(markets.length,1);
 assert.equal(markets[0].noVigProbability,null);
 assert.equal(markets[0].books,1);
});
test('only same teams and close kickoff time join across providers',()=>{
 const game={home:{name:'FC Barcelona'},away:{name:'Real Madrid'},time:'2026-11-20T20:00:00Z'};
 assert.equal(comparableName('FC Barcelona'),comparableName('Barcelona'));
 assert.equal(matchByFixture([game],'Barcelona','Real Madrid','2026-11-20T20:45:00Z'),game);
 assert.equal(matchByFixture([game],'Barcelona','Real Madrid','2026-12-20T20:45:00Z'),undefined);
 assert.equal(matchByFixture([game],'Barcelona','Valencia','2026-11-20T20:45:00Z'),undefined);
});

test('matchup evidence uses only eligible finals and actual venue history',()=>{
 const past=[
  parseESPNEvent(makeEvent('a','2026-11-09T19:00:00Z','3','1'),'NHL'),
  parseESPNEvent(makeEvent('b','2026-11-12T19:00:00Z','1','2'),'NHL'),
  parseESPNEvent(makeEvent('c','2026-11-13T19:00:00Z','1','1'),'NHL'),
 ];
 // Last observed final on Nov 13; only data preceding the upcoming event counts.
 const upcoming=parseESPNEvent(makeEvent('up','2026-11-20T19:00:00Z',null,null,false),'NHL');
 const evidence=matchupEvidence(past,upcoming);
 assert.equal(evidence.headToHead.games,3);
 assert.equal(evidence.headToHead.homeWins,1);
 assert.equal(evidence.headToHead.awayWins,1);
 assert.equal(evidence.headToHead.draws,1);
 assert.equal(evidence.headToHead.avgCombinedScore,3);
 assert.equal(evidence.homeVenue.games,3);
 assert.equal(evidence.awayVenue.games,3);
 assert.equal(evidence.daysSinceLastGame.home,7);
 assert.equal(evidence.daysSinceLastGame.away,7);
 assert.equal(evidence.headToHead.latest.time,'2026-11-13T19:00:00Z');
});
test('no completed history never generates rest estimates or head-to-head facts',()=>{
 const future=parseESPNEvent(makeEvent('u','2026-11-20T19:00:00Z',null,null,false),'SOCCER');
 const result=matchupEvidence([],future);
 assert.equal(result.daysSinceLastGame.home,null);
 assert.equal(result.headToHead.games,0);
 assert.equal(result.headToHead.avgCombinedScore,null);
 assert.equal(result.headToHead.latest,null);
});
