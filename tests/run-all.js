// Chạy toàn bộ kiểm thử: node tests/run-all.js
// Tự tìm thư viện JSZip (biến môi trường JSZIP_PATH nếu muốn chỉ định).
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

function findJSZip() {
  const cands = [process.env.JSZIP_PATH, '/opt/npm-tools/node_modules/jszip', path.join(__dirname, '..', 'node_modules', 'jszip')];
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  try { require.resolve('jszip'); return 'jszip'; } catch (e) { return null; }
}

const suites = [
  'wiring.test.js',
  'mod-core.test.js',
  'mod-store.test.js',
  'mod-ui.smoke.js',
  'mobile.smoke.js',
  'extras.test.js'
];
const needsZip = new Set(['mod-store.test.js', 'mod-ui.smoke.js']);
const zip = findJSZip();
let failed = 0;
for (const s of suites) {
  const env = Object.assign({}, process.env);
  if (zip) env.JSZIP_PATH = zip;
  if (needsZip.has(s) && !zip) {
    console.log('SKIP ' + s + ' (không tìm thấy JSZip)');
    failed++;
    continue;
  }
  const r = spawnSync(process.execPath, [path.join(__dirname, s)], { env, encoding: 'utf8' });
  const tail = (r.stdout || '').trim().split('\n').slice(-1)[0];
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + s + ' — ' + tail);
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
}
console.log(failed ? '\n' + failed + ' bộ kiểm thử lỗi' : '\nTất cả bộ kiểm thử đạt');
process.exitCode = failed ? 1 : 0;
