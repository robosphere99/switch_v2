// Server-side diagnostic — Plesk Node.js "Run script" se chalaya jata hai: npm run diag
// Ye check karta hai: deploy layout, dist/index.mjs state (read-only/lock), git state, marker.
const fs = require('fs');
const cp = require('child_process');
const cwd = process.cwd();
const sh = (cmd) => {
  try { return cp.execSync(cmd, { cwd, encoding: 'utf8', timeout: 15000 }).trim(); }
  catch (e) { return 'ERR: ' + String(e.stderr || e.message || '').split('\n')[0].slice(0, 150); }
};
const ls = (p) => { try { return fs.readdirSync(p).join(', '); } catch (e) { return 'ERR:' + e.code; } };
console.log('CWD =', cwd);
console.log('LS-top =', ls('.'));
console.log('site/ =', fs.existsSync('site') ? ls('site') : 'NO');
console.log('site/deploy.cmd =', fs.existsSync('site/deploy.cmd') ? 'EXISTS' : 'MISSING');
console.log('src/app.ts =', fs.existsSync('src/app.ts') ? 'EXISTS marker=' + (fs.readFileSync('src/app.ts', 'utf8').includes('e2e-auto-deploy-v1') ? 'CURRENT' : 'STALE') : 'NO');
console.log('dist/ =', fs.existsSync('dist') ? ls('dist') : 'NO');
try { const s = fs.statSync('dist/index.mjs'); console.log('dist/index.mjs =', JSON.stringify({ size: s.size, mtime: s.mtime.toISOString() })); } catch (e) { console.log('dist/index.mjs ERR', e.code); }
try { fs.accessSync('dist/index.mjs', fs.constants.W_OK); console.log('W_OK=true'); } catch (e) { console.log('W_OK=FALSE', e.code); }
try { fs.writeFileSync('_probe.txt', 'ok'); console.log('WRITE=OK'); fs.unlinkSync('_probe.txt'); } catch (e) { console.log('WRITE=FAIL', e.code); }
try { console.log('deploy.json =', fs.readFileSync('../logs/deploy.json', 'utf8').slice(0, 300)); } catch (e) { console.log('deploy.json ERR', e.code); }
console.log('node_modules esbuild =', fs.existsSync('node_modules/esbuild') ? 'yes' : 'no');
console.log('node_modules tsc =', fs.existsSync('node_modules/typescript') ? 'yes' : 'no');
console.log('git HEAD =', sh('git rev-parse HEAD'));
console.log('git branch =', sh('git rev-parse --abbrev-ref HEAD'));
console.log('git log-1 =', sh('git log --oneline -1'));
console.log('git status =', sh('git status --short').slice(0, 500));
console.log('git ls dist =', sh('git ls-files dist'));
