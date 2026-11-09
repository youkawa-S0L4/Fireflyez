/* VNMod store: lưu mod trong IndexedDB riêng (không dùng localStorage cho file),
   nhập/xuất .vnmod, sao lưu/khôi phục, và áp dụng theme lên giao diện. */
(function (G) {
  'use strict';
  const C = G.VNMod;
  const DB_NAME = 'vnmod', DB_VER = 1, STORE = 'mods';
  let dbPromise = null;
  let applied = new Set();
  let lastReport = { conflicts: { duplicateIds: [], resources: [] }, errors: [] };
  let lastPoses = [];
  let lastCams = [];
  let lightApplied = false;

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((ok, no) => {
      const r = G.indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => { dbPromise = null; no(r.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then(d => new Promise((ok, no) => {
      const t = d.transaction(STORE, mode);
      let rq;
      try { rq = fn(t.objectStore(STORE)); } catch (e) { no(e); return; }
      t.oncomplete = () => ok(rq ? rq.result : undefined);
      t.onerror = t.onabort = () => no(t.error || new Error('IndexedDB lỗi'));
    }));
  }
  const getAll = () => tx('readonly', s => s.getAll());
  const getOne = id => tx('readonly', s => s.get(id));
  const put = rec => tx('readwrite', s => s.put(rec));
  const del = id => tx('readwrite', s => s.delete(id));

  function download(blob, name) {
    const a = G.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    G.document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  const dateStr = () => new Date().toISOString().slice(0, 10);

  // Bước 1: đọc và kiểm tra toàn bộ gói, CHƯA lưu. Trả về thông tin để xem trước.
  async function prepareMod(file, opt) {
    opt = opt || {};
    const progress = opt.onProgress || (() => {});
    const ext = (String(file.name || '').match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!['.vnmod', '.zip', '.rar', '.7z'].includes(ext)) throw new C.ModError('ext', 'Chỉ nhận .vnmod, .zip, .rar hoặc .7z');
    const isNativeMod = ext === '.vnmod';
    const archiveLimit = isNativeMod ? C.LIMITS.zipBytes : 100 * 1024 * 1024;
    if (file.size > archiveLimit) throw new C.ModError('size', 'File vượt giới hạn ' + Math.round(archiveLimit / 1048576) + ' MB');
    if (!G.JSZip) throw new C.ModError('env', 'Chưa tải được bộ giải nén ZIP. Hãy mở app khi có mạng một lần.');

    progress(5, 'Đang đọc file...');
    let z;
    try {
      if (ext === '.rar' || ext === '.7z') {
        if (!G.VNArchive || !G.VNArchive.load) throw new Error('Bộ đọc RAR/7Z chưa sẵn sàng. Hãy mở app khi có mạng.');
        z = await G.VNArchive.load(file);
      } else z = await G.JSZip.loadAsync(file);
    } catch (e) { throw new C.ModError(isNativeMod ? 'zip' : 'archive', 'Không mở được gói ' + ext + ': ' + ((e && e.message) || e)); }

    // 1) Liệt kê và kiểm tra đường dẫn trước khi giải nén bất cứ thứ gì
    const map = new Map();
    const raw = [];
    z.forEach((rel, f) => { if (!f.dir && !/^__MACOSX\//.test(rel)) raw.push([rel, f]); });
    if (raw.length > C.LIMITS.files) throw new C.ModError('limit', 'Quá nhiều file (tối đa ' + C.LIMITS.files + ')');
    for (const [rel, f] of raw) {
      const p = C.normalizePath(rel);
      if (p === null) throw new C.ModError('path', 'Đường dẫn không an toàn trong gói: ' + rel);
      if (map.has(p.toLowerCase())) throw new C.ModError('path', 'Trùng đường dẫn: ' + p);
      map.set(p.toLowerCase(), { path: p, f });
    }

    // 2) manifest
    progress(15, 'Kiểm tra manifest...');
    const mEntry = map.get('manifest.json');
    if (!mEntry) throw new C.ModError('manifest', 'Đã đọc được gói nén nhưng không tìm thấy manifest.json ở thư mục gốc. Đây có thể là mod game/model thông thường, chưa phải gói VNMOD có thể cài trực tiếp.');
    const mText = await mEntry.f.async('string');
    if (mText.length > C.LIMITS.manifestBytes) throw new C.ModError('manifest', 'manifest.json quá lớn');
    let rawManifest;
    try { rawManifest = JSON.parse(mText); }
    catch (e) { throw new C.ModError('manifest', 'manifest.json không phải JSON hợp lệ'); }
    const paths = new Set([...map.values()].map(x => x.path));
    const m = C.validateManifest(rawManifest, paths);

    // 3) đọc nội dung, giới hạn kích thước trong lúc đọc (chống zip bomb)
    const blobs = {}, list = [];
    let total = 0, n = 0;
    for (const { path, f } of map.values()) {
      n++;
      progress(15 + Math.round(60 * n / map.size), 'Đọc ' + path);
      const buf = await f.async('arraybuffer');
      if (buf.byteLength > C.LIMITS.fileBytes) throw new C.ModError('size', 'File quá lớn: ' + path);
      total += buf.byteLength;
      if (total > C.LIMITS.totalBytes) throw new C.ModError('size', 'Tổng dung lượng vượt giới hạn');
      list.push({ path, size: buf.byteLength });
      blobs[path] = new Blob([buf]);
    }
    const listErr = C.validateFileList(list);
    if (listErr.length) throw new C.ModError('files', listErr.join('; '), listErr);

    // 4) theme
    let theme = null;
    if (m.permissions.includes('theme')) {
      progress(80, 'Kiểm tra theme...');
      let obj;
      try { obj = JSON.parse(await blobs[m.provides.theme].text()); }
      catch (e) { throw new C.ModError('theme', 'theme.json không phải JSON hợp lệ'); }
      theme = C.validateTheme(obj);
    }

    // 4b) tư thế (quyền pose)
    let poses = null;
    if (m.permissions.includes('pose')) {
      progress(85, 'Kiểm tra tư thế...');
      let pobj;
      try { pobj = JSON.parse(await blobs[m.provides.pose].text()); }
      catch (e) { throw new C.ModError('pose', 'pose.json không phải JSON hợp lệ'); }
      poses = C.validatePoses(pobj);
    }

    // 4c) góc nhìn (quyền camera)
    let cams = null;
    if (m.permissions.includes('camera')) {
      progress(88, 'Kiểm tra góc nhìn...');
      let cobj;
      try { cobj = JSON.parse(await blobs[m.provides.camera].text()); }
      catch (e) { throw new C.ModError('camera', 'camera.json không phải JSON hợp lệ'); }
      cams = C.validateCameras(cobj);
    }

    // 4d) ánh sáng (quyền light)
    let light = null;
    if (m.permissions.includes('light')) {
      progress(90, 'Kiểm tra ánh sáng...');
      let lobj;
      try { lobj = JSON.parse(await blobs[m.provides.light].text()); }
      catch (e) { throw new C.ModError('light', 'light.json không phải JSON hợp lệ'); }
      light = C.validateLight(lobj).level;
    }

    // 5) tương thích và trùng ID (chỉ đọc, chưa ghi)
    const compat = C.checkCompat(m);
    const existing = await getOne(m.id);
    const rec = {
      id: m.id, manifest: m, files: blobs, theme, poses, cams, light,
      enabled: compat.ok, compat, error: null,
      installedAt: 0, updatedAt: Date.now(), order: undefined
    };
    return { rec, existing: existing || null, compat, size: total, fileCount: list.length };
  }

  // Bước 2: cài đặt gói đã chuẩn bị. Trùng ID thì phải có replace.
  async function commitMod(prep, opt) {
    opt = opt || {};
    const progress = opt.onProgress || (() => {});
    const { rec, existing } = prep;
    if (existing && !opt.replace) {
      throw new C.ModError('exists', 'Đã có mod "' + rec.id + '" (v' + existing.manifest.version + ')', { version: existing.manifest.version });
    }
    progress(90, 'Lưu vào bộ nhớ...');
    rec.installedAt = existing ? existing.installedAt : Date.now();
    rec.updatedAt = Date.now();
    // Giữ nguyên thứ tự ưu tiên và trạng thái bật/tắt khi nâng cấp
    rec.order = existing && typeof existing.order === 'number' ? existing.order : await nextOrder();
    rec.enabled = !!(rec.compat.ok && (!existing || existing.enabled));
    await put(rec);
    await applyAll();
    progress(100, 'Xong');
    return {
      id: rec.id, name: rec.manifest.name, version: rec.manifest.version,
      replaced: !!existing, fromVersion: existing ? existing.manifest.version : null, compat: prep.compat
    };
  }

  // Giữ tương thích cũ: nhập thẳng (dùng cho khôi phục và các chỗ không cần xem trước).
  async function importMod(file, opt) {
    opt = opt || {};
    const prep = await prepareMod(file, { onProgress: opt.onProgress });
    return commitMod(prep, opt);
  }

  // Thứ tự ưu tiên: mod đứng sau thắng khi trùng biến màu. Mod cũ chưa có order được gán theo ngày cài.
  async function ensureOrder(all) {
    if (all.every(r => typeof r.order === 'number')) return all;
    const sorted = all.slice().sort((a, b) => a.installedAt - b.installedAt);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].order !== i + 1) { sorted[i].order = i + 1; await put(sorted[i]); }
    }
    return sorted;
  }
  async function nextOrder() {
    const all = await ensureOrder(await getAll());
    return all.reduce((mx, r) => Math.max(mx, r.order || 0), 0) + 1;
  }
  async function moveMod(id, dir) {
    const all = (await ensureOrder(await getAll())).sort((a, b) => a.order - b.order);
    const i = all.findIndex(r => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return getReport();
    const a = all[i], b = all[j];
    const t = a.order; a.order = b.order; b.order = t;
    await put(a); await put(b);
    return applyAll();
  }

  async function listMods() {
    const all = await getAll();
    return all.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }

  async function setEnabled(id, on) {
    const r = await getOne(id);
    if (!r) throw new C.ModError('missing', 'Không tìm thấy mod');
    if (on && !r.compat.ok) throw new C.ModError('compat', r.compat.reason);
    r.enabled = !!on;
    r.error = null;
    r.updatedAt = Date.now();
    await put(r);
    return applyAll();
  }

  async function removeMod(id) {
    await del(id);
    return applyAll();
  }

  async function exportMod(id) {
    const r = await getOne(id);
    if (!r) throw new C.ModError('missing', 'Không tìm thấy mod');
    const z = new G.JSZip();
    for (const [p, b] of Object.entries(r.files)) z.file(p, await b.arrayBuffer());
    const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    download(blob, r.id + '-' + r.manifest.version + '.vnmod');
  }

  async function backupAll() {
    const all = await getAll();
    const z = new G.JSZip();
    const meta = { v: 1, app: 'vnmod-backup', created: Date.now(), mods: all.map(r => ({ id: r.id, enabled: !!r.enabled })) };
    z.file('backup.json', JSON.stringify(meta));
    for (const r of all) {
      const mz = new G.JSZip();
      for (const [p, bl] of Object.entries(r.files)) mz.file(p, await bl.arrayBuffer());
      z.file('mods/' + r.id + '.vnmod', await mz.generateAsync({ type: 'arraybuffer' }));
    }
    download(await z.generateAsync({ type: 'blob', compression: 'STORE' }), 'vnmod-backup-' + dateStr() + '.zip');
    return all.length;
  }

  async function restoreBackup(file, onProgress) {
    const progress = onProgress || (() => {});
    let z;
    try { z = await G.JSZip.loadAsync(file); }
    catch (e) { throw new C.ModError('zip', 'File sao lưu không hợp lệ'); }
    const bk = z.file('backup.json');
    if (!bk) throw new C.ModError('backup', 'Đây không phải file sao lưu mod');
    let meta;
    try { meta = JSON.parse(await bk.async('string')); }
    catch (e) { throw new C.ModError('backup', 'backup.json bị hỏng'); }
    const entries = [];
    z.forEach((p, f) => { if (!f.dir && /^mods\/[^/]+\.vnmod$/.test(p)) entries.push({ p, f }); });
    const result = { ok: 0, fail: [] };
    for (let i = 0; i < entries.length; i++) {
      const { p, f } = entries[i];
      progress(Math.round(100 * i / entries.length), 'Khôi phục ' + p.split('/').pop());
      try {
        const blob = await f.async('blob');
        const name = p.split('/').pop();
        await importMod(new File([blob], name, { type: '' }), { replace: true });
        const want = (meta.mods || []).find(x => name === x.id + '.vnmod');
        if (want && want.enabled === false) await setEnabled(want.id, false).catch(() => {});
        result.ok++;
      } catch (e) {
        result.fail.push(p + ': ' + e.message);
      }
    }
    progress(100, 'Xong');
    await applyAll();
    return result;
  }

  // Áp dụng theme của mọi mod đang bật. Mod nào lỗi sẽ tự tắt và ghi lý do.
  async function applyAll() {
    const all = (await ensureOrder(await getAll())).sort((a, b) => a.order - b.order);
    const errors = [];
    const want = {};
    const poseList = [];
    const camList = [];
    for (const r of all) {
      if (!r.enabled) continue;
      try {
        if (!r.compat || !r.compat.ok) throw new C.ModError('compat', r.compat ? r.compat.reason : 'Thiếu thông tin tương thích');
        // Kiểm tra lại theme mỗi lần áp dụng, phòng khi dữ liệu trong IndexedDB bị hỏng hoặc bị sửa
        if (r.theme) Object.assign(want, C.validateTheme({ vars: r.theme }));
        if (r.poses) {
          const checked = C.validatePoses({ poses: r.poses });
          for (const pn of Object.keys(checked)) poseList.push({ modId: r.id, modName: r.manifest.name, name: pn, bones: checked[pn] });
        }
        if (r.cams) {
          const checkedC = C.validateCameras({ views: r.cams });
          for (const vn of Object.keys(checkedC)) camList.push({ modId: r.id, modName: r.manifest.name, name: vn, view: checkedC[vn] });
        }
      } catch (e) {
        r.enabled = false;
        r.error = e.message;
        await put(r);
        errors.push({ id: r.id, message: e.message });
      }
    }
    const conflicts = C.findConflicts(all.map(r => ({ id: r.id, enabled: r.enabled, vars: r.theme })));
    const root = G.document.documentElement;
    for (const k of applied) if (!(k in want)) root.style.removeProperty(k);
    for (const k of Object.keys(want)) root.style.setProperty(k, want[k]);
    applied = new Set(Object.keys(want));
    lastReport = { conflicts, errors };
    lastPoses = poseList;
    lastCams = camList;
    // Ánh sáng: mod đang bật đặt mức sáng; không có mod nào thì trả về mức của app
    let lightLevel = null;
    for (const r of all) {
      if (!r.enabled || r.light == null) continue;
      try { lightLevel = C.validateLight({ light: { level: r.light } }).level; } catch (e) { /* bỏ qua mod hỏng */ }
    }
    if (lightLevel !== null && G.vnmodApplyLight) { G.vnmodApplyLight(lightLevel); lightApplied = true; }
    else if (lightApplied && G.vnmodApplyLight) { G.vnmodApplyLight(null); lightApplied = false; }
    G.dispatchEvent && G.dispatchEvent(new CustomEvent('vnmod:changed', { detail: lastReport }));
    return lastReport;
  }

  function getReport() { return lastReport; }

  G.VNMod = Object.assign(G.VNMod || {}, {
    store: { prepareMod, commitMod, importMod, moveMod, listMods, setEnabled, removeMod, exportMod, backupAll, restoreBackup, applyAll,
      getReport,
      getPoses: () => lastPoses.map(p => Object.assign({}, p, { bones: Object.assign({}, p.bones) })),
      getCameras: () => lastCams.map(v => Object.assign({}, v, { view: Object.assign({}, v.view, { tg: v.view.tg.slice() }) })) }
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = G.VNMod;
})(typeof window !== 'undefined' ? window : globalThis);
