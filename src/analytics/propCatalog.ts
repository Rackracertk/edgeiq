// Research vocabulary; a catalog entry does not imply a verified offer or available historical sample.
const groups:Record<string,Record<string,string[]>>={
  "basketball": {
    "Scoring": [
      "Points",
      "3-Pointers Made",
      "Field Goals Made",
      "Field Goal Attempts",
      "3-Point Attempts",
      "Free Throws Made",
      "Free Throw Attempts"
    ],
    "Rebounds & assists": [
      "Rebounds",
      "Assists",
      "Offensive Rebounds",
      "Defensive Rebounds"
    ],
    "Combined": [
      "PRA",
      "Points + Assists (PA)",
      "Points + Rebounds (PR)",
      "Assists + Rebounds (AR)",
      "Steals + Blocks (SB)"
    ],
    "Defense & other": [
      "Steals",
      "Blocks",
      "Turnovers",
      "Minutes",
      "Double-Double",
      "Triple-Double",
      "Fantasy Points"
    ],
    "Game segments": [
      "1st Quarter Points",
      "1st Quarter Rebounds",
      "1st Quarter Assists",
      "First Half Points",
      "Second Half Points",
      "First Basket",
      "First Team Basket"
    ]
  },
  "football": {
    "Passing": [
      "Passing Yards",
      "Passing TDs",
      "Passing Completions",
      "Passing Attempts",
      "Interceptions Thrown",
      "Longest Completion",
      "1st Quarter Passing Yards"
    ],
    "Rushing": [
      "Rushing Yards",
      "Rushing Attempts",
      "Rushing TDs",
      "Longest Rush"
    ],
    "Receiving": [
      "Receiving Yards",
      "Receptions",
      "Receiving Targets",
      "Receiving TDs",
      "Longest Reception"
    ],
    "Combined & scoring": [
      "Passing + Rushing Yards",
      "Rushing + Receiving Yards",
      "Passing + Rushing + Receiving Yards",
      "Rushing + Receiving TDs",
      "Passing + Rushing + Receiving TDs",
      "Anytime Touchdown",
      "First Touchdown",
      "Last Touchdown",
      "Fantasy Points"
    ],
    "Defense & kicking": [
      "Tackles",
      "Solo Tackles",
      "Assisted Tackles",
      "Sacks",
      "Defensive Interceptions",
      "Forced Fumbles",
      "Field Goals Made",
      "Extra Points Made",
      "Kicking Points",
      "Longest Field Goal"
    ]
  },
  "baseball": {
    "Hitting": [
      "Hits",
      "Total Bases",
      "Home Runs",
      "RBIs",
      "Runs",
      "Hits + Runs + RBIs",
      "Singles",
      "Doubles",
      "Triples",
      "Extra Base Hits",
      "Stolen Bases",
      "Batter Walks",
      "Batter Strikeouts",
      "Batter Fantasy Points"
    ],
    "Pitching": [
      "Pitcher Strikeouts",
      "Pitcher Hits Allowed",
      "Pitcher Walks",
      "Pitcher Earned Runs",
      "Pitcher Outs",
      "Pitcher Win",
      "Pitcher Fantasy Points"
    ]
  },
  "hockey": {
    "Skaters": [
      "Shots on Goal",
      "Goals",
      "Points",
      "Assists",
      "Power Play Points",
      "Blocked Shots",
      "Hits",
      "Faceoffs Won",
      "Time on Ice",
      "Anytime Goal",
      "First Goal",
      "Last Goal",
      "Fantasy Points"
    ],
    "Goalies": [
      "Goalie Saves",
      "Goals Allowed",
      "Shutout"
    ]
  },
  "soccer": {
    "Attacking": [
      "Goals",
      "Assists",
      "Goals + Assists",
      "Shots",
      "Shots on Target",
      "Anytime Goal",
      "First Goal",
      "Last Goal"
    ],
    "Defending & other": [
      "Goalie Saves",
      "Clean Sheet",
      "Tackles",
      "Passes",
      "Fouls Committed",
      "Fouls Drawn",
      "Yellow Cards",
      "Red Cards",
      "Offsides",
      "Fantasy Points"
    ]
  },
  "tennis": {
    "Match stats": [
      "Aces",
      "Double Faults",
      "Games Won",
      "Sets Won",
      "Break Points Won",
      "Break Points Saved",
      "First Serve Points Won",
      "Total Points Won",
      "Tiebreaks Won",
      "Fantasy Points"
    ]
  },
  "mma": {
    "Fight stats": [
      "Significant Strikes",
      "Total Strikes",
      "Takedowns",
      "Takedown Attempts",
      "Knockdowns",
      "Submission Attempts",
      "Control Time",
      "Fantasy Points"
    ],
    "Fight outcomes": [
      "Fight Win",
      "KO/TKO Win",
      "Submission Win",
      "Decision Win",
      "Finish Round"
    ]
  }
}
const marketLabels:Record<string,Record<string,string>>={
  "basketball": {
    "player_points": "Points",
    "player_rebounds": "Rebounds",
    "player_assists": "Assists",
    "player_threes": "3-Pointers Made",
    "player_points_rebounds_assists": "PRA",
    "player_points_assists": "Points + Assists (PA)",
    "player_points_rebounds": "Points + Rebounds (PR)",
    "player_rebounds_assists": "Assists + Rebounds (AR)",
    "player_steals": "Steals",
    "player_blocks": "Blocks",
    "player_blocks_steals": "Steals + Blocks (SB)",
    "player_turnovers": "Turnovers",
    "player_field_goals": "Field Goals Made",
    "player_frees_made": "Free Throws Made",
    "player_frees_attempts": "Free Throw Attempts",
    "player_points_q1": "1st Quarter Points",
    "player_rebounds_q1": "1st Quarter Rebounds",
    "player_assists_q1": "1st Quarter Assists",
    "player_double_double": "Double-Double",
    "player_triple_double": "Triple-Double",
    "player_first_basket": "First Basket",
    "player_first_team_basket": "First Team Basket",
    "player_fantasy_points": "Fantasy Points"
  },
  "football": {
    "player_pass_yds": "Passing Yards",
    "player_rush_yds": "Rushing Yards",
    "player_reception_yds": "Receiving Yards",
    "player_receptions": "Receptions",
    "player_pass_tds": "Passing TDs",
    "player_pass_completions": "Passing Completions",
    "player_rush_attempts": "Rushing Attempts",
    "player_sacks": "Sacks",
    "player_pass_attempts": "Passing Attempts",
    "player_pass_interceptions": "Interceptions Thrown",
    "player_pass_longest_completion": "Longest Completion",
    "player_rush_longest": "Longest Rush",
    "player_reception_longest": "Longest Reception",
    "player_rush_tds": "Rushing TDs",
    "player_reception_tds": "Receiving TDs",
    "player_pass_rush_yds": "Passing + Rushing Yards",
    "player_rush_reception_yds": "Rushing + Receiving Yards",
    "player_pass_rush_reception_yds": "Passing + Rushing + Receiving Yards",
    "player_rush_reception_tds": "Rushing + Receiving TDs",
    "player_pass_rush_reception_tds": "Passing + Rushing + Receiving TDs",
    "player_pass_yds_q1": "1st Quarter Passing Yards",
    "player_solo_tackles": "Solo Tackles",
    "player_assists": "Assisted Tackles",
    "player_tackles_assists": "Tackles",
    "player_defensive_interceptions": "Defensive Interceptions",
    "player_field_goals": "Field Goals Made",
    "player_pats": "Extra Points Made",
    "player_kicking_points": "Kicking Points",
    "player_anytime_td": "Anytime Touchdown",
    "player_1st_td": "First Touchdown",
    "player_last_td": "Last Touchdown"
  },
  "baseball": {
    "batter_hits": "Hits",
    "pitcher_strikeouts": "Pitcher Strikeouts",
    "batter_total_bases": "Total Bases",
    "batter_home_runs": "Home Runs",
    "batter_rbis": "RBIs",
    "pitcher_outs": "Pitcher Outs",
    "batter_runs_scored": "Runs",
    "batter_hits_runs_rbis": "Hits + Runs + RBIs",
    "batter_singles": "Singles",
    "batter_doubles": "Doubles",
    "batter_triples": "Triples",
    "batter_walks": "Batter Walks",
    "batter_strikeouts": "Batter Strikeouts",
    "batter_fantasy_score": "Batter Fantasy Points",
    "pitcher_hits_allowed": "Pitcher Hits Allowed",
    "pitcher_walks": "Pitcher Walks",
    "pitcher_earned_runs": "Pitcher Earned Runs"
  },
  "hockey": {
    "player_shots_on_goal": "Shots on Goal",
    "player_points": "Points",
    "player_total_saves": "Goalie Saves",
    "player_assists": "Assists",
    "player_goals": "Goals",
    "player_power_play_points": "Power Play Points",
    "player_blocked_shots": "Blocked Shots",
    "player_faceoffs_won": "Faceoffs Won",
    "player_time_on_ice": "Time on Ice",
    "player_goal_scorer_anytime": "Anytime Goal",
    "player_goal_scorer_first": "First Goal",
    "player_goal_scorer_last": "Last Goal"
  },
  "soccer": {
    "player_shots": "Shots",
    "player_shots_on_target": "Shots on Target",
    "player_assists": "Assists",
    "player_goal_scorer_anytime": "Anytime Goal",
    "player_first_goal_scorer": "First Goal",
    "player_last_goal_scorer": "Last Goal",
    "player_to_receive_card": "Yellow Cards",
    "player_to_receive_red_card": "Red Cards"
  },
  "tennis": {},
  "mma": {}
}
const families:Record<string,string>={"NBA":"basketball","WNBA":"basketball","NCAAB":"basketball","NFL":"football","NCAAF":"football","MLB":"baseball","NHL":"hockey","SOCCER":"soccer","TENNIS":"tennis","MMA":"mma"}
export function propGroups(sport:string){return groups[families[sport]]??{}}
export function canonicalProp(sport:string,market:string,label:string){return marketLabels[families[sport]]?.[market.replace(/_alternate$/,'')]??label}
export function propCatalog(sport:string){return Object.values(propGroups(sport)).flat()}
export function historicalMarket(sport:string,market:string){const label=marketLabels[families[sport]]?.[market.replace(/_alternate$/,'')];return label&& !/Fantasy Points|First Basket|First Team Basket|First Touchdown|Last Touchdown|First Goal|Last Goal|Quarter|Half|Yellow Cards|Red Cards/.test(label)?label:undefined}
