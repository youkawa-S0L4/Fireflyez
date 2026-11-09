/* VNMod UI: màn hình Quản lý Mod (danh sách thẻ, tìm kiếm, lọc, bật/tắt, xuất, xoá, sao lưu).
   Mọi dữ liệu từ mod đều đi qua textContent, không dùng innerHTML, để nội dung manifest không thể chạy như mã. */
(function (G) {
  'use strict';
  const C = G.VNMod;
  const S = C.store;
  const D = G.document;

  const CSS = `
#bmod{min-width:40px}
#modov{position:fixed;inset:0;z-index:25;background:#0008;display:none;align-items:center;justify-content:center;padding:12px}
#modov.on{display:flex}
#modov .mp{width:100%;max-width:820px;max-height:92vh;display:flex;flex-direction:column;background:var(--pn,#fff);color:var(--fg,#111);border:1px solid var(--bd,#0002);border-radius:14px;box-shadow:var(--sh,0 10px 30px #0004);overflow:hidden}
#modov .mh{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--bd,#0002)}
#modov .mh h2{margin:0;font-size:17px;flex:1}
#modov .mt{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-bottom:1px solid var(--bd,#0002)}
#modov .mfield{display:flex;flex-direction:column;gap:4px;font-size:13px;margin:6px 0}
#modov .mfield input,#modov .mfield textarea{font:inherit;color:var(--fg,#111);background:#8881;border:1px solid var(--bd,#0002);border-radius:10px;padding:8px 10px;min-height:40px}
#modov .mchk{display:flex;align-items:center;gap:8px;font-size:14px;margin:6px 0;min-height:36px}
#modov .mt input[type=search]{flex:1 1 180px;min-width:0;padding:8px 10px;font:inherit;color:var(--fg,#111);background:#8881;border:1px solid var(--bd,#0002);border-radius:10px}
#modov select{padding:8px;font:inherit;color:var(--fg,#111);background:#8881;border:1px solid var(--bd,#0002);border-radius:10px}
#modov .mbar{height:6px;background:#8882;border-radius:4px;overflow:hidden;margin:0 14px;display:none}
#modov .mbar i{display:block;height:100%;width:0;background:var(--ac,#7a3fd1);transition:width .2s}
#modov .mtxt{font-size:12px;opacity:.85;padding:6px 14px 0;min-height:18px}
#modov .mc{overflow-y:auto;padding:10px 14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;align-content:start}
#modov .mcard{border:1px solid var(--bd,#0002);border-radius:12px;padding:12px;background:#8881;display:flex;flex-direction:column;gap:6px;min-width:0}
#modov .mcard.off{opacity:.78}
#modov .mname{font-weight:600;font-size:15px;overflow-wrap:anywhere}
#modov .msub{font-size:12px;opacity:.75;overflow-wrap:anywhere}
#modov .mtag{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--bt,#7a3fd11a);border:1px solid var(--bd,#0002)}
#modov .mdesc{font-size:13px;line-height:1.45;overflow-wrap:anywhere}
#modov .mbadges{display:flex;flex-wrap:wrap;gap:4px}
#modov .mb{font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid var(--bd,#0002)}
#modov .mb.ok{background:#16a34a22}#modov .mb.warn{background:#f59e0b33}#modov .mb.err{background:#dc262633}#modov .mb.info{background:#3b82f622}
#modov .mact{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:6px}
#modov .mact button{min-height:38px;padding:6px 12px}
#modov .mdet{font-size:12px;opacity:.85;border-top:1px dashed var(--bd,#0002);padding-top:6px;overflow-wrap:anywhere}
#modov .mempty{grid-column:1/-1;text-align:center;opacity:.7;padding:24px 8px;font-size:14px}
@media(max-width:700px){
  #modov{padding:0;align-items:stretch}
  #modov .mp{max-width:none;max-height:none;height:100%;border-radius:0;border:0}
  #modov .mc{grid-template-columns:1fr}
  #modov .mh button,#modov .mt button{min-height:40px}
  #modov .mt input[type=search],#modov select{font-size:15px;min-height:40px}
}`;

  const THEME_KEYS = ['--ac', '--ac2', '--bg', '--fg', '--pn', '--bd'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

  // Tạo mod từ cảnh đang xem: màu giao diện, tư thế và góc nhìn hiện tại. Chỉ tạo dữ liệu, không sinh mã.
  function openBuilder() {
    listEl.textContent = '';
    const box = h('div', 'mcard');
    box.style.gridColumn = '1/-1';
    box.append(h('div', 'mname', 'Tạo mod từ cảnh hiện tại'));
    box.append(h('div', 'mdesc', 'Mod được tạo là dữ liệu thuần (màu, tư thế, góc nhìn). Bạn xem trước và xác nhận trước khi cài.'));

    const field = (label, el) => { const w = h('label', 'mfield'); w.append(h('span', '', label), el); return w; };
    const nameIn = D.createElement('input'); nameIn.type = 'text'; nameIn.maxLength = 80; nameIn.placeholder = 'Tên mod';
    const authorIn = D.createElement('input'); authorIn.type = 'text'; authorIn.maxLength = 80; authorIn.placeholder = 'Tên bạn';
    const descIn = D.createElement('textarea'); descIn.maxLength = 500; descIn.rows = 2; descIn.placeholder = 'Mô tả ngắn';
    const tagsIn = D.createElement('input'); tagsIn.type = 'text'; tagsIn.placeholder = 'Nhóm, cách nhau bằng dấu phẩy';
    box.append(field('Tên', nameIn), field('Tác giả', authorIn), field('Mô tả', descIn), field('Nhóm', tagsIn));

    const mkChk = (label, checked, enabled) => {
      const w = h('label', 'mchk');
      const c = D.createElement('input'); c.type = 'checkbox'; c.checked = checked; c.disabled = !enabled;
      w.append(c, h('span', '', label));
      return { wrap: w, input: c };
    };
    const hasPose = typeof P !== 'undefined' && P && !P.fx && typeof PR !== 'undefined' && Object.keys(PR).some(k => (PR[k] || []).some(x => x));
    const hasCam = typeof th !== 'undefined';
    const cColors = mkChk('Lấy màu giao diện hiện tại', true, true);
    const cPose = mkChk('Lấy tư thế đang chỉnh' + (hasPose ? '' : ' (chưa có tư thế)'), !!hasPose, !!hasPose);
    const cView = mkChk('Lấy góc nhìn hiện tại' + (hasCam ? '' : ' (mở model trước)'), hasCam, hasCam);
    box.append(cColors.wrap, cPose.wrap, cView.wrap);

    const act = h('div', 'mact');
    act.append(
      btn('Tạo và xem trước', () => buildAndPreview({
        name: nameIn.value, author: authorIn.value, description: descIn.value, tags: tagsIn.value,
        colors: cColors.input.checked, pose: cPose.input.checked, view: cView.input.checked
      }), 'pri'),
      btn('Huỷ', () => render())
    );
    box.append(act);
    listEl.append(box);
    nameIn.focus();
  }

  function collectTheme() {
    const cs = G.getComputedStyle(D.documentElement);
    const out = {};
    for (const k of THEME_KEYS) {
      const v = (cs.getPropertyValue(k) || '').trim();
      if (/^#[0-9a-f]{3,8}$/i.test(v)) out[k] = v.toLowerCase();
    }
    return Object.keys(out).length ? out : null;
  }

  function collectPose(poseName) {
    if (typeof P === 'undefined' || !P || P.fx || typeof PR === 'undefined') return null;
    const bones = {};
    for (const k of Object.keys(PR)) {
      const b = P.bn[+k];
      const v = PR[k];
      if (!b || !b.name || !Array.isArray(v) || !v.some(x => x)) continue;
      if (Object.keys(bones).length >= 40) break;
      bones[b.name] = v.map(x => clamp(Math.round(x * 10) / 10, -180, 180));
    }
    return Object.keys(bones).length ? { [poseName]: bones } : null;
  }

  function collectView(viewName) {
    if (typeof th === 'undefined') return null;
    return { [viewName]: {
      th: clamp(th, -3.2, 3.2), ph: clamp(ph, 0.05, 3.1), ds: clamp(ds, 1, 1000),
      tg: [clamp(tg.x, -1000, 1000), clamp(tg.y, -1000, 1000), clamp(tg.z, -1000, 1000)],
      rl: clamp(rl, -3.2, 3.2)
    } };
  }

  async function buildAndPreview(o) {
    try {
      const name = (o.name || '').trim();
      if (!name) { say('Hãy nhập tên mod'); return; }
      const poses = o.pose ? collectPose(name) : null;
      const views = o.view ? collectView(name) : null;
      const theme = o.colors ? collectTheme() : null;
      if (o.colors && !theme) say('Không lấy được màu giao diện, bỏ qua phần này.');
      const tags = (o.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const r = C.buildMod({ name, author: (o.author || '').trim() || 'Ẩn danh', description: (o.description || '').trim(), tags, theme, poses, views });
      const z = new G.JSZip();
      for (const [fn, content] of Object.entries(r.files)) z.file(fn, content);
      const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      await previewFile(new File([blob], r.id + '.vnmod'));
    } catch (e) {
      say('Không tạo được mod: ' + errText(e));
    }
  }

  const PERM_LABEL = { theme: 'đổi màu giao diện', pose: 'thêm tư thế', camera: 'thêm góc nhìn', light: 'đổi độ sáng' };
  let ov, listEl, txtEl, barEl, barFill, searchEl, filterEl, tagEl, conflictEl, fileIn, restoreIn, inspectIn;
  const expanded = new Set();

  function h(tag, cls, text) {
    const e = D.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function withTitle(b, t) { b.title = t; b.setAttribute('aria-label', t); return b; }
  function btn(label, fn, cls) {
    const b = h('button', cls || '', label);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }
  function say(t) { txtEl.textContent = t || ''; }
  function setProgress(pct, text) {
    barEl.style.display = 'block';
    barFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    say(text);
    if (pct >= 100) setTimeout(() => { barEl.style.display = 'none'; barFill.style.width = '0'; }, 600);
  }
  function errText(e) { return (e && e.message) || String(e); }

  // Xem trước: đọc và kiểm tra gói, hiện thông tin và quyền xin, chờ người dùng xác nhận.
  // Kiểm tra ZIP an toàn: chỉ liệt kê metadata, không thực thi hay trích xuất nội dung.
  async function inspectArchive(file) {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    const ext = (name.match(/\.[^.]+$/) || [''])[0];
    if (!['.zip', '.vnmod', '.rar', '.7z'].includes(ext)) {
      say('Chỉ hỗ trợ kiểm tra ZIP, VNMOD, RAR5 và 7Z.'); return;
    }
    try {
      if (file.size > 100 * 1024 * 1024) throw Error('Gói vượt giới hạn kiểm tra 100 MB.');
      say('Đang mở và kiểm tra cấu trúc ' + ext.toUpperCase() + '…');
      let z;
      if (ext === '.rar' || ext === '.7z') {
        if (!G.VNArchive || !G.VNArchive.load) throw Error('Bộ đọc RAR/7Z chưa sẵn sàng. Mở app khi có mạng để tải bộ giải nén.');
        z = await G.VNArchive.load(file);
      } else z = await G.JSZip.loadAsync(file, { checkCRC32: false, createFolders: false });
      const entries = [];
      let total = 0;
      z.forEach((path, entry) => {
        if (entry.dir) return;
        const normalized = String(path).replace(/\\/g, '/');
        const safe = !normalized.startsWith('/') && !/^[a-z]:/i.test(normalized) && !normalized.split('/').includes('..') && !normalized.includes('\0');
        const ext2 = (normalized.split('.').pop() || '').toLowerCase();
        const executable = ['js','mjs','cjs','html','htm','svg','wasm','exe','dll','bat','cmd','sh','ps1'].includes(ext2);
        const size = Number(entry._data && entry._data.uncompressedSize || 0);
        entries.push({ path: normalized, safe, executable, size }); total += size;
      });
      if (entries.length > 5000) throw Error('Gói có quá 5.000 tệp; dừng kiểm tra để tránh treo thiết bị.');
      if (total > 300 * 1024 * 1024) throw Error('Tổng dung lượng sau giải nén vượt 300 MB.');
      listEl.textContent = '';
      const card = h('div', 'mcard'); card.style.gridColumn = '1/-1';
      card.append(h('div', 'mname', 'Kết quả kiểm tra: ' + file.name));
      card.append(h('div', 'msub', entries.length + ' tệp · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB nén · ' + (total / 1024 / 1024).toFixed(2) + ' MB theo metadata'));
      card.append(h('div', 'mdesc', 'Đã đọc được cấu trúc gói. Công cụ chỉ liệt kê và phân loại tệp; không thực thi mã bên trong.'));
      const unsafe = entries.filter(x => !x.safe), active = entries.filter(x => x.executable);
      if (unsafe.length) card.append(h('div', 'mdesc', 'Cảnh báo: có ' + unsafe.length + ' đường dẫn không an toàn. Không nên trích xuất các mục này.'));
      if (active.length) card.append(h('div', 'mdesc', 'Có ' + active.length + ' tệp mang định dạng có thể chứa mã: ' + active.slice(0, 8).map(x => x.path).join(', ')));
      const modelFiles = entries.filter(x => /\.(pmx|pmd|vmd|vpd|png|jpe?g|webp|tga|bmp|spa|sph)$/i.test(x.path));
      if (modelFiles.length) card.append(h('div', 'mdesc', 'Tài nguyên model/texture/chuyển động nhận diện được: ' + modelFiles.length + ' tệp. Với gói model MMD, có thể thử mở trực tiếp bằng nút Mở file.'));
      const manifest = entries.some(x => x.path.toLowerCase() === 'manifest.json');
      card.append(h('div', 'mdesc', manifest ? 'Có manifest.json: có thể thử nhập như gói VNMOD.' : 'Không có manifest.json ở thư mục gốc: đây không phải gói VNMOD chuẩn; vẫn có thể xem danh sách tài nguyên, nhưng chưa thể cài vào kho mod VNMOD.'));
      const details = h('details'); details.append(h('summary', '', 'Xem danh sách tệp (' + entries.length + ')'));
      const ul = h('div', 'mdesc'); ul.style.cssText = 'max-height:38vh;overflow:auto;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px';
      ul.textContent = entries.slice(0, 500).map(x => (x.safe ? '' : '⚠ ') + x.path + '  ·  ' + (x.size / 1024).toFixed(1) + ' KB' + (x.executable ? '  [có thể chứa mã]' : '')).join('\n') || '(Không có tệp)';
      details.append(ul); card.append(details);
      if (entries.length > 500) card.append(h('div', 'msub', 'Chỉ hiển thị 500 mục đầu để tránh làm chậm điện thoại.'));
      const act = h('div', 'mact');
      act.append(btn('Quay lại', () => render()));
      if (manifest && ['.rar','.7z','.zip','.vnmod'].includes(ext)) act.append(btn('Thử nhập gói VNMOD', () => previewFile(file), 'pri'));
      card.append(act); listEl.append(card);
      say('Đã kiểm tra xong ' + ext.toUpperCase() + '.');
    } catch (e) { say('Không đọc được gói: ' + errText(e)); }
  }

  async function previewFile(file) {
    try {
      const prep = await S.prepareMod(file, { onProgress: setProgress });
      barEl.style.display = 'none';
      showPreview(prep);
    } catch (e) {
      barEl.style.display = 'none';
      say('Không nhập được: ' + errText(e));
    }
  }

  function showPreview(prep) {
    const m = prep.rec.manifest;
    listEl.textContent = '';
    const box = h('div', 'mcard');
    box.style.gridColumn = '1/-1';
    box.append(h('div', 'mname', 'Xem trước: ' + m.name));
    box.append(h('div', 'msub', 'v' + m.version + ' · ' + (m.author || 'Ẩn danh') + ' · ' + prep.fileCount + ' file · ' + (prep.size / 1024).toFixed(1) + ' KB'));
    if (m.description) box.append(h('div', 'mdesc', m.description));
    if (m.tags && m.tags.length) {
      const tr = h('div', 'mbadges');
      m.tags.forEach(t => tr.append(h('span', 'mtag', t)));
      box.append(tr);
    }
    const perms = (m.permissions || []).map(p => PERM_LABEL[p] || p);
    box.append(h('div', 'mdet', 'Mod này xin quyền: ' + (perms.length ? perms.join(', ') : 'không có (chỉ hiển thị thông tin)') + '. Mod không chạy mã.'));

    let verb = 'Cài đặt';
    if (prep.existing) {
      const old = prep.existing.manifest.version;
      const c = C.compareVersion(m.version, old);
      const txt = c > 0 ? 'Nâng cấp từ v' + old + ' lên v' + m.version
        : c < 0 ? 'HẠ CẤP: bản này cũ hơn v' + old + ' đang cài'
        : 'Cùng phiên bản v' + old + ': sẽ ghi đè';
      box.append(h('div', 'mdesc', txt));
      verb = c < 0 ? 'Hạ cấp' : 'Cập nhật';
    }
    if (!prep.compat.ok) {
      const warn = h('div', 'mbadges');
      warn.append(h('span', 'mb err', 'Không tương thích: ' + prep.compat.reason + ' (sẽ lưu nhưng tắt)'));
      box.append(warn);
    }
    const act = h('div', 'mact');
    act.append(
      btn(verb, () => commitPreview(prep), 'pri'),
      btn('Huỷ', () => render())
    );
    box.append(act);
    listEl.append(box);
  }

  async function commitPreview(prep) {
    try {
      const r = await S.commitMod(prep, { replace: !!prep.existing, onProgress: setProgress });
      say((r.replaced ? 'Đã cập nhật ' : 'Đã cài ') + r.name + ' v' + r.version + (r.compat.ok ? '' : ' (không tương thích, đang tắt)'));
    } catch (e) {
      say('Không cài được: ' + errText(e));
    }
    await render();
  }

  async function move(rec, dir) {
    try {
      await S.moveMod(rec.id, dir);
      say(dir < 0 ? 'Đã đưa ' + rec.manifest.name + ' lên (ưu tiên hơn khi trùng màu)' : 'Đã đưa ' + rec.manifest.name + ' xuống');
    } catch (e) { say(errText(e)); }
    await render();
  }

  async function toggle(rec) {
    try {
      await S.setEnabled(rec.id, !rec.enabled);
      say(rec.enabled ? 'Đã tắt ' + rec.manifest.name : 'Đã bật ' + rec.manifest.name);
    } catch (e) { say(errText(e)); }
    await render();
  }

  async function remove(rec) {
    if (!G.confirm('Xoá mod "' + rec.manifest.name + '" khỏi máy? Thao tác này không hoàn tác được.')) return;
    await S.removeMod(rec.id);
    expanded.delete(rec.id);
    say('Đã xoá ' + rec.manifest.name);
    await render();
  }

  async function exportOne(rec) {
    try { await S.exportMod(rec.id); say('Đã xuất ' + rec.manifest.name); }
    catch (e) { say('Xuất lỗi: ' + errText(e)); }
  }

  async function doBackup() {
    try { const n = await S.backupAll(); say('Đã sao lưu ' + n + ' mod'); }
    catch (e) { say('Sao lưu lỗi: ' + errText(e)); }
  }

  async function doRestore(file) {
    if (!G.confirm('Khôi phục sẽ ghi đè các mod trùng ID trong máy. Tiếp tục?')) return;
    try {
      const r = await S.restoreBackup(file, setProgress);
      say('Khôi phục xong: ' + r.ok + ' mod' + (r.fail.length ? ', lỗi ' + r.fail.length + ' (xem console)' : ''));
      if (r.fail.length) console.warn('VNMod khôi phục lỗi:', r.fail);
      await render();
    } catch (e) { say('Khôi phục lỗi: ' + errText(e)); }
  }

  function badgesFor(rec, rep) {
    const row = h('div', 'mbadges');
    row.append(h('span', 'mb ' + (rec.enabled ? 'ok' : 'info'), rec.enabled ? 'Đang bật' : 'Đang tắt'));
    if (!rec.compat.ok) row.append(h('span', 'mb err', 'Không tương thích'));
    if (rec.error) row.append(h('span', 'mb err', 'Lỗi: ' + rec.error));
    rep.conflicts.resources.filter(r => r.mods.includes(rec.id)).forEach(r => {
      row.append(h('span', 'mb warn', r.winner === rec.id ? 'Đang áp ' + r.key : 'Bị ghi đè ' + r.key));
    });
    return row;
  }

  function syncTagOptions(mods) {
    const all = [...new Set(mods.flatMap(r => r.manifest.tags || []))].sort();
    const cur = tagEl.value;
    tagEl.textContent = '';
    const first = h('option', '', 'Mọi nhóm'); first.value = ''; tagEl.append(first);
    all.forEach(t => { const o = h('option', '', t); o.value = t; tagEl.append(o); });
    tagEl.value = all.includes(cur) ? cur : '';
  }

  function card(rec, rep) {
    const m = rec.manifest;
    const c = h('div', 'mcard' + (rec.enabled ? '' : ' off'));
    c.append(h('div', 'mname', m.name));
    c.append(h('div', 'msub', 'v' + m.version + ' · ' + (m.author || 'Ẩn danh')));
    if (m.tags && m.tags.length) {
      const tr = h('div', 'mbadges');
      m.tags.forEach(t => tr.append(h('span', 'mtag', t)));
      c.append(tr);
    }
    if (m.description) c.append(h('div', 'mdesc', m.description));
    c.append(badgesFor(rec, rep));
    if (expanded.has(rec.id)) {
      const perms = (m.permissions && m.permissions.length) ? m.permissions.join(', ') : 'không có';
      const size = Object.values(rec.files || {}).reduce((a, b) => a + (b.size || 0), 0);
      const det = h('div', 'mdet',
        'ID: ' + rec.id + '\nAPI: ' + m.api + '\nQuyền: ' + perms +
        '\nSố file: ' + Object.keys(rec.files || {}).length + ' (' + (size / 1024).toFixed(1) + ' KB)' +
        '\nƯu tiên: #' + (rec.order || '?') + ' (số nhỏ hơn được ưu tiên khi trùng màu)' +
        '\nCài ngày: ' + new Date(rec.installedAt).toLocaleDateString());
      c.append(det);
    }
    const act = h('div', 'mact');
    act.append(
      btn(rec.enabled ? 'Tắt' : 'Bật', () => toggle(rec), rec.enabled ? '' : 'pri'),
      btn('Chi tiết', () => { expanded.has(rec.id) ? expanded.delete(rec.id) : expanded.add(rec.id); render(); }),
      withTitle(btn('▲', () => move(rec, -1)), 'Đưa lên (ưu tiên hơn khi trùng màu)'),
      withTitle(btn('▼', () => move(rec, 1)), 'Đưa xuống'),
      btn('Xuất', () => exportOne(rec)),
      btn('Xoá', () => remove(rec))
    );
    if (!rec.compat.ok) act.firstChild.disabled = true;
    c.append(act);
    return c;
  }

  function matches(rec, q, f, tag) {
    const m = rec.manifest;
    if (tag && !(m.tags || []).includes(tag)) return false;
    if (q) {
      const hay = (m.name + ' ' + rec.id + ' ' + (m.author || '') + ' ' + (m.description || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f === 'on') return !!rec.enabled;
    if (f === 'off') return !rec.enabled;
    if (f === 'err') return !!rec.error || !rec.compat.ok;
    return true;
  }

  async function render() {
    if (!ov) return;
    const mods = await S.listMods();
    const rep = S.getReport();
    const q = (searchEl.value || '').trim().toLowerCase();
    const f = filterEl.value;
    const tg = tagEl.value;
    syncTagOptions(mods);
    listEl.textContent = '';
    const shown = mods.filter(r => matches(r, q, f, tg) || (f === 'conf' && rep.conflicts.resources.some(x => x.mods.includes(r.id)) && (!tg || (r.manifest.tags || []).includes(tg))));
    if (rep.conflicts.resources.length) {
      const lines = rep.conflicts.resources.map(x => x.key + ': ' + x.mods.join(' và ') + ' (áp ' + x.winner + ')');
      conflictEl.textContent = 'Xung đột màu — ' + lines.join(' · ');
      conflictEl.style.display = 'block';
    } else conflictEl.style.display = 'none';
    if (!mods.length) {
      listEl.append(h('div', 'mempty', 'Chưa có mod nào. Bấm "Nhập .vnmod" để thêm.'));
    } else if (!shown.length) {
      listEl.append(h('div', 'mempty', 'Không có mod khớp bộ lọc.'));
    } else {
      shown.forEach(r => listEl.append(card(r, rep)));
    }
  }

  function build() {
    const style = D.createElement('style');
    style.textContent = CSS;
    D.head.append(style);

    ov = h('div');
    ov.id = 'modov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    const panel = h('div', 'mp');
    const head = h('div', 'mh');
    head.append(h('h2', '', 'Quản lý Mod'), btn('✕', close));
    panel.append(head);

    const tools = h('div', 'mt');
    fileIn = D.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = '.vnmod,.zip,.rar,.7z,application/zip,application/x-rar-compressed,application/x-7z-compressed';
    fileIn.hidden = true;
    fileIn.onchange = () => { if (fileIn.files[0]) previewFile(fileIn.files[0]); fileIn.value = ''; };
    inspectIn = D.createElement('input');
    inspectIn.type = 'file';
    inspectIn.accept = '.zip,.vnmod,.rar,.7z,application/zip';
    inspectIn.hidden = true;
    inspectIn.onchange = () => { if (inspectIn.files[0]) inspectArchive(inspectIn.files[0]); inspectIn.value = ''; };
    restoreIn = D.createElement('input');
    restoreIn.type = 'file';
    restoreIn.accept = '.zip,application/zip';
    restoreIn.hidden = true;
    restoreIn.onchange = () => { if (restoreIn.files[0]) doRestore(restoreIn.files[0]); restoreIn.value = ''; };
    tools.append(fileIn, restoreIn, inspectIn,
      btn('＋ Nhập gói mod', () => fileIn.click(), 'pri'),
      btn('Đọc gói ZIP / RAR5 / 7Z', () => inspectIn.click()),
      btn('＋ Tạo mod từ cảnh', openBuilder),
      btn('Sao lưu', doBackup),
      btn('Khôi phục', () => restoreIn.click()));
    panel.append(tools);

    const filters = h('div', 'mt');
    searchEl = D.createElement('input');
    searchEl.type = 'search';
    searchEl.placeholder = 'Tìm theo tên, tác giả, mô tả...';
    searchEl.oninput = render;
    filterEl = D.createElement('select');
    [['all', 'Tất cả'], ['on', 'Đang bật'], ['off', 'Đang tắt'], ['err', 'Lỗi / không tương thích'], ['conf', 'Có xung đột']]
      .forEach(([v, t]) => { const o = h('option', '', t); o.value = v; filterEl.append(o); });
    filterEl.onchange = render;
    tagEl = D.createElement('select');
    tagEl.onchange = render;
    filters.append(searchEl, filterEl, tagEl);
    panel.append(filters);

    barEl = h('div', 'mbar');
    barFill = h('i');
    barEl.append(barFill);
    panel.append(barEl);
    txtEl = h('div', 'mtxt');
    panel.append(txtEl);
    conflictEl = h('div', 'mtxt');
    conflictEl.style.display = 'none';
    conflictEl.style.color = '#b45309';
    panel.append(conflictEl);

    listEl = h('div', 'mc');
    panel.append(listEl);
    ov.append(panel);
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    D.body.append(ov);
  }

  function open() { if (!ov) build(); ov.classList.add('on'); render(); }
  function close() { if (ov) ov.classList.remove('on'); }

  function addTopButton() {
    const top = D.getElementById('top');
    if (!top || D.getElementById('bmod')) return;
    const b = h('button', '', '🧩');
    b.id = 'bmod';
    b.title = 'Quản lý Mod';
    b.setAttribute('aria-label', 'Quản lý Mod');
    b.onclick = open;
    top.append(b);
  }

  function init() {
    addTopButton();
    S.applyAll().catch(e => console.warn('VNMod: không áp được mod', e));
    G.addEventListener('keydown', e => { if (e.key === 'Escape' && ov && ov.classList.contains('on')) close(); });
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else init();
  /* Mục "Góc nhìn từ mod" trong tab Tư thế. apply(view) do app cung cấp. */
  G.vnmodCameraSection = function (L, apply) {
    const views = S.getCameras();
    if (!views.length) return;
    const head = h('div', 'mtxt', 'Góc nhìn từ mod (đang bật)');
    head.style.cssText = 'font-size:12px;opacity:.85;padding:8px 0 4px';
    L.append(head);
    const row = h('div', '');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0';
    views.forEach(v => {
      const b = btn(v.name + ' · ' + v.modName, () => apply(v.view));
      b.title = 'Từ mod: ' + v.modName;
      row.append(b);
    });
    L.append(row);
  };
  /* Mục "Tư thế từ mod" trong tab Tư thế của app. apply(bones) do app cung cấp. */
  G.vnmodPoseSection = function (L, apply) {
    const poses = S.getPoses();
    if (!poses.length) return;
    const head = h('div', 'mtxt', 'Tư thế từ mod (đang bật)');
    head.style.cssText = 'font-size:12px;opacity:.85;padding:8px 0 4px';
    L.append(head);
    const row = h('div', '');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0';
    poses.forEach(p => {
      const b = btn(p.name + ' · ' + p.modName, () => apply(p.bones));
      b.title = 'Từ mod: ' + p.modName;
      row.append(b);
    });
    L.append(row);
  };
  G.VNMod.ui = { open, close, previewFile, openBuilder };
})(typeof window !== 'undefined' ? window : globalThis);
