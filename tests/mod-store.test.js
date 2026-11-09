// Chạy: node tests/mod-store.test.js
// Môi trường giả lập: IndexedDB trong bộ nhớ, document tối thiểu, JSZip thật.
// JSZIP_PATH có thể trỏ tới thư mục chứa jszip nếu không cài trong dự án.
const assert = require('assert');
const JSZIP_PATH = process.env.JSZIP_PATH || 'jszip';
const JSZipLib = require(JSZIP_PATH);

// JSZip trong trình duyệt đọc được Blob/File; trong Node ta chuyển sang ArrayBuffer trước khi đọc.
// rawEntries: nếu đặt, loadAsync trả về đúng các tên thô này (mô phỏng zip độc hại,
// vì JSZip thật tự làm sạch '../' khi đọc nên không thể tạo tên đó bằng JSZip).
let rawEntries = null;
globalThis.JSZip = class extends JSZipLib {
  static loadAsync(src, o) {
    if (rawEntries) {
      const map = rawEntries;
      return Promise.resolve({
        forEach(cb) { for (const [n, body] of Object.entries(map)) cb(n, { name: n, dir: false, async: async () => body }); }
      });
    }
    return JSZipLib.loadAsync(src && typeof src.arrayBuffer === 'function' ? src.arrayBuffer() : src, o);
  }
};

// ---- Giả lập DOM tối thiểu cho việc áp biến CSS
const styleMap = new Map();
globalThis.document = {
  documentElement: { style: {
    setProperty(k, v) { styleMap.set(k, v); },
    removeProperty(k) { styleMap.delete(k); },
    getPropertyValue(k) { return styleMap.get(k) || ''; }
  } },
  body: { append() {} },
  createElement() { return { click() {}, remove() {}, set href(v) {}, set download(v) {} }; }
};
globalThis.URL.createObjectURL = () => 'blob:test';
globalThis.URL.revokeObjectURL = () => {};

// ---- IndexedDB giả: store, get/put/delete/getAll/clear; oncomplete sau khi mọi request xong
function makeIDB() {
  const dbs = new Map();
  function handle(db) {
    return {
      createObjectStore(name, opts) { db.stores.set(name, { keyPath: opts.keyPath, data: new Map() }); },
      transaction(name) {
        const st = db.stores.get(name);
        const t = { oncomplete: null, onerror: null, onabort: null, error: null };
        let pending = 0, finished = false;
        const settle = () => {
          if (finished || pending > 0) return;
          finished = true;
          setTimeout(() => t.oncomplete && t.oncomplete(), 0);
        };
        const run = fn => {
          const rq = { result: undefined };
          pending++;
          setTimeout(() => { try { rq.result = fn(); } catch (e) { t.error = e; } pending--; settle(); }, 0);
          return rq;
        };
        t.objectStore = () => ({
          get: k => run(() => st.data.get(k)),
          put: v => run(() => { st.data.set(v[st.keyPath], v); return v[st.keyPath]; }),
          delete: k => run(() => { st.data.delete(k); }),
          getAll: () => run(() => [...st.data.values()]),
          clear: () => run(() => { st.data.clear(); })
        });
        return t;
      }
    };
  }
  return {
    open(name, ver) {
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        let db = dbs.get(name);
        const fresh = !db;
        if (fresh) { db = { stores: new Map() }; dbs.set(name, db); }
        req.result = handle(db);
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    }
  };
}
globalThis.indexedDB = makeIDB();

require('../mods/mod-core.js');
require('../mods/mod-store.js');
const store = globalThis.VNMod.store;

let pass = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('ok  ', name); }
  catch (e) { console.log('FAIL', name, '\n   ', e.message); process.exitCode = 1; }
}

const color = () => styleMap.get('--ac');
function rawPut(rec) {
  return new Promise((ok, no) => {
    const rq = indexedDB.open('vnmod', 1);
    rq.onsuccess = () => {
      const t = rq.result.transaction('mods', 'readwrite');
      t.objectStore().put(rec);
      t.oncomplete = () => ok();
    };
  });
}
async function makeZip(entries) {
  const z = new JSZipLib();
  for (const [p, c] of Object.entries(entries)) z.file(p, c);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
const toFile = (buf, name) => new File([buf], name);
const manifest = over => JSON.stringify(Object.assign({
  format: 'vnmod', format_version: 1, id: 'vnc.ocean', name: 'Đại dương', version: '1.0.0',
  api: 1, permissions: ['theme'], provides: { theme: 'theme.json' }
}, over || {}));
const theme = vars => JSON.stringify({ vars: vars || { '--ac': '#0e7490' } });

(async () => {
  await t('nhập gói hợp lệ, bật và áp dụng màu', async () => {
    const buf = await makeZip({ 'manifest.json': manifest(), 'theme.json': theme(), 'README.md': '# hi' });
    const r = await store.importMod(toFile(buf, 'ocean.vnmod'));
    assert.strictEqual(r.id, 'vnc.ocean');
    const list = await store.listMods();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].enabled, true);
    assert.strictEqual(color(), '#0e7490');
  });

  await t('từ chối đường dẫn traversal (../), không lưu gì', async () => {
    rawEntries = { 'manifest.json': manifest({ id: 'vnc.evil' }), 'theme.json': theme(), '../x.json': '{}' };
    try {
      await assert.rejects(store.importMod(toFile(Buffer.from('x'), 'evil.vnmod')), e => e.code === 'path');
    } finally { rawEntries = null; }
    assert.ok(!(await store.listMods()).some(m => m.id === 'vnc.evil'));
  });

  await t('từ chối đường dẫn tuyệt đối (/etc/x) và ổ đĩa (C:/)', async () => {
    for (const bad of ['/etc/passwd.json', 'C:/x.json']) {
      rawEntries = { 'manifest.json': manifest({ id: 'vnc.abs' }), 'theme.json': theme(), [bad]: '{}' };
      try {
        await assert.rejects(store.importMod(toFile(Buffer.from('x'), 'abs.vnmod')), e => e.code === 'path', bad);
      } finally { rawEntries = null; }
    }
  });

  await t('từ chối file JavaScript trong gói', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.js1' }), 'theme.json': theme(), 'run.js': 'alert(1)' });
    await assert.rejects(store.importMod(toFile(buf, 'js.vnmod')), e => e.code === 'files' && /run\.js/.test(e.message));
  });

  await t('từ chối gói thiếu manifest.json', async () => {
    const buf = await makeZip({ 'theme.json': theme() });
    await assert.rejects(store.importMod(toFile(buf, 'nom.vnmod')), e => e.code === 'manifest');
  });

  await t('từ chối giá trị màu kiểu CSS injection', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.inj' }), 'theme.json': theme({ '--ac': '#fff;background:url(http://x)' }) });
    await assert.rejects(store.importMod(toFile(buf, 'inj.vnmod')), e => e.code === 'theme');
  });

  await t('từ chối file không phải zip', async () => {
    await assert.rejects(store.importMod(toFile(Buffer.from('không phải zip'), 'bad.vnmod')), e => e.code === 'zip');
  });

  await t('từ chối đuôi file không phải .vnmod/.zip', async () => {
    const buf = await makeZip({ 'manifest.json': manifest() });
    await assert.rejects(store.importMod(toFile(buf, 'mod.exe')), e => e.code === 'ext');
  });

  await t('trùng ID: báo exists, thay thế được khi replace', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ version: '1.1.0' }), 'theme.json': theme({ '--ac': '#123456' }) });
    await assert.rejects(store.importMod(toFile(buf, 'o.vnmod')), e => e.code === 'exists');
    const r = await store.importMod(toFile(buf, 'o.vnmod'), { replace: true });
    assert.strictEqual(r.replaced, true);
    assert.strictEqual(color(), '#123456');
    assert.strictEqual((await store.listMods()).length, 1);
  });

  await t('tắt mod thì gỡ màu, bật lại thì áp lại', async () => {
    await store.setEnabled('vnc.ocean', false);
    assert.strictEqual(color(), undefined);
    await store.setEnabled('vnc.ocean', true);
    assert.strictEqual(color(), '#123456');
  });

  await t('mod cần API cao hơn app: lưu nhưng tắt, không bật được', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.future', api: 99 }), 'theme.json': theme({ '--bg': '#000000' }) });
    await store.importMod(toFile(buf, 'f.vnmod'));
    const m = (await store.listMods()).find(x => x.id === 'vnc.future');
    assert.strictEqual(m.enabled, false);
    await assert.rejects(store.setEnabled('vnc.future', true), e => e.code === 'compat');
  });

  await t('phát hiện xung đột biến màu giữa hai mod đang bật', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.second', name: 'Khác' }), 'theme.json': theme({ '--ac': '#ff0000' }) });
    await store.importMod(toFile(buf, 's.vnmod'));
    const res = store.getReport().conflicts.resources.find(x => x.key === '--ac');
    assert.ok(res, 'phải báo xung đột --ac');
    assert.deepStrictEqual([...res.mods].sort(), ['vnc.ocean', 'vnc.second']);
    assert.strictEqual(res.winner, 'vnc.second');
    assert.strictEqual(color(), '#ff0000', 'mod cài sau thắng');
  });

  await t('mô phỏng khởi động lại: màu được áp lại từ IndexedDB', async () => {
    styleMap.clear();
    await store.applyAll();
    assert.strictEqual(color(), '#ff0000');
  });

  await t('mod có dữ liệu hỏng trong IndexedDB: tự tắt, ghi lỗi, mod khác vẫn chạy', async () => {
    // Ghi thẳng một bản ghi hỏng (màu không hợp lệ) vào kho, như khi dữ liệu bị sửa ngoài ý muốn
    const good = await makeZip({ 'manifest.json': manifest({ id: 'vnc.good' }), 'theme.json': theme({ '--bd': '#abcdef' }) });
    await store.importMod(toFile(good, 'g.vnmod'));
    await rawPut({ id: 'vnc.broken', enabled: true, installedAt: 0, updatedAt: 0,
      manifest: { id: 'vnc.broken', name: 'Hỏng', version: '1.0.0', api: 1 }, files: {},
      compat: { ok: true, reason: '' }, theme: { '--ac': 'url(http://evil)' } });
    styleMap.clear();
    try {
      const rep = await store.applyAll();
      assert.ok(rep.errors.some(e => e.id === 'vnc.broken'), 'phải ghi lỗi cho mod hỏng');
      assert.notStrictEqual(color(), 'url(http://evil)', 'không được áp giá trị lạ');
      assert.strictEqual(styleMap.get('--bd'), '#abcdef', 'mod đúng vẫn được áp');
      const broken = (await store.listMods()).find(m => m.id === 'vnc.broken');
      assert.strictEqual(broken.enabled, false, 'mod hỏng phải bị tắt');
    } finally {
      await store.removeMod('vnc.broken');
      await store.removeMod('vnc.good');
    }
  });

  await t('gỡ mod: mất màu và không còn trong danh sách', async () => {
    await store.removeMod('vnc.second');
    assert.strictEqual(color(), '#123456', 'quay lại màu của mod còn lại');
    await store.removeMod('vnc.ocean');
    assert.strictEqual(color(), undefined);
    assert.ok(!(await store.listMods()).some(m => m.id === 'vnc.ocean'));
  });

  await t('từ chối file quá lớn sau giải nén (chống zip bomb)', async () => {
    const big = Buffer.alloc(600 * 1024, 0x61);
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.bomb' }), 'theme.json': theme(), 'big.json': big });
    await assert.rejects(store.importMod(toFile(buf, 'b.vnmod')), e => e.code === 'size');
  });

  await t('xuất mod và sao lưu/khôi phục giữ trạng thái bật/tắt', async () => {
    const b1 = await makeZip({ 'manifest.json': manifest({ id: 'vnc.keep' }), 'theme.json': theme({ '--bd': '#00ff00' }) });
    const b2 = await makeZip({ 'manifest.json': manifest({ id: 'vnc.off' }), 'theme.json': theme({ '--fg': '#111111' }) });
    await store.importMod(toFile(b1, 'k.vnmod'));
    await store.importMod(toFile(b2, 'o.vnmod'));
    await store.setEnabled('vnc.off', false);
    await store.exportMod('vnc.keep');
    // vnc.future (api 99) còn từ bài test trước nên kho có 3 mod
    const n = await store.backupAll();
    assert.strictEqual(n, (await store.listMods()).length);
    // Lấy bản sao lưu vừa tạo (gọi lại trực tiếp để có Blob) và khôi phục vào kho trống
    const backup = await captureBackup();
    for (const m of await store.listMods()) await store.removeMod(m.id);
    const r = await store.restoreBackup(backup);
    assert.strictEqual(r.ok, n, JSON.stringify(r.fail));
    const after = Object.fromEntries((await store.listMods()).map(m => [m.id, m.enabled]));
    assert.deepStrictEqual(after, { 'vnc.keep': true, 'vnc.off': false, 'vnc.future': false });
  });

  await t('mod mẫu đi kèm (mods/sample-ocean.vnmod) nhập được và áp màu', async () => {
    const fs = require('fs'), path = require('path');
    const buf = fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-ocean.vnmod'));
    const r = await store.importMod(toFile(buf, 'sample-ocean.vnmod'), { replace: true });
    assert.strictEqual(r.id, 'vnc.sample-ocean');
    assert.ok(r.compat.ok);
    const rec = (await store.listMods()).find(m => m.id === 'vnc.sample-ocean');
    assert.deepStrictEqual(rec.manifest.tags, ['giao diện', 'mẫu']);
    assert.strictEqual(styleMap.get('--ac'), '#0e7490');
    await store.removeMod('vnc.sample-ocean');
  });

  await t('mod tư thế: đăng ký khi bật, mất khi tắt, và có dữ liệu góc đúng', async () => {
    const fs = require('fs'), path = require('path');
    const buf = fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-poses.vnmod'));
    await store.importMod(toFile(buf, 'sample-poses.vnmod'), { replace: true });
    let poses = store.getPoses().filter(p => p.modId === 'vnc.sample-poses');
    assert.deepStrictEqual(poses.map(p => p.name).sort(), ['Giơ 2 tay', 'Nghiêng đầu']);
    assert.deepStrictEqual(poses.find(p => p.name === 'Giơ 2 tay').bones['左腕'], [0, 0, 120]);
    await store.setEnabled('vnc.sample-poses', false);
    assert.ok(!store.getPoses().some(p => p.modId === 'vnc.sample-poses'), 'tắt thì không còn tư thế');
    await store.setEnabled('vnc.sample-poses', true);
    assert.ok(store.getPoses().some(p => p.modId === 'vnc.sample-poses'));
    await store.removeMod('vnc.sample-poses');
    assert.ok(!store.getPoses().some(p => p.modId === 'vnc.sample-poses'));
  });

  await t('mod tư thế có pose.json hỏng: từ chối nhập, không lưu', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.badpose', permissions: ['pose'], provides: { pose: 'pose.json' } }),
      'pose.json': JSON.stringify({ poses: { x: { '頭': [0, 0, 999] } } }) });
    await assert.rejects(store.importMod(toFile(buf, 'bp.vnmod')), e => e.code === 'pose');
    assert.ok(!(await store.listMods()).some(m => m.id === 'vnc.badpose'));
  });

  await t('mod góc nhìn: đăng ký khi bật, mất khi tắt', async () => {
    const fs = require('fs'), path = require('path');
    const buf = fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-camera.vnmod'));
    await store.importMod(toFile(buf, 'sample-camera.vnmod'), { replace: true });
    const views = store.getCameras().filter(v => v.modId === 'vnc.sample-camera');
    assert.deepStrictEqual(views.map(v => v.name).sort(), ['Chính diện', 'Nhìn từ trên']);
    assert.strictEqual(views.find(v => v.name === 'Chính diện').view.ds, 60);
    await store.setEnabled('vnc.sample-camera', false);
    assert.ok(!store.getCameras().some(v => v.modId === 'vnc.sample-camera'));
    await store.removeMod('vnc.sample-camera');
  });

  await t('xem trước: chuẩn bị gói không ghi gì vào kho', async () => {
    const before = (await store.listMods()).length;
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.preview', name: 'Xem trước' }), 'theme.json': theme({ '--fg': '#101010' }) });
    const prep = await store.prepareMod(toFile(buf, 'p.vnmod'));
    assert.strictEqual(prep.existing, null);
    assert.strictEqual(prep.rec.manifest.name, 'Xem trước');
    assert.strictEqual((await store.listMods()).length, before, 'chưa được lưu');
    await store.commitMod(prep, {});
    assert.strictEqual((await store.listMods()).length, before + 1);
    await store.removeMod('vnc.preview');
  });

  await t('commit không replace với mod đã có: báo exists, không đổi gì', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.dupe', version: '1.0.0' }), 'theme.json': theme() });
    await store.importMod(toFile(buf, 'd.vnmod'));
    const prep = await store.prepareMod(toFile(buf, 'd.vnmod'));
    assert.ok(prep.existing, 'phải thấy bản đang có');
    await assert.rejects(store.commitMod(prep, {}), e => e.code === 'exists');
    await store.removeMod('vnc.dupe');
  });

  await t('nâng cấp giữ nguyên thứ tự ưu tiên và trạng thái bật', async () => {
    const v1 = await makeZip({ 'manifest.json': manifest({ id: 'vnc.up', version: '1.0.0' }), 'theme.json': theme({ '--bd': '#111111' }) });
    const v2 = await makeZip({ 'manifest.json': manifest({ id: 'vnc.up', version: '1.1.0' }), 'theme.json': theme({ '--bd': '#222222' }) });
    await store.importMod(toFile(v1, 'u1.vnmod'));
    const orderBefore = (await store.listMods()).find(m => m.id === 'vnc.up').order;
    await store.setEnabled('vnc.up', false);
    const prep = await store.prepareMod(toFile(v2, 'u2.vnmod'));
    const res = await store.commitMod(prep, { replace: true });
    assert.strictEqual(res.fromVersion, '1.0.0');
    const after = (await store.listMods()).find(m => m.id === 'vnc.up');
    assert.strictEqual(after.order, orderBefore, 'giữ thứ tự');
    assert.strictEqual(after.enabled, false, 'giữ trạng thái tắt');
    assert.strictEqual(after.manifest.version, '1.1.0');
    await store.removeMod('vnc.up');
  });

  await t('thứ tự ưu tiên quyết định mod thắng khi trùng màu, và đổi chỗ đổi kết quả', async () => {
    const a = await makeZip({ 'manifest.json': manifest({ id: 'vnc.first', name: 'A' }), 'theme.json': theme({ '--ac': '#aaaaaa' }) });
    const b = await makeZip({ 'manifest.json': manifest({ id: 'vnc.second', name: 'B' }), 'theme.json': theme({ '--ac': '#bbbbbb' }) });
    await store.importMod(toFile(a, 'a.vnmod'));
    await store.importMod(toFile(b, 'b.vnmod'));
    assert.strictEqual(color(), '#bbbbbb', 'mod cài sau (B) thắng');
    await store.moveMod('vnc.second', -1);
    assert.strictEqual(color(), '#aaaaaa', 'sau khi đưa B lên trước A, A thắng');
    await store.moveMod('vnc.second', -1);
    assert.strictEqual(color(), '#aaaaaa', 'đã ở đầu thì không đổi');
    await store.removeMod('vnc.first');
    await store.removeMod('vnc.second');
  });

  await t('mod tạo từ cảnh (buildMod) nén lại rồi nhập được bằng chính bộ nhập', async () => {
    const r = globalThis.VNMod.buildMod({ name: 'Tạo từ cảnh', author: 'Thử', theme: { '--ac': '#abcdef' },
      poses: { 'Tư thế lưu': { '頭': [0, 0, 15] } }, views: { 'Tư thế lưu': { th: 0, ph: 1.5, ds: 60, tg: [0, 10, 0], rl: 0 } } });
    const z = new JSZip();
    for (const [fn, c] of Object.entries(r.files)) z.file(fn, c);
    const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const res = await store.importMod(toFile(buf, r.id + '.vnmod'), { replace: true });
    assert.strictEqual(res.id, r.id);
    assert.strictEqual(color(), '#abcdef');
    assert.ok(store.getPoses().some(p => p.modId === r.id && p.name === 'Tư thế lưu'));
    assert.ok(store.getCameras().some(v => v.modId === r.id));
    await store.removeMod(r.id);
  });

  await t('quyền light: đặt độ sáng khi bật, trả về mức app khi tắt', async () => {
    const calls = [];
    globalThis.vnmodApplyLight = v => calls.push(v);
    const fs = require('fs'), path = require('path');
    const buf = fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-light.vnmod'));
    await store.importMod(toFile(buf, 'sample-light.vnmod'), { replace: true });
    assert.strictEqual(calls[calls.length - 1], 0.9, 'phải đặt 0.9');
    await store.setEnabled('vnc.sample-light', false);
    assert.strictEqual(calls[calls.length - 1], null, 'tắt thì trả về mức app');
    await store.removeMod('vnc.sample-light');
    delete globalThis.vnmodApplyLight;
  });

  await t('light.json có thuộc tính lạ: từ chối nhập', async () => {
    const buf = await makeZip({ 'manifest.json': manifest({ id: 'vnc.badlight', permissions: ['light'], provides: { light: 'light.json' } }),
      'light.json': JSON.stringify({ light: { level: 0.5, script: 'alert(1)' } }) });
    await assert.rejects(store.importMod(toFile(buf, 'bl.vnmod')), e => e.code === 'light');
  });

  console.log('\n' + pass + ' test lưu trữ đạt');
})();

// Lấy file sao lưu đã tạo bằng cách bắt lần tải xuống cuối cùng qua hàm URL.createObjectURL
async function captureBackup() {
  const captured = await new Promise((resolve) => {
    const orig = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = (blob) => { resolve(blob); return 'blob:cap'; };
    store.backupAll().catch(() => {}).finally(() => { globalThis.URL.createObjectURL = orig; });
  });
  return new File([Buffer.from(await captured.arrayBuffer())], 'backup.zip');
}
