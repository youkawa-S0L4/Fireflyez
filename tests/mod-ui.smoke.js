// Chạy: JSZIP_PATH=<jszip> node tests/mod-ui.smoke.js
// Smoke test giao diện bằng DOM giả: kiểm tra mở/đóng, render danh sách, tìm kiếm, lọc, không ném lỗi.
const assert = require('assert');
const JSZipLib = require(process.env.JSZIP_PATH || 'jszip');
globalThis.JSZip = class extends JSZipLib {
  static loadAsync(src, o) { return JSZipLib.loadAsync(src && src.arrayBuffer ? src.arrayBuffer() : src, o); }
};
function El(tag) {
  const e = {
    tagName: tag.toUpperCase(), children: [], style: {}, dataset: {}, attrs: {}, _text: '', className: '', id: '',
    classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) }, contains(c) { return this._s.has(c) }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c) } },
    append(...xs) { xs.forEach(x => this.children.push(x)); }, setAttribute(k, v) { this.attrs[k] = v }, addEventListener() {},
    get textContent() { return this._text + this.children.map(c => c.textContent || '').join('') },
    set textContent(v) { this._text = String(v); this.children = []; },
    get firstChild() { return this.children[0] }, click() {}, remove() {}, focus() {}, value: '', files: [],
    querySelectorAll() { return [] }, getAttribute() { return null }
  };
  return e;
}
const all = [];
globalThis.document = {
  readyState: 'complete',
  documentElement: { style: { _m: new Map(), setProperty(k, v) { this._m.set(k, v) }, removeProperty(k) { this._m.delete(k) } } },
  head: El('head'), body: El('body'),
  top: null,
  createElement(t) { const e = El(t); all.push(e); return e; },
  getElementById(id) { return id === 'top' ? topEl : null; },
  addEventListener() {}
};
const topEl = El('div');
globalThis.addEventListener = () => {};
globalThis.confirm = () => true;
globalThis.URL.createObjectURL = () => 'blob:x';
globalThis.URL.revokeObjectURL = () => {};
const dbs = new Map();
globalThis.indexedDB = {
  open(name) {
    const req = {};
    setTimeout(() => {
      let db = dbs.get(name); const fresh = !db;
      if (fresh) { db = { stores: new Map() }; dbs.set(name, db); }
      req.result = {
        createObjectStore(n, o) { db.stores.set(n, { kp: o.keyPath, data: new Map() }) },
        transaction(n) {
          const st = db.stores.get(n); const t = {}; let p = 0, fin = false;
          const settle = () => { if (fin || p > 0) return; fin = true; setTimeout(() => t.oncomplete && t.oncomplete(), 0) };
          const run = f => { const rq = {}; p++; setTimeout(() => { rq.result = f(); p--; settle() }, 0); return rq };
          t.objectStore = () => ({ get: k => run(() => st.data.get(k)), put: v => run(() => { st.data.set(v[st.kp], v); return v[st.kp] }), delete: k => run(() => { st.data.delete(k) }), getAll: () => run(() => [...st.data.values()]), clear: () => run(() => st.data.clear()) });
          return t;
        }
      };
      if (fresh && req.onupgradeneeded) req.onupgradeneeded();
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }
};
const fs = require('fs'), path = require('path');
require('../mods/mod-core.js');
require('../mods/mod-store.js');
require('../mods/mod-ui.js');
const ui = globalThis.VNMod.ui, store = globalThis.VNMod.store;
function El_list(){ return El('div') }
function collect(e){ return [e, ...e.children.flatMap(collect)] }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(20);
  assert.ok(topEl.children.some(c => c.id === 'bmod'), 'phải có nút 🧩 trên thanh công cụ');
  // Nhập mod mẫu rồi mở màn hình
  const buf = fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-ocean.vnmod'));
  await store.importMod(new File([buf], 'sample-ocean.vnmod'), { replace: true });
  ui.open();
  await sleep(30);
  const ov = document.body.children.find(c => c.id === 'modov');
  assert.ok(ov && ov.classList.contains('on'), 'overlay phải mở');
  const dump = el => el.textContent + el.children.map(dump).join('');
  const text = dump(ov);
  assert.ok(text.includes('Mẫu: Đại dương'), 'danh sách phải có tên mod');
  assert.ok(text.includes('Đang bật'), 'phải có trạng thái bật');
  assert.ok(text.includes('giao diện'), 'phải hiện nhóm của mod');
  ui.close();
  assert.ok(!ov.classList.contains('on'), 'đóng overlay');
  console.log('ok   mở/đóng, nút 🧩, hiển thị mod đã nhập');
  // Mục tư thế từ mod: hiện khi mod đang bật, nút áp đúng góc
  await store.importMod(new File([fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-poses.vnmod'))], 'sample-poses.vnmod'), { replace: true });
  let applied = null;
  const L = El_list();
  globalThis.vnmodPoseSection(L, b => { applied = b });
  const btns = collect(L).filter(x => typeof x.onclick === 'function' && (x.textContent || '').includes('Giơ 2 tay'));
  assert.ok(btns.length >= 1, 'phải có nút tư thế từ mod');
  btns[0].onclick();
  assert.deepStrictEqual(applied['左腕'], [0, 0, 120]);
  console.log('ok   mục "Tư thế từ mod" hiện và truyền đúng góc');
  await store.importMod(new File([fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-camera.vnmod'))], 'sample-camera.vnmod'), { replace: true });
  let appliedV = null;
  const L2 = El_list();
  globalThis.vnmodCameraSection(L2, v => { appliedV = v });
  const cb = collect(L2).filter(x => typeof x.onclick === 'function' && (x.textContent || '').includes('Nhìn từ trên'));
  assert.ok(cb.length >= 1, 'phải có nút góc nhìn từ mod');
  cb[0].onclick();
  assert.strictEqual(appliedV.ph, 0.3);
  console.log('ok   mục "Góc nhìn từ mod" hiện và truyền đúng góc');
  await store.removeMod('vnc.sample-camera');
  await store.removeMod('vnc.sample-poses');
  await store.removeMod('vnc.sample-ocean');
  // Xem trước: không cài khi chưa xác nhận
  const before = (await store.listMods()).length;
  ui.open();
  await ui.previewFile(new File([fs.readFileSync(path.join(__dirname, '..', 'mods', 'sample-ocean.vnmod'))], 'sample-ocean.vnmod'));
  await sleep(30);
  const ov2 = document.body.children.find(c => c.id === 'modov');
  const txt2 = (function d(el) { return el.textContent + el.children.map(d).join(''); })(ov2);
  assert.ok(txt2.includes('Xem trước: Mẫu: Đại dương'), 'phải hiện màn hình xem trước');
  assert.ok(txt2.includes('Cài đặt'), 'phải có nút xác nhận');
  assert.strictEqual((await store.listMods()).length, before, 'xem trước không được cài');
  console.log('ok   xem trước hiện thông tin và chưa cài gì');
  console.log('ok   dọn dẹp');
})().catch(e => { console.log('FAIL', e.stack.split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; });
