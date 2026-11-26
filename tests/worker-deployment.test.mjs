import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('Cloudflare Worker matches existing dashboard service and publishes Vite output',()=>{const c=JSON.parse(read('wrangler.jsonc'));assert.equal(c.name,'edgeiq');assert.equal(c.assets.directory,'./dist');assert.equal(c.assets.not_found_handling,'single-page-application');assert.equal(c.main,undefined);assert.equal(c.routes,undefined)})
test('production build includes a public commit marker without credential data',()=>{assert.equal(JSON.parse(read('package.json')).scripts.postbuild,'node scripts/write-build-info.mjs');assert.match(read('scripts/write-build-info.mjs'),/rev-parse/);assert.match(read('public/_headers'),/\/build-info\.json\s+Cache-Control: no-store/)})
