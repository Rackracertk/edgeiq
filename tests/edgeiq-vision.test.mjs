import test from 'node:test'
import assert from 'node:assert/strict'
import {baselineBacktest,phaseEvidence,conditionalGameFlow} from '../src/analytics/publicGameEvidence.ts'
const event=(i,state='post')=>({id:String(i),date:new Date(Date.UTC(2026,10,1+i)).toISOString(),path:'basketball/nba',state,participants:[{id:'a',name:'A',score:100},{id:'b',name:'B',score:90}],segments:[{label:'1',values:[25,22]}]})
test('accuracy excludes target, future results and live results; only earlier games qualify',()=>{const target=event(9,'pre');const history=Array.from({length:10},(_,i)=>event(i));const r=baselineBacktest([...history,event(10),event(8,'in')],target,Date.parse(target.date));assert.equal(r.samples,4);assert.equal(r.mae,0);assert.ok(r.examples.every(x=>Date.parse(x.date)<Date.parse(target.date)))})
test('phase evidence never turns missing segments into zero',()=>{const target=event(9,'pre');const r=phaseEvidence([event(1),event(2),event(3)],target,Date.parse(target.date));assert.equal(r[0].teams[0].mean,25);assert.equal(r[0].teams[0].n,3);assert.equal(r[1].teams[0].mean,null);assert.equal(r[1].teams[0].n,0)})

test('conditional flow uses named teams only when sufficient comparable evidence exists',()=>{const target=event(9,'pre');const history=Array.from({length:5},(_,i)=>event(i));const flow=conditionalGameFlow(history,target,Date.parse(target.date));assert.match(flow.context,/A has the higher recent scoring baseline/);assert.match(flow.scenario,/If A builds/);assert.equal(conditionalGameFlow(history.slice(0,4),target,Date.parse(target.date)),null)})
