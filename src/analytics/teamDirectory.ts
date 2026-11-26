export type TeamSport = 'NBA' | 'NFL'
const names: Record<TeamSport, string[]> = {
 NBA: ['ATL|Atlanta Hawks','BOS|Boston Celtics','BKN|Brooklyn Nets|BRK','CHA|Charlotte Hornets','CHI|Chicago Bulls','CLE|Cleveland Cavaliers|Cavs','DAL|Dallas Mavericks|Mavs','DEN|Denver Nuggets','DET|Detroit Pistons','GS|Golden State Warriors|GSW','HOU|Houston Rockets','IND|Indiana Pacers','LAC|Los Angeles Clippers|LA Clippers','LAL|Los Angeles Lakers|LA Lakers','MEM|Memphis Grizzlies','MIA|Miami Heat','MIL|Milwaukee Bucks','MIN|Minnesota Timberwolves|Wolves','NO|New Orleans Pelicans|NOP','NY|New York Knicks|NYK','OKC|Oklahoma City Thunder','ORL|Orlando Magic','PHI|Philadelphia 76ers|Sixers','PHX|Phoenix Suns|PHO','POR|Portland Trail Blazers|Blazers','SAC|Sacramento Kings','SA|San Antonio Spurs|SAS','TOR|Toronto Raptors','UTAH|Utah Jazz|UTA','WSH|Washington Wizards|WAS'],
 NFL: ['ARI|Arizona Cardinals','ATL|Atlanta Falcons','BAL|Baltimore Ravens','BUF|Buffalo Bills','CAR|Carolina Panthers','CHI|Chicago Bears','CIN|Cincinnati Bengals','CLE|Cleveland Browns','DAL|Dallas Cowboys','DEN|Denver Broncos','DET|Detroit Lions','GB|Green Bay Packers|GNB','HOU|Houston Texans','IND|Indianapolis Colts','JAX|Jacksonville Jaguars|JAC','KC|Kansas City Chiefs|KAN','LV|Las Vegas Raiders|LVR','LAC|Los Angeles Chargers|LA Chargers','LAR|Los Angeles Rams|LA Rams','MIA|Miami Dolphins','MIN|Minnesota Vikings','NE|New England Patriots|NWE','NO|New Orleans Saints|NOR','NYG|New York Giants','NYJ|New York Jets','PHI|Philadelphia Eagles','PIT|Pittsburgh Steelers','SEA|Seattle Seahawks','SF|San Francisco 49ers|SFO|Niners','TB|Tampa Bay Buccaneers|TAM|Bucs','TEN|Tennessee Titans','WSH|Washington Commanders|WAS']
}
export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export const teamsFor = (sport: TeamSport) => names[sport].map(entry => {
 const [code,name,...aliases] = entry.split('|')
 return {code,name,aliases}
})
export function teamFor(sport: TeamSport, value: string) {
 const q = normalizeSearch(value)
 return teamsFor(sport).find(t => [t.code,t.name,...t.aliases].some(a => normalizeSearch(a) === q))
}
export const teamName = (sport: TeamSport, value: string) => teamFor(sport,value)?.name ?? value
export function teamMatches(sport: TeamSport, value: string, query: string): boolean {
 const q = normalizeSearch(query)
 if (!q) return true
 const team = teamFor(sport,value)
 return [value,team?.code ?? '',team?.name ?? '',...(team?.aliases ?? [])].some(a => normalizeSearch(a).includes(q))
}
export function textMatches(value: string, query: string): boolean {
 return normalizeSearch(value).includes(normalizeSearch(query))
}
