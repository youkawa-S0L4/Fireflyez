/* VNMod core: kiểm tra manifest, đường dẫn, kích thước, tương thích và xung đột.
   Thuần logic: không đụng DOM, không thực thi mã từ mod. */
(function (G) {
  'use strict';

  const API_LEVEL = 1;                 // phiên bản API mà app hiện hỗ trợ
  const FORMAT = 'vnmod';
  const LIMITS = {
    zipBytes: 3 * 1024 * 1024,         // file .vnmod tối đa
    files: 40,                         // số file tối đa trong gói
    fileBytes: 512 * 1024,             // mỗi file tối đa
    totalBytes: 2 * 1024 * 1024,       // tổng dung lượng sau giải nén
    manifestBytes: 32 * 1024,
    themeVars: 20
  };
  // Không cho phép file có thể chạy được (js, html, wasm, svg...)
  const ALLOWED_EXT = ['json', 'md', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
  const PERMISSIONS = ['theme', 'pose', 'camera', 'light'];
  const VIEW_MAX = 10;
  const POSE_MAX = 10, POSE_BONES_MAX = 40;
  const THEME_VARS = ['--ac', '--ac2', '--bg', '--fg', '--pn', '--bd'];
  const ID_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
  const SEMVER_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const HEX_RE = /^#[0-9a-f]{3,8}$/i;
  const TAG_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;
  const TAG_MAX = 5;

  class ModError extends Error {
    constructor(code, message, detail) {
      super(message);
      this.name = 'ModError';
      this.code = code;
      this.detail = detail || null;
    }
  }

  // Trả về đường dẫn đã chuẩn hoá, hoặc null nếu không an toàn (chống path traversal).
  function normalizePath(p) {
    if (typeof p !== 'string' || p.length === 0 || p.length > 255) return null;
    if (/[\0\\]/.test(p) || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return null;
    const out = [];
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.' || seg === '..') return null;
      if (seg.length > 100) return null;
      out.push(seg);
    }
    return out.join('/');
  }

  function extOf(path) {
    const i = path.lastIndexOf('.');
    return i < 0 ? '' : path.slice(i + 1).toLowerCase();
  }

  // list: [{ path, size }] với path đã chuẩn hoá. Trả về mảng lỗi (rỗng = hợp lệ).
  function validateFileList(list) {
    const errors = [];
    if (list.length === 0) errors.push('Gói không có file nào');
    if (list.length > LIMITS.files) errors.push('Quá nhiều file (tối đa ' + LIMITS.files + ')');
    const seen = new Set();
    let total = 0;
    for (const f of list) {
      const key = f.path.toLowerCase();
      if (seen.has(key)) errors.push('Trùng đường dẫn: ' + f.path);
      seen.add(key);
      if (!ALLOWED_EXT.includes(extOf(f.path))) errors.push('Loại file không được phép: ' + f.path);
      if (f.size > LIMITS.fileBytes) errors.push('File quá lớn: ' + f.path);
      total += f.size;
    }
    if (total > LIMITS.totalBytes) errors.push('Tổng dung lượng vượt ' + (LIMITS.totalBytes / 1048576) + ' MB');
    return errors;
  }

  // filePaths: Set các đường dẫn đã chuẩn hoá có trong gói.
  function validateManifest(m, filePaths) {
    const err = [];
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      throw new ModError('manifest', 'manifest.json không phải đối tượng JSON');
    }
    if (m.format !== FORMAT) err.push('Không phải định dạng .vnmod (format phải là "vnmod")');
    if (m.format_version !== 1) err.push('Phiên bản định dạng không được hỗ trợ');
    if (typeof m.id !== 'string' || !ID_RE.test(m.id)) err.push('id không hợp lệ (chữ thường, số, . _ -, 3–64 ký tự)');
    if (typeof m.name !== 'string' || !m.name.trim() || m.name.length > 80) err.push('name thiếu hoặc quá dài');
    if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) err.push('version phải có dạng x.y.z');
    if (m.author !== undefined && (typeof m.author !== 'string' || m.author.length > 80)) err.push('author không hợp lệ');
    if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 500)) err.push('description không hợp lệ');
    if (!Number.isInteger(m.api) || m.api < 1) err.push('api phải là số nguyên từ 1 trở lên');
    let tags = [];
    if (m.tags !== undefined) {
      if (!Array.isArray(m.tags) || m.tags.length > TAG_MAX) err.push('tags phải là mảng tối đa ' + TAG_MAX + ' nhóm');
      else {
        for (const t of m.tags) {
          if (typeof t !== 'string' || !TAG_RE.test(t.trim())) { err.push('nhóm không hợp lệ: ' + JSON.stringify(t)); break; }
        }
        tags = [...new Set(m.tags.map(t => t.trim().toLowerCase()))];
      }
    }

    const perms = m.permissions === undefined ? [] : m.permissions;
    if (!Array.isArray(perms) || perms.some(p => !PERMISSIONS.includes(p))) {
      err.push('permissions chứa quyền không được hỗ trợ (cho phép: ' + PERMISSIONS.join(', ') + ')');
    }
    const prov = m.provides === undefined ? {} : m.provides;
    if (typeof prov !== 'object' || prov === null || Array.isArray(prov)) err.push('provides không hợp lệ');

    if (Array.isArray(perms) && perms.includes('theme')) {
      const tp = prov.theme;
      if (typeof tp !== 'string' || !/\.json$/i.test(tp)) err.push('Quyền theme cần provides.theme trỏ tới file .json');
      else if (!filePaths.has(tp)) err.push('provides.theme trỏ tới file không có trong gói: ' + tp);
    }
    if (Array.isArray(perms) && perms.includes('pose')) {
      const pp = prov.pose;
      if (typeof pp !== 'string' || !/\.json$/i.test(pp)) err.push('Quyền pose cần provides.pose trỏ tới file .json');
      else if (!filePaths.has(pp)) err.push('provides.pose trỏ tới file không có trong gói: ' + pp);
    }
    if (Array.isArray(perms) && perms.includes('camera')) {
      const cp = prov.camera;
      if (typeof cp !== 'string' || !/\.json$/i.test(cp)) err.push('Quyền camera cần provides.camera trỏ tới file .json');
      else if (!filePaths.has(cp)) err.push('provides.camera trỏ tới file không có trong gói: ' + cp);
    }
    if (Array.isArray(perms) && perms.includes('light')) {
      const lp = prov.light;
      if (typeof lp !== 'string' || !/\.json$/i.test(lp)) err.push('Quyền light cần provides.light trỏ tới file .json');
      else if (!filePaths.has(lp)) err.push('provides.light trỏ tới file không có trong gói: ' + lp);
    }
    if (prov.readme !== undefined && (typeof prov.readme !== 'string' || !filePaths.has(prov.readme))) {
      err.push('provides.readme trỏ tới file không có trong gói');
    }
    if (err.length) throw new ModError('manifest', err.join('; '), err);

    return Object.assign({}, m, {
      permissions: perms.slice(),
      tags,
      author: m.author || 'Ẩn danh',
      description: m.description || '',
      provides: Object.assign({}, prov)
    });
  }

  // obj: JSON từ pose.json. Trả về { 'tên tư thế': { 'tên xương': [x, y, z] } } đã kiểm tra.
  // Góc là độ, giới hạn -180..180. Tên xương chỉ là khoá tra cứu, không bao giờ được chạy.
  function validatePoses(obj) {
    const bad = m => { throw new ModError('pose', m); };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.poses || typeof obj.poses !== 'object' || Array.isArray(obj.poses)) {
      bad('pose.json cần có đối tượng "poses"');
    }
    const names = Object.keys(obj.poses);
    if (names.length === 0) bad('pose.json không có tư thế nào');
    if (names.length > POSE_MAX) bad('Quá nhiều tư thế (tối đa ' + POSE_MAX + ')');
    const textOk = t => typeof t === 'string' && t.length >= 1 && t.length <= 40 && !/[\u0000-\u001f\u007f]/.test(t);
    const out = {};
    for (const pn of names) {
      if (!textOk(pn)) bad('Tên tư thế không hợp lệ');
      const bones = obj.poses[pn];
      if (!bones || typeof bones !== 'object' || Array.isArray(bones)) bad('Tư thế "' + pn + '" phải là đối tượng xương');
      const bn = Object.keys(bones);
      if (bn.length > POSE_BONES_MAX) bad('Tư thế "' + pn + '" có quá nhiều xương');
      out[pn] = {};
      for (const b of bn) {
        if (!textOk(b)) bad('Tên xương không hợp lệ trong "' + pn + '"');
        const v = bones[b];
        if (!Array.isArray(v) || v.length !== 3 || v.some(x => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 180)) {
          bad('Góc của xương "' + b + '" phải là 3 số trong khoảng -180..180');
        }
        out[pn][b] = v.slice();
      }
    }
    return out;
  }

  // obj: JSON từ camera.json. Trả về { 'tên góc nhìn': { th, ph, ds, tg:[x,y,z], rl? } }.
  // Góc tính bằng radian. Khoảng giá trị được giới hạn để camera không bị đưa ra ngoài phạm vi hợp lý.
  function validateCameras(obj) {
    const bad = m => { throw new ModError('camera', m); };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.views || typeof obj.views !== 'object' || Array.isArray(obj.views)) {
      bad('camera.json cần có đối tượng "views"');
    }
    const names = Object.keys(obj.views);
    if (names.length === 0) bad('camera.json không có góc nhìn nào');
    if (names.length > VIEW_MAX) bad('Quá nhiều góc nhìn (tối đa ' + VIEW_MAX + ')');
    const textOk = t => typeof t === 'string' && t.length >= 1 && t.length <= 40 && !/[\u0000-\u001f\u007f]/.test(t);
    const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    const out = {};
    for (const vn of names) {
      if (!textOk(vn)) bad('Tên góc nhìn không hợp lệ');
      const v = obj.views[vn];
      if (!v || typeof v !== 'object' || Array.isArray(v)) bad('Góc nhìn "' + vn + '" phải là đối tượng');
      if (!num(v.th, -3.2, 3.2)) bad('"th" của "' + vn + '" phải là số trong -3.2..3.2');
      if (!num(v.ph, 0.05, 3.1)) bad('"ph" của "' + vn + '" phải là số trong 0.05..3.1');
      if (!num(v.ds, 1, 1000)) bad('"ds" của "' + vn + '" phải là số trong 1..1000');
      if (!Array.isArray(v.tg) || v.tg.length !== 3 || !v.tg.every(x => num(x, -1000, 1000))) bad('"tg" của "' + vn + '" phải là 3 số trong -1000..1000');
      if (v.rl !== undefined && !num(v.rl, -3.2, 3.2)) bad('"rl" của "' + vn + '" phải là số trong -3.2..3.2');
      out[vn] = { th: v.th, ph: v.ph, ds: v.ds, tg: v.tg.slice(), rl: v.rl || 0 };
    }
    return out;
  }

  // Dựng nội dung một mod từ dữ liệu có sẵn (màu, tư thế, góc nhìn). Mọi phần đều được kiểm tra
  // bằng đúng bộ kiểm tra khi nhập, nên mod tạo ra chắc chắn nhập được. Không sinh mã.
  function slugify(text) {
    const base = String(text || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return base.length >= 3 ? base : 'mod-' + base;
  }

  function buildMod(o) {
    o = o || {};
    const author = (o.author || 'Ẩn danh').slice(0, 80);
    const name = String(o.name || '').trim();
    if (!name || name.length > 80) throw new ModError('build', 'Cần tên mod (tối đa 80 ký tự)');
    const id = o.id || 'vnc.' + slugify(name);
    const version = o.version || '1.0.0';
    const perms = [], provides = {}, files = {};
    if (o.theme) {
      const vars = validateTheme({ vars: o.theme });
      perms.push('theme'); provides.theme = 'theme.json';
      files['theme.json'] = JSON.stringify({ vars }, null, 2);
    }
    if (o.poses) {
      const poses = validatePoses({ poses: o.poses });
      perms.push('pose'); provides.pose = 'pose.json';
      files['pose.json'] = JSON.stringify({ poses }, null, 2);
    }
    if (o.views) {
      const views = validateCameras({ views: o.views });
      perms.push('camera'); provides.camera = 'camera.json';
      files['camera.json'] = JSON.stringify({ views }, null, 2);
    }
    if (!perms.length) throw new ModError('build', 'Mod cần ít nhất một phần: màu, tư thế hoặc góc nhìn');
    const manifest = {
      format: FORMAT, format_version: 1, id, name, version, author,
      description: String(o.description || '').slice(0, 500),
      api: API_LEVEL, permissions: perms, provides
    };
    if (o.tags && o.tags.length) manifest.tags = o.tags.slice(0, TAG_MAX);
    files['manifest.json'] = JSON.stringify(manifest, null, 2);
    if (o.readme !== false) {
      files['README.md'] = '# ' + name + '\n\n' + (manifest.description || '') + '\n\nTạo từ Vân Nguyệt Các.\n';
      provides.readme = 'README.md';
      manifest.provides = provides;
      files['manifest.json'] = JSON.stringify(manifest, null, 2);
    }
    // Kiểm tra lần cuối như khi nhập
    validateManifest(manifest, new Set(Object.keys(files)));
    return { id, manifest, files };
  }

  // obj: JSON từ light.json. Chỉ cho đổi một số: độ sáng tổng (0.2..1). Không đổi màu, không đổi nguồn sáng.
  function validateLight(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.light || typeof obj.light !== 'object') {
      throw new ModError('light', 'light.json cần có đối tượng "light"');
    }
    const lv = obj.light.level;
    if (typeof lv !== 'number' || !Number.isFinite(lv) || lv < 0.2 || lv > 1) {
      throw new ModError('light', 'level phải là số trong 0.2..1');
    }
    const extra = Object.keys(obj.light).filter(k => k !== 'level');
    if (extra.length) throw new ModError('light', 'Thuộc tính không được phép: ' + extra.join(', '));
    return { level: lv };
  }

  // Kiểm tra app có hỗ trợ mod này không. Không đạt thì mod vẫn được lưu nhưng bị tắt.
  function checkCompat(m) {
    if (m.api > API_LEVEL) {
      return { ok: false, reason: 'Cần app hỗ trợ API ' + m.api + ' (app hiện là API ' + API_LEVEL + ')' };
    }
    return { ok: true, reason: '' };
  }

  // obj: JSON đã parse từ file theme. Trả về { '--biến': '#màu' } đã kiểm tra.
  function validateTheme(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.vars || typeof obj.vars !== 'object' || Array.isArray(obj.vars)) {
      throw new ModError('theme', 'theme.json cần có đối tượng "vars"');
    }
    const keys = Object.keys(obj.vars);
    if (keys.length === 0) throw new ModError('theme', 'theme.json không có biến màu nào');
    if (keys.length > LIMITS.themeVars) throw new ModError('theme', 'Quá nhiều biến màu (tối đa ' + LIMITS.themeVars + ')');
    const out = {};
    for (const k of keys) {
      if (!THEME_VARS.includes(k)) throw new ModError('theme', 'Biến không được phép: ' + k);
      const v = obj.vars[k];
      if (typeof v !== 'string' || !HEX_RE.test(v)) throw new ModError('theme', 'Giá trị màu không hợp lệ cho ' + k);
      out[k] = v.toLowerCase();
    }
    return out;
  }

  // mods: [{ id, enabled, vars }] theo thứ tự cài đặt. Trả về trùng ID và trùng biến màu.
  function findConflicts(mods) {
    const res = { duplicateIds: [], resources: [] };
    const ids = new Set();
    for (const m of mods) {
      if (ids.has(m.id)) res.duplicateIds.push(m.id);
      ids.add(m.id);
    }
    const byKey = new Map();
    for (const m of mods) {
      if (!m.enabled || !m.vars) continue;
      for (const k of Object.keys(m.vars)) {
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(m.id);
      }
    }
    for (const [key, list] of byKey) {
      if (list.length > 1) res.resources.push({ key, mods: list, winner: list[list.length - 1] });
    }
    return res;
  }

  // So sánh x.y.z: trả về số âm, 0 hoặc số dương.
  function compareVersion(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  const api = {
    API_LEVEL, TAG_MAX, LIMITS, PERMISSIONS, THEME_VARS, ALLOWED_EXT, ModError,
    normalizePath, extOf, validateFileList, validateManifest, checkCompat,
    validateTheme, validatePoses, validateCameras, validateLight, findConflicts, compareVersion, buildMod, slugify
  };
  G.VNMod = Object.assign(G.VNMod || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
