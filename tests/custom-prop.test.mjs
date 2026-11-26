import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCustomLine,parseAmericanOdds,impliedProbability} from '../src/analytics/customProp.ts'
import {calculateRecentHitRates} from '../src/analytics/hitRates.ts'
test('custom line handles half points, zero, negative values and empty inputs',()=>{assert.equal(parseCustomLine('24.5'),24.5);assert.equal(parseCustomLine('0'),0);assert.equal(parseCustomLine('-0.5'),-.5);for(const v of ['',' ','NaN','Infinity','100001'])assert.equal(parseCustomLine(v),null)})
test('American odds are validated and implied probability is arithmetic, not a model forecast',()=>{assert.equal(parseAmericanOdds('+150'),150);assert.equal(parseAmericanOdds('-110'),-110);for(const v of ['','0','99','-99','+100.5','Infinity'])assert.equal(parseAmericanOdds(v),null);assert.equal(impliedProbability(150),40);assert.ok(Math.abs(impliedProbability(-110)-52.38095238)<.000001);assert.equal(impliedProbability(0),null)})
test('changing research line or side recomputes historical rates',()=>{const values=[30,27,25,20,19];assert.equal(calculateRecentHitRates(values,24.5,'over').L5,60);assert.equal(calculateRecentHitRates(values,27.5,'over').L5,20);assert.equal(calculateRecentHitRates(values,24.5,'under').L5,40)})
