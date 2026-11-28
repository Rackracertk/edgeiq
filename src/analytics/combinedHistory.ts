type Row={value:number;date:string;gameId?:string}
export function addFootballCombinations(history:Record<string,Row[]>){
 const combinations:Record<string,string[]>={'Passing + Rushing Yards':['Passing Yards','Rushing Yards'],'Rushing + Receiving Yards':['Rushing Yards','Receiving Yards'],'Passing + Rushing + Receiving Yards':['Passing Yards','Rushing Yards','Receiving Yards'],'Rushing + Receiving TDs':['Rushing TDs','Receiving TDs'],'Passing + Rushing + Receiving TDs':['Passing TDs','Rushing TDs','Receiving TDs']}
 for(const [label,parts] of Object.entries(combinations)){
  const first=history[parts[0]]??[],result:Row[]=[]
  for(const row of first){if(!row.gameId)continue;const others=parts.slice(1).map(p=>history[p]?.find(r=>r.gameId===row.gameId));if(others.every(r=>r&&Number.isFinite(r.value)))result.push({...row,value:row.value+others.reduce((s,r)=>s+r!.value,0)})}
  if(result.length)history[label]=result
 }
 // A known positive TD count establishes a positive event; a missing other stat never establishes a zero.
 const known=history['Rushing + Receiving TDs'];if(known?.length)history['Anytime Touchdown']=known.map(r=>({...r,value:r.value>0?1:0}))
 return history
}
