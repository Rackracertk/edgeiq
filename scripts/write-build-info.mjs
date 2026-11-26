import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
let commit='unknown'
try { const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); if(/^[a-f0-9]{40}$/i.test(sha))commit=sha } catch {}
writeFileSync('dist/build-info.json',JSON.stringify({app:'EDGEIQ',commit,builtAt:new Date().toISOString()})+'\n')
