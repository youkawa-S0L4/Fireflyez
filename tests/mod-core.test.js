// Chạy: node tests/mod-core.test.js
const assert = require('assert');
const C = require('../mods/mod-core.js');

let pass = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n   ', e.message); process.exitCode = 1; } }

const good = { format: 'vnmod', format_version: 1, id: 'vnc.sample-ocean', name: 'Đại dương', version: '1.0.0', api: 1, permissions: ['theme'], provides: { theme: 'theme.json' } };
const files = new Set(['manifest.json', 'theme.json']);

t('normalizePath chặn path traversal', () => {
  for (const p of ['../a.json', 'a/../../b.json', '/etc/x.json', 'C:/x.json', 'a\\b.json', 'a//b.json', 'a/./b.json', 'a\0b.json', '']) {
    assert.strictEqual(C.normalizePath(p), null, 'phải từ chối: ' + JSON.stringify(p));
  }
  assert.strictEqual(C.normalizePath('assets/icon.png'), 'assets/icon.png');
});

t('validateFileList từ chối file không an toàn và file lạ', () => {
  assert.ok(C.validateFileList([{ path: 'x.js', size: 10 }]).some(e => /không được phép/.test(e)));
  assert.ok(C.validateFileList([{ path: 'x.html', size: 10 }]).length > 0);
  assert.ok(C.validateFileList([{ path: 'x.wasm', size: 10 }]).length > 0);
  assert.ok(C.validateFileList([{ path: 'big.json', size: C.LIMITS.fileBytes + 1 }]).some(e => /quá lớn/.test(e)));
  assert.deepStrictEqual(C.validateFileList([{ path: 'theme.json', size: 100 }]), []);
});

t('validateFileList phát hiện trùng đường dẫn (không phân biệt hoa thường)', () => {
  assert.ok(C.validateFileList([{ path: 'A.json', size: 1 }, { path: 'a.json', size: 1 }]).some(e => /Trùng/.test(e)));
});

t('validateFileList giới hạn tổng dung lượng', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ path: 'f' + i + '.json', size: 400 * 1024 }));
  assert.ok(C.validateFileList(list).some(e => /Tổng dung lượng/.test(e)));
});

t('validateManifest nhận manifest hợp lệ', () => {
  const m = C.validateManifest(good, files);
  assert.strictEqual(m.author, 'Ẩn danh');
  assert.deepStrictEqual(m.permissions, ['theme']);
});

t('validateManifest từ chối id sai, version sai, quyền lạ', () => {
  const bad = [
    { id: 'A B' }, { id: 'ab' }, { version: '1.0' }, { permissions: ['exec'] }, { format: 'zip' },
    { format_version: 2 }, { api: 0 }, { name: '' }, { provides: { theme: 'nope.json' } },
    { provides: { theme: 'theme.txt' } }, { provides: { readme: 'missing.md' } }
  ];
  for (const b of bad) {
    assert.throws(() => C.validateManifest(Object.assign({}, good, b), files), C.ModError, 'phải từ chối ' + JSON.stringify(b));
  }
});

t('validateManifest: quyền theme bắt buộc có provides.theme', () => {
  const m = Object.assign({}, good, { provides: {} });
  assert.throws(() => C.validateManifest(m, files), C.ModError);
});

t('tags: nhận nhóm hợp lệ, chuẩn hoá chữ thường và bỏ trùng', () => {
  const m = C.validateManifest(Object.assign({}, good, { tags: ['Giao Diện', 'giao diện', 'mẫu'] }), files);
  assert.deepStrictEqual(m.tags, ['giao diện', 'mẫu']);
  assert.deepStrictEqual(C.validateManifest(good, files).tags, []);
});

t('tags: từ chối nhóm quá dài, ký tự lạ, quá nhiều nhóm', () => {
  assert.throws(() => C.validateManifest(Object.assign({}, good, { tags: ['x'.repeat(25)] }), files), C.ModError);
  assert.throws(() => C.validateManifest(Object.assign({}, good, { tags: ['<script>'] }), files), C.ModError);
  assert.throws(() => C.validateManifest(Object.assign({}, good, { tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), files), C.ModError);
  assert.throws(() => C.validateManifest(Object.assign({}, good, { tags: 'mẫu' }), files), C.ModError);
});

t('checkCompat đánh dấu mod cần API cao hơn app là không tương thích', () => {
  assert.strictEqual(C.checkCompat({ api: 1 }).ok, true);
  const r = C.checkCompat({ api: 99 });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /API 99/);
});

t('validateTheme chỉ cho biến màu trong danh sách và giá trị hex', () => {
  assert.deepStrictEqual(C.validateTheme({ vars: { '--ac': '#0E7490' } }), { '--ac': '#0e7490' });
  assert.throws(() => C.validateTheme({ vars: { 'color': '#fff' } }), C.ModError);
  assert.throws(() => C.validateTheme({ vars: { '--ac': 'red' } }), C.ModError);
  assert.throws(() => C.validateTheme({ vars: { '--ac': 'url(http://x)' } }), C.ModError);
  assert.throws(() => C.validateTheme({ vars: { '--ac': '#fff; background:url(x)' } }), C.ModError);
  assert.throws(() => C.validateTheme({}), C.ModError);
  assert.throws(() => C.validateTheme({ vars: {} }), C.ModError);
});

t('findConflicts phát hiện trùng ID và trùng biến màu', () => {
  const r = C.findConflicts([
    { id: 'a.mod', enabled: true, vars: { '--ac': '#111111', '--bg': '#000000' } },
    { id: 'b.mod', enabled: true, vars: { '--ac': '#222222' } },
    { id: 'c.mod', enabled: false, vars: { '--ac': '#333333' } },
    { id: 'a.mod', enabled: false, vars: null }
  ]);
  assert.deepStrictEqual(r.duplicateIds, ['a.mod']);
  const acRes = r.resources.find(x => x.key === '--ac');
  assert.deepStrictEqual(acRes.mods, ['a.mod', 'b.mod']);
  assert.strictEqual(acRes.winner, 'b.mod');
  assert.ok(!r.resources.some(x => x.key === '--bg'));
});

t('findConflicts bỏ qua mod đã tắt', () => {
  const r = C.findConflicts([{ id: 'x.mod', enabled: true, vars: { '--ac': '#111111' } }, { id: 'y.mod', enabled: false, vars: { '--ac': '#222222' } }]);
  assert.deepStrictEqual(r.resources, []);
});

t('compareVersion', () => {
  assert.ok(C.compareVersion('1.2.0', '1.10.0') < 0);
  assert.strictEqual(C.compareVersion('2.0.0', '2.0.0'), 0);
  assert.ok(C.compareVersion('2.0.1', '2.0.0') > 0);
});

t('validatePoses nhận tư thế hợp lệ và giữ nguyên góc', () => {
  const r = C.validatePoses({ poses: { 'Giơ tay': { '左腕': [0, 0, 120], '右腕': [0, 0, -120] } } });
  assert.deepStrictEqual(r['Giơ tay']['左腕'], [0, 0, 120]);
});

t('validatePoses từ chối góc ngoài khoảng, không phải số, sai số phần tử', () => {
  const P = b => ({ poses: { 'x': b } });
  assert.throws(() => C.validatePoses(P({ '頭': [0, 0, 181] })), C.ModError);
  assert.throws(() => C.validatePoses(P({ '頭': [0, 0, 'abc'] })), C.ModError);
  assert.throws(() => C.validatePoses(P({ '頭': [0, 0] })), C.ModError);
  assert.throws(() => C.validatePoses(P({ '頭': [0, NaN, 0] })), C.ModError);
  assert.throws(() => C.validatePoses(P({ '頭': [0, 0, Infinity] })), C.ModError);
});

t('validatePoses từ chối tên xương/tư thế có ký tự điều khiển hoặc quá dài', () => {
  assert.throws(() => C.validatePoses({ poses: { 'a\nb': { '頭': [0, 0, 0] } } }), C.ModError);
  assert.throws(() => C.validatePoses({ poses: { 'x': { ['頭\u0007']: [0, 0, 0] } } }), C.ModError);
  assert.throws(() => C.validatePoses({ poses: { 'x': { ['a'.repeat(41)]: [0, 0, 0] } } }), C.ModError);
});

t('validatePoses giới hạn số tư thế và số xương', () => {
  const many = {}; for (let i = 0; i < 11; i++) many['p' + i] = { '頭': [0, 0, 0] };
  assert.throws(() => C.validatePoses({ poses: many }), C.ModError);
  const bones = {}; for (let i = 0; i < 41; i++) bones['b' + i] = [0, 0, 0];
  assert.throws(() => C.validatePoses({ poses: { x: bones } }), C.ModError);
});

t('manifest: quyền pose bắt buộc có provides.pose là .json trong gói', () => {
  const m = Object.assign({}, good, { permissions: ['pose'], provides: {} });
  assert.throws(() => C.validateManifest(m, files), C.ModError);
  const ok = Object.assign({}, good, { permissions: ['pose'], provides: { pose: 'pose.json' } });
  assert.doesNotThrow(() => C.validateManifest(ok, new Set(['manifest.json', 'pose.json'])));
});

t('validateCameras nhận góc nhìn hợp lệ', () => {
  const r = C.validateCameras({ views: { 'Chính diện': { th: 0, ph: 1.5, ds: 60, tg: [0, 10, 0] } } });
  assert.deepStrictEqual(r['Chính diện'], { th: 0, ph: 1.5, ds: 60, tg: [0, 10, 0], rl: 0 });
});

t('validateCameras từ chối giá trị ngoài phạm vi và kiểu sai', () => {
  const V = v => ({ views: { x: v } });
  const ok = { th: 0, ph: 1.5, ds: 60, tg: [0, 0, 0] };
  assert.throws(() => C.validateCameras(V({ ...ok, th: 4 })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, ph: 0 })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, ph: 3.5 })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, ds: 0 })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, ds: 'xa' })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, tg: [0, 0] })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, tg: [0, NaN, 0] })), C.ModError);
  assert.throws(() => C.validateCameras(V({ ...ok, rl: 9 })), C.ModError);
  assert.throws(() => C.validateCameras({ views: { 'a\u0000b': ok } }), C.ModError);
});

t('manifest: quyền camera bắt buộc có provides.camera .json', () => {
  const m = Object.assign({}, good, { permissions: ['camera'], provides: {} });
  assert.throws(() => C.validateManifest(m, files), C.ModError);
});

t('buildMod tạo đủ file và manifest hợp lệ cho cả ba quyền', () => {
  const r = C.buildMod({ name: 'Mẫu đẹp', author: 'A', theme: { '--ac': '#112233' },
    poses: { 'Tư thế 1': { '頭': [0, 0, 10] } }, views: { 'Góc 1': { th: 0, ph: 1.5, ds: 60, tg: [0, 10, 0], rl: 0 } }, tags: ['mẫu'] });
  assert.deepStrictEqual(r.manifest.permissions.sort(), ['camera', 'pose', 'theme']);
  assert.ok(r.files['theme.json'] && r.files['pose.json'] && r.files['camera.json'] && r.files['manifest.json']);
  assert.match(r.id, /^vnc\.[a-z0-9-]+$/);
});

t('buildMod từ chối khi thiếu tên hoặc không có phần nào', () => {
  assert.throws(() => C.buildMod({ theme: { '--ac': '#111111' } }), C.ModError);
  assert.throws(() => C.buildMod({ name: 'Trống' }), C.ModError);
});

t('buildMod từ chối giá trị không hợp lệ (màu lạ, góc ngoài phạm vi)', () => {
  assert.throws(() => C.buildMod({ name: 'X', theme: { '--ac': 'red' } }), C.ModError);
  assert.throws(() => C.buildMod({ name: 'X', poses: { p: { '頭': [0, 0, 999] } } }), C.ModError);
  assert.throws(() => C.buildMod({ name: 'X', views: { v: { th: 0, ph: 9, ds: 1, tg: [0, 0, 0] } } }), C.ModError);
});

t('slugify tạo id hợp lệ từ tên tiếng Việt', () => {
  assert.strictEqual(C.slugify('Mẫu Đẹp Lắm!'), 'mau-dep-lam');
  assert.strictEqual(C.slugify('ab'), 'mod-ab');
  assert.match(C.slugify('???'), /^mod-/);
});

t('validateLight nhận độ sáng trong 0.2..1', () => {
  assert.deepStrictEqual(C.validateLight({ light: { level: 0.9 } }), { level: 0.9 });
});

t('validateLight từ chối ngoài phạm vi, kiểu sai, và thuộc tính lạ (không đổi màu)', () => {
  assert.throws(() => C.validateLight({ light: { level: 0.1 } }), C.ModError);
  assert.throws(() => C.validateLight({ light: { level: 2 } }), C.ModError);
  assert.throws(() => C.validateLight({ light: { level: 'to' } }), C.ModError);
  assert.throws(() => C.validateLight({ light: { level: 0.5, color: '#fff' } }), C.ModError);
});

console.log('\n' + pass + ' test đạt');
