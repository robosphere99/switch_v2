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
try { console.log('node_modules aedes =', fs.existsSync('node_modules/aedes') ? 'yes' : 'no'); } catch (e) { }

console.log('\n--- BOOT TEST ---');
try {
  const out = cp.spawnSync(process.execPath, ['dist/index.mjs'], { cwd, encoding: 'utf8', timeout: 3000, env: process.env });
  console.log('BOOT EXIT CODE:', out.status);
  if (out.stdout) console.log('STDOUT:', out.stdout.slice(-1000));
  if (out.stderr) console.log('STDERR:', out.stderr.slice(-1000));
  if (out.error) console.log('ERR:', out.error.message);
} catch (e) {
  console.log('Boot test failed to run:', e.message);
}

try {
  let logs = [];
  const findLogs = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (let f of fs.readdirSync(dir)) {
      let p = dir + '/' + f;
      if (fs.statSync(p).isDirectory()) { findLogs(p); }
      else if (f.endsWith('.log')) {
        let st = fs.statSync(p);
        logs.push({ path: p, ts: st.mtimeMs });
      }
    }
  };
  findLogs('iisnode');
  if (fs.existsSync('../logs/iisnode')) findLogs('../logs/iisnode');
  if (fs.existsSync('../../logs/iisnode')) findLogs('../../logs/iisnode');
  logs.sort((a, b) => b.ts - a.ts);
  if (logs.length > 0) {
    console.log('\n--- LATEST IISNODE CRASH LOG (' + logs[0].path + ') ---');
    console.log(fs.readFileSync(logs[0].path, 'utf8').slice(-1000));
  } else {
    console.log('\nNo iisnode logs found!');
  }
} catch (e) {
  console.log('IIS log error:', e.message);
}
