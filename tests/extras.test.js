// Chạy: node tests/extras.test.js — kiểm tra bộ đọc VPD (phần thuần, không cần trình duyệt)
const assert = require('assert');
const noop = () => {};
const el = () => ({ append: noop, setAttribute: noop, style: {}, classList: { add: noop, remove: noop, contains: () => false } });
globalThis.document = { readyState: 'complete', head: { append: noop }, body: { append: noop }, addEventListener: noop,
  getElementById: () => null, createElement: el };
globalThis.window = globalThis;
require('../extras.js');
const { parseVPD } = globalThis.vnExtras;

const sample = [
  'Vocaloid Pose Data file',
  '',
  'Bone0{左腕',
  '0.0,0.0,0.0;',
  '0.0,0.0,0.0,1.0;',
  '}',
  'Bone1{右腕',
  '0.0,0.0,0.0;',
  '0.0,0.0,0.7071068,0.7071068;',
  '}'
].join('\r\n');

let pass = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n   ', e.message); process.exitCode = 1; } }

t('đọc đúng tên xương và quaternion (x,y,z,w)', () => {
  const m = parseVPD(sample);
  assert.deepStrictEqual(Object.keys(m).sort(), ['右腕', '左腕'].sort());
  assert.deepStrictEqual(m['左腕'], [0, 0, 0, 1]);
  assert.ok(Math.abs(m['右腕'][2] - 0.7071068) < 1e-9);
});

t('file không phải VPD thì báo lỗi rõ ràng', () => {
  assert.throws(() => parseVPD('đây là văn bản thường'), /không đúng định dạng VPD/);
});

t('VPD có khối Bone nhưng thiếu số liệu thì báo không đọc được xương nào', () => {
  assert.throws(() => parseVPD('Bone0{頭\n1,2;\n}'), /Không đọc được xương nào/);
});

t('chấp nhận số dạng khoa học', () => {
  const m = parseVPD('Bone0{頭\n0e0,0,0;\n1.0e-1,0,0,1;\n}');
  assert.strictEqual(m['頭'][0], 0.1);
});

console.log('\n' + pass + ' test extras đạt');
