// Kiểm tra "dây nối" của bản triển khai: file được tham chiếu có tồn tại, đã nằm trong cache offline,
// và các script theo đúng thứ tự phụ thuộc. Chạy: node tests/wiring.test.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
function t(name, ok, detail) {
  if (ok) { pass++; console.log('ok  ', name); }
  else { fail++; console.log('FAIL', name, detail ? '\n    ' + detail : ''); }
}

const html = read('index.html');
const sw = read('sw.js');

// 1) Các script/link cục bộ trong index.html phải có file thật
const localRefs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
for (const f of localRefs) t('script cục bộ tồn tại: ' + f, fs.existsSync(path.join(root, f)));

// 2) SHELL trong sw.js: mọi file cục bộ phải tồn tại
const shellBlock = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
const shell = [...shellBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
t('sw.js có khai báo SHELL', shell.length > 0);
for (const f of shell) {
  if (f === './') continue;
  t('SHELL: file tồn tại ' + f, fs.existsSync(path.join(root, f)));
}

// 3) Mọi script cục bộ của index.html phải có trong SHELL để chạy offline
for (const f of localRefs) {
  t('offline: ' + f + ' có trong SHELL', shell.includes('./' + f), 'thêm "./' + f + '" vào SHELL trong sw.js');
}

// 4) Thứ tự phụ thuộc: lõi mod trước store, store trước UI, extras trước mobile (để nút mới vào menu ⋯)
const pos = f => localRefs.indexOf(f);
const order = [['mods/mod-core.js', 'mods/mod-store.js'], ['mods/mod-store.js', 'mods/mod-ui.js'], ['extras.js', 'mobile.js'], ['mods/mod-ui.js', 'mobile.js']];
for (const [a, b] of order) {
  t('thứ tự: ' + a + ' trước ' + b, pos(a) >= 0 && pos(b) >= 0 && pos(a) < pos(b), 'vị trí: ' + pos(a) + ', ' + pos(b));
}

// 5) Phiên bản cache phải là dạng vnc-vN
const v = (sw.match(/const V = '([^']+)'/) || [])[1];
t('sw.js có phiên bản cache dạng vnc-vN', /^vnc-v\d+$/.test(v || ''), 'giá trị: ' + v);

// 6) manifest: icon phải tồn tại
const man = JSON.parse(read('manifest.webmanifest'));
for (const ic of man.icons || []) t('manifest icon tồn tại: ' + ic.src, fs.existsSync(path.join(root, ic.src)));

// 7) Các hàm/biến app mà script phụ dựa vào phải được định nghĩa trong index.html
const deps = ['function hint', 'function show', 'function ckpt', 'function shotRun', 'function loadCamVMD', 'function getF', 'let P=', 'let PR=', 'let camOn', 'let rotMode'];
for (const d of deps) {
  const k = d.replace(/^function /, '').replace(/^let /, '');
  const ok = html.includes(d) || new RegExp('(let|var|const)\\s[^;]*\\b' + k.replace(/[=(].*$/, '') + '\\b').test(html);
  t('định nghĩa có trong index.html: ' + d, ok);
}

console.log('\n' + pass + ' kiểm tra đạt, ' + fail + ' lỗi');
process.exitCode = fail ? 1 : 0;
