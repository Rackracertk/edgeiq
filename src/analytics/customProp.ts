// Local research inputs, never a sportsbook quote or a prediction.
export function parseCustomLine(value:string):number|null{
 if(!value.trim())return null
 const n=Number(value)
 return Number.isFinite(n)&&Math.abs(n)<=100000?n:null
}
export function parseAmericanOdds(value:string):number|null{
 if(!/^[+-]?\d+$/.test(value.trim()))return null
 const n=Number(value)
 return Number.isSafeInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000?n:null
}
export function impliedProbability(odds:number):number|null{
 if(!Number.isFinite(odds)||Math.abs(odds)<100)return null
 return odds<0?(-odds)/(-odds+100)*100:100/(odds+100)*100
}
