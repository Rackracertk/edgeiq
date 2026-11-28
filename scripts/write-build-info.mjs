import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {nflHistoryPublication} from './nfl-history-publication.mjs'
let commit='unknown'
try { const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); if(/^[a-f0-9]{40}$/i.test(sha))commit=sha } catch {}
writeFileSync('dist/build-info.json',JSON.stringify({app:'EDGEIQ',commit,builtAt:new Date().toISOString()})+'\n')

if(existsSync('data/edgeiq-research-cache.json')){
 const cache=JSON.parse(readFileSync('data/edgeiq-research-cache.json','utf8'))
 const publication=nflHistoryPublication(cache)
 if(publication){writeFileSync('dist/edgeiq-nfl-history.json',JSON.stringify(publication)+'\n');console.log('Published NFL history for',Object.keys(publication.players).length,'players')}
 else console.warn('No eligible cached NFL history to publish')
}
