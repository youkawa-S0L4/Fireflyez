/* Các mục còn thiếu so với menu PocketMQO: Thông tin cảnh, chỉnh FOV, chia sẻ ảnh, tải tư thế .vpd.
   Đọc các biến toàn cục của app (P, cam, PR, shotRun...). Không đổi logic cũ, chỉ thêm. */
(function () {
  'use strict';
  const D = document;
  const G = typeof window !== 'undefined' ? window : globalThis;
  const CSS = `
#bextra{min-width:40px}
#xov{position:fixed;inset:0;z-index:24;display:none;background:#0008;align-items:center;justify-content:center;padding:12px}
#xov.on{display:flex}
#xov .xp{width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;background:var(--pn,#fff);color:var(--fg,#111);border:1px solid var(--bd,#0002);border-radius:14px;overflow:hidden}
#xov .xh{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--bd,#0002)}
#xov .xh b{flex:1;font-size:17px}
#xov .xh button{min-width:44px;min-height:44px}
#xov .xb{overflow-y:auto;padding:8px 14px 16px}
#xov h3{margin:14px 0 6px;font-size:13px;letter-spacing:.03em;text-transform:uppercase;opacity:.75}
#xov dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0;font-size:14px}
#xov dt{opacity:.75}#xov dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
#xov .xr{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#xov .xr button{min-height:44px;padding:8px 14px}
#xov input[type=range]{flex:1 1 180px;min-height:36px}
#xov .xn{font-size:12px;opacity:.75;line-height:1.45;margin:6px 0 0}
#xov .xs{font-size:13px;min-height:18px;margin-top:8px}
#xov .xcam{display:flex;flex-direction:column;gap:6px}
#xov .xcam button{min-height:44px;text-align:left;padding:8px 12px}
#xov .xcam button.on{outline:2px solid var(--ac,#7a3fd1)}
#xov .xr button.on{outline:2px solid var(--ac,#7a3fd1)}
#vwel{position:fixed;inset:0;z-index:11;display:none;align-items:center;justify-content:center;padding:16px;pointer-events:none}
#vwel .vwc{pointer-events:auto;max-width:420px;width:100%;background:var(--pn,#fff);color:var(--fg,#111);border:1px solid var(--bd,#0002);border-radius:16px;padding:18px;box-shadow:0 10px 30px #0004}
#vwel .vwt{font-size:20px;font-weight:700;margin-bottom:4px}
#vwel .vws{font-size:14px;opacity:.85;margin-bottom:12px;line-height:1.45}
#vwel .vwr{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
#vwel .vwr button{min-height:44px;padding:8px 14px}
#vwel .vwn{font-size:12px;opacity:.7;line-height:1.45}
@media (orientation:landscape) and (max-height:520px){#vwel{align-items:center}#vwel .vwc{max-width:360px;padding:12px}#vwel .vwt{font-size:17px}}
#awarn{position:fixed;inset:0;z-index:27;display:none;align-items:center;justify-content:center;padding:14px;background:#000a}
#awarn.on{display:flex}
#awarn .awp{width:100%;max-width:440px;max-height:92vh;overflow-y:auto;background:var(--pn,#fff);color:var(--fg,#111);border:1px solid var(--bd,#0002);border-radius:16px;padding:18px}
#awarn .awt{font-size:18px;font-weight:700;color:#dc2626;margin-bottom:10px}
#awarn .awm{font-size:14px;line-height:1.45;margin:8px 0}
#awarn ul{font-size:14px;line-height:1.5;padding-left:20px;margin:8px 0}
#awarn .awc{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:12px 0;padding:10px;border:1px solid var(--bd,#0002);border-radius:12px}
#awarn .awc input{width:20px;height:20px;margin-top:2px;flex:none}
#awarn .awr{display:flex;flex-direction:column;gap:8px}
#awarn .awr button{min-height:46px;font-size:15px}
#awarn .awr button:disabled{opacity:.45}
#vfps{position:fixed;top:calc(var(--topH,56px) + 6px);left:8px;z-index:12;display:none;pointer-events:none;font:600 12px/1.2 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:#000a;padding:3px 7px;border-radius:6px;font-variant-numeric:tabular-nums}
`;
  let ov, dlEl, fovEl, fovVal, vpdMsg, vpdIn, camStat, camList, opRow, phStat, phBtn, fpsBtn;

  // Bộ đếm FPS: đếm số khung hình mỗi nửa giây bằng vòng rAF riêng, không đụng vòng render của app.
  let fpsEl = null, fpsOn = false, fpsRaf = 0, fpsFrames = 0, fpsLast = 0;
  function fpsTick(t) {
    fpsFrames++;
    if (t - fpsLast >= 500) {
      const fps = Math.round(fpsFrames * 1000 / (t - fpsLast));
      fpsFrames = 0;
      fpsLast = t;
      if (fpsEl) fpsEl.textContent = 'FPS: ' + fps;
    }
    fpsRaf = requestAnimationFrame(fpsTick);
  }
  function setFps(on) {
    fpsOn = !!on;
    if (!fpsEl) {
      fpsEl = D.createElement('div');
      fpsEl.id = 'vfps';
      fpsEl.setAttribute('aria-live', 'off');
      D.body.append(fpsEl);
    }
    fpsEl.style.display = fpsOn ? 'block' : 'none';
    if (fpsOn && !fpsRaf) { fpsLast = performance.now(); fpsFrames = 0; fpsRaf = requestAnimationFrame(fpsTick); }
    if (!fpsOn && fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0; }
    try { localStorage.setItem('vnc_fps', fpsOn ? '1' : '0'); } catch (e) {}
    if (fpsBtn) fpsBtn.textContent = fpsOn ? 'Tắt hiện FPS' : 'Hiện FPS';
  }
  function toggleFps() { setFps(!fpsOn); }


  const h = (t, c, x) => { const e = D.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
  const btn = (label, fn, cls) => { const b = h('button', cls || '', label); b.type = 'button'; b.onclick = fn; return b; };
  const ready = () => typeof P !== 'undefined' && P && !P.fx && P.bn;
  const nf = n => Number(n).toLocaleString('vi-VN');

  function stats() {
    if (!ready()) return [['Trạng thái', 'Chưa có model PMX. Hãy mở một model trước.']];
    const A = P.anim;
    const sumKeys = o => (o && typeof o === 'object') ? Object.values(o).reduce((n, a) => n + ((a && a.length) || 0), 0) : 0;
    const bk = sumKeys(A && A.b), mk = sumKeys(A && A.m);
    return [
      ['Model', (typeof LF !== 'undefined' && LF && LF.name) || '(không rõ)'],
      ['Đỉnh', nf(P.pos.length / 3)],
      ['Mặt', nf((P.idx ? P.idx.length : 0) / 3)],
      ['Vật liệu', nf(P.mt.length)],
      ['Xương', nf(P.bn.length)],
      ['Morph', nf(P.mo.length)],
      ['Texture', nf(P.tex.length)],
      ['Key chuyển động (xương)', bk ? nf(bk) : 'không có'],
      ['Key chuyển động (morph)', mk ? nf(mk) : 'không có'],
      ['FOV hiện tại', (typeof cam !== 'undefined' ? cam.fov.toFixed(0) : '?') + '°']
    ];
  }

  function renderStats() {
    dlEl.textContent = '';
    stats().forEach(([k, v]) => { dlEl.append(h('dt', '', k), h('dd', '', String(v))); });
    if (typeof cam !== 'undefined') { fovEl.value = cam.fov; fovVal.textContent = cam.fov.toFixed(0) + '°'; }
  }

  // Chỉnh góc nhìn: đổi FOV của camera hiện tại
  function setFov(v) {
    if (typeof cam === 'undefined') return;
    cam.fov = +v;
    cam.updateProjectionMatrix();
    fovVal.textContent = (+v).toFixed(0) + '°';
  }

  // Chia sẻ ảnh: dùng đúng quy trình chụp của app, chỉ đổi đích sang chia sẻ
  async function shareShot() {
    if (!ready()) { hint('Hãy mở model trước khi chia sẻ'); return; }
    window.vnShareHook = async (b, W, H) => {
      const name = 'van-nguyet-cac-' + W + 'x' + H + '.png';
      const file = new File([b], name, { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Vân Nguyệt Các' });
          hint('Đã mở chia sẻ');
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') { hint('Đã huỷ chia sẻ'); return; }
      }
      const u = URL.createObjectURL(b), a = D.createElement('a');
      a.href = u; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      hint('Trình duyệt không chia sẻ được, đã tải ảnh về');
    };
    shotRun();
  }

  // Vật lý: trạng thái Rigid (Ammo.js). Bật/tắt dùng đúng nút Rigid của app.
  function renderPhysics() {
    if (!phStat) return;
    const b = D.getElementById('brb');
    const on = !!(b && /bật/i.test(b.textContent) && !/tắt/i.test(b.textContent));
    const ready = typeof RBP !== 'undefined' && RBP !== null;
    phStat.textContent = on
      ? 'Rigid đang bật: tóc, váy và các phần vật lý khác rơi và đung đưa theo chuyển động.'
      : 'Rigid đang tắt: dùng vật lý lò xo đơn giản.';
    phBtn.textContent = on ? 'Tắt Rigid' : 'Bật Rigid';
    if (!on && !ready) phStat.textContent += ' Lần bật đầu cần mạng để tải Ammo.js.';
  }
  function toggleRigid() {
    const b = D.getElementById('brb');
    if (b) b.click();
    setTimeout(renderPhysics, 0);
  }

  // Chế độ thao tác: Camera (kéo để xoay góc nhìn) / Xoay xương / IK.
  // Dùng đúng nút "Kéo để xoay xương" và "IK" của app, để giữ nguyên logic loại trừ lẫn nhau.
  const OPS = [['cam', 'Camera'], ['bone', 'Xoay xương'], ['ik', 'IK (tay/chân)']];
  function currentOp() {
    if (typeof rotMode !== 'undefined' && rotMode) return 'bone';
    if (typeof ikMode !== 'undefined' && ikMode) return 'ik';
    return 'cam';
  }
  function setOp(mode) {
    const cur = currentOp();
    if (cur !== mode) {
      if (mode === 'cam') {
        if (cur === 'bone') D.getElementById('brot').click();
        else if (cur === 'ik') D.getElementById('bik').click();
      } else if (mode === 'bone') {
        D.getElementById('brot').click();
      } else if (mode === 'ik') {
        D.getElementById('bik').click();
      }
    }
    renderOp();
  }
  function renderOp() {
    if (!opRow) return;
    opRow.textContent = '';
    const cur = currentOp();
    OPS.forEach(([k, label]) => {
      const b = btn(label, () => setOp(k));
      if (k === cur) b.classList.add('on');
      b.setAttribute('aria-pressed', k === cur ? 'true' : 'false');
      opRow.append(b);
    });
  }

  // Camera chuyển động: chọn camera từ gói của model đang mở, hoặc tắt camera.
  function camStatusText() {
    const A = ready() && P.anim;
    const n = A && A.cam ? A.cam.length : 0;
    if (!n || !camOn) return 'Không dùng camera chuyển động.';
    const last = A.cam[A.cam.length - 1];
    return 'Đang dùng camera: ' + nf(n) + ' key, ' + (last.f / 30).toFixed(1) + ' giây.';
  }

  function camCandidates() {
    if (typeof LIB === 'undefined' || typeof CURSRC === 'undefined' || !CURSRC) return [];
    return LIB.filter(x => x.kind === 'cam' && x.pid === CURSRC.pid);
  }

  function renderCams() {
    camStat.textContent = camStatusText();
    camList.textContent = '';
    if (!ready()) { camList.append(h('div', 'xn', 'Hãy mở model PMX trước.')); return; }
    const list = camCandidates();
    const off = btn('Không dùng camera', noCam);
    if (!camOn || !(P.anim && P.anim.cam && P.anim.cam.length)) off.classList.add('on');
    camList.append(off);
    if (!list.length) {
      camList.append(h('div', 'xn', 'Gói của model này không có file camera. Có thể nhập thêm file VMD camera vào Thư viện.'));
      return;
    }
    list.forEach(e => {
      const b = btn(e.name || 'Camera', () => useCam(e));
      camList.append(b);
    });
  }

  async function useCam(e) {
    try {
      const F = await getF(e);
      await loadCamVMD({ name: e.name, arrayBuffer: () => F[e.key].async('arraybuffer') });
    } catch (err) {
      hint('Không nạp được camera: ' + (err.message || err));
    }
    renderCams();
  }

  function noCam() {
    if (!ready()) return;
    camOn = false;
    P.anim.cam = [];
    lastI = -1;
    dirty = true;
    show();
    hint('Đã tắt camera chuyển động');
    renderCams();
  }

  // Đọc file VPD: tên xương + vị trí + quaternion. Chỉ lấy góc xoay (phần vị trí bỏ qua).
  function parseVPD(text) {
    if (!/Bone\d*\s*\{/.test(text)) throw new Error('File không đúng định dạng VPD (không thấy khối Bone{)');
    const out = {};
    const re = /Bone\d*\s*\{([^\r\n{}]*)[\r\n]+([\s\S]*?)\}/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1].trim();
      const nums = (m[2].match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map(Number);
      if (!name || nums.length < 7) continue;
      out[name] = nums.slice(3, 7); // quaternion x, y, z, w
    }
    if (!Object.keys(out).length) throw new Error('Không đọc được xương nào trong file VPD');
    return out;
  }

  function quatToDeg(q) {
    const qq = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize();
    const e = new THREE.Euler().setFromQuaternion(qq, 'XYZ');
    const c = v => Math.max(-180, Math.min(180, v * 180 / Math.PI));
    return [c(e.x), c(e.y), c(e.z)].map(v => Math.round(v * 10) / 10);
  }

  function applyVPD(map) {
    if (!ready()) { hint('Hãy mở model PMX trước'); return; }
    ckpt();
    PR = {};
    let hit = 0;
    const miss = [];
    for (const name in map) {
      const i = P.bn.findIndex(b => b.name === name);
      if (i >= 0) { PR[i] = quatToDeg(map[name]); hit++; } else miss.push(name);
    }
    dirty = true;
    show();
    const txt = 'Đã áp ' + hit + ' xương từ VPD' + (miss.length ? '. Bỏ qua ' + miss.length + ' xương không khớp tên.' : '.');
    vpdMsg.textContent = hit ? txt : 'Không khớp xương nào. Kiểm tra file có cùng bộ xương với model không.';
    hint(txt);
  }

  function onVpdPick(file) {
    if (!file) return;
    if (!ready()) { vpdMsg.textContent = 'Hãy mở model PMX trước.'; return; }
    const r = new FileReader();
    r.onload = () => {
      try { applyVPD(parseVPD(String(r.result))); }
      catch (e) { vpdMsg.textContent = 'Lỗi: ' + (e.message || e); }
    };
    r.onerror = () => { vpdMsg.textContent = 'Không đọc được file.'; };
    r.readAsText(file, 'utf-8');
  }

  function build() {
    const st = D.createElement('style');
    st.textContent = CSS;
    D.head.append(st);
    ov = h('div'); ov.id = 'xov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const p = h('div', 'xp');
    const hd = h('div', 'xh');
    hd.append(h('b', '', 'Thông tin & công cụ'), btn('✕', close));
    p.append(hd);
    const bd = h('div', 'xb');

    bd.append(h('h3', '', 'Thông tin cảnh'));
    dlEl = h('dl');
    bd.append(dlEl);

    bd.append(h('h3', '', 'Đặt lại'));
    const rr = h('div', 'xr');
    rr.append(btn('Reset toàn bộ về lúc mở file', () => {
      if (!G.confirm || G.confirm('Đưa model về trạng thái lúc mở file? Tư thế, morph, ẩn/hiện vật liệu, camera và vật lý sẽ về mặc định. Chất lượng và cài đặt chung không đổi.')) {
        if (typeof window.vnmodResetAll === 'function') window.vnmodResetAll();
      }
    }, 'pri'));
    bd.append(rr);
    bd.append(h('p', 'xn', 'Ctrl+Z không hoàn tác được morph và ẩn/hiện vật liệu. Hãy cẩn thận khi dùng.'));

    bd.append(h('h3', '', 'Hiệu năng'));
    const fr2 = h('div', 'xr');
    fpsBtn = btn(fpsOn ? 'Tắt hiện FPS' : 'Hiện FPS', toggleFps);
    fr2.append(fpsBtn);
    bd.append(fr2);
    bd.append(h('p', 'xn', 'Hiện số khung hình mỗi giây ở góc trên bên trái. Số càng cao càng mượt. Nếu xuống dưới 30, thử giảm chất lượng trên thanh công cụ.'));

    bd.append(h('h3', '', 'Vật lý'));
    phStat = h('div', 'xn', '');
    bd.append(phStat);
    const pr = h('div', 'xr');
    phBtn = btn('Bật Rigid', toggleRigid, 'pri');
    pr.append(phBtn);
    bd.append(pr);
    bd.append(h('p', 'xn', 'Trọng lực và độ cứng của vật lý chưa chỉnh được từ đây. Các thông số này nằm bên trong thư viện vật lý, cần kiểm tra trước khi thay đổi.'));

    bd.append(h('h3', '', 'Chế độ thao tác'));
    opRow = h('div', 'xr');
    bd.append(opRow);
    bd.append(h('p', 'xn', 'Camera: kéo để xoay góc nhìn. Xoay xương: chạm chấm tím để chọn xương, rồi kéo. IK: kéo tay hoặc chân.'));

    bd.append(h('h3', '', 'Camera chuyển động'));
    camStat = h('div', 'xn', '');
    bd.append(camStat);
    camList = h('div', 'xcam');
    bd.append(camList);

    bd.append(h('h3', '', 'Góc nhìn (FOV)'));
    const fr = h('div', 'xr');
    fovEl = D.createElement('input'); fovEl.type = 'range'; fovEl.min = 20; fovEl.max = 60; fovEl.step = 1;
    fovEl.oninput = () => setFov(fovEl.value);
    fovVal = h('span', '', '');
    fr.append(fovEl, fovVal);
    bd.append(fr);
    bd.append(h('p', 'xn', 'FOV nhỏ là nhìn gần, như ống tele. FOV lớn là góc rộng.'));

    bd.append(h('h3', '', 'Chia sẻ'));
    const sr = h('div', 'xr');
    sr.append(btn('Chụp và chia sẻ', shareShot, 'pri'));
    bd.append(sr);
    bd.append(h('p', 'xn', 'Trên Android mở bảng chia sẻ của hệ thống. Nếu không hỗ trợ, ảnh sẽ được tải về.'));

    bd.append(h('h3', '', 'Tải tư thế (.vpd)'));
    const vr = h('div', 'xr');
    vpdIn = D.createElement('input'); vpdIn.type = 'file'; vpdIn.accept = '.vpd,text/plain'; vpdIn.hidden = true;
    vpdIn.onchange = () => { onVpdPick(vpdIn.files[0]); vpdIn.value = ''; };
    vr.append(vpdIn, btn('Chọn file .vpd', () => vpdIn.click()));
    bd.append(vr);
    vpdMsg = h('div', 'xs', '');
    bd.append(vpdMsg);
    bd.append(h('p', 'xn', 'Tải tư thế chỉ đặt góc xoay của xương có cùng tên trong model. Vị trí không được áp dụng. Với một số model, hướng xoay có thể lệch, khi đó hãy chỉnh bằng tab Tạo dáng.'));

    p.append(bd);
    ov.append(p);
    ov.addEventListener('pointerdown', e => { if (e.target === ov) close(); });
    D.body.append(ov);
  }

  function open() {
    if (!ov) build();
    ov.classList.add('on');
    vpdMsg.textContent = '';
    renderStats();
    renderCams();
    renderOp();
    renderPhysics();
    if (fpsBtn) fpsBtn.textContent = fpsOn ? 'Tắt hiện FPS' : 'Hiện FPS';
  }
  function close() { if (ov) ov.classList.remove('on'); }

  function addButton() {
    const top = D.getElementById('top');
    if (!top || D.getElementById('bextra')) return;
    const b = h('button', '', 'ⓘ');
    b.id = 'bextra';
    b.title = 'Thông tin & công cụ';
    b.setAttribute('aria-label', 'Thông tin và công cụ');
    b.onclick = open;
    top.append(b);
  }

  // Thẻ chào mừng: hiện khi chưa có model, giúp người mới biết bắt đầu từ đâu. Tự ẩn khi đã nạp model.
  let welEl = null;
  function buildWelcome() {
    welEl = D.createElement('div');
    welEl.id = 'vwel';
    welEl.setAttribute('role', 'region');
    welEl.setAttribute('aria-label', 'Bắt đầu');
    const card = h('div', 'vwc');
    card.append(h('div', 'vwt', 'Vân Nguyệt Các'));
    welEl.append(card);
    welEl._card = card;
    welEl._sub = h('div', 'vws', '');
    card.append(welEl._sub);
    const row = h('div', 'vwr');
    row.append(
      btn('📂 Mở file', () => { const b = D.getElementById('bload'); if (b) b.click(); }, 'pri'),
      btn('🧩 Mod', () => { if (G.VNMod && G.VNMod.ui) G.VNMod.ui.open(); }),
      btn('? Hướng dẫn', () => { const b = D.getElementById('bhelp'); if (b) b.click(); })
    );
    card.append(row);
    card.append(h('div', 'vwn', 'Mở file .zip có model PMX (kèm chuyển động, camera, nhạc nếu có), hoặc kéo thả file vào màn hình.'));
    D.body.append(welEl);
  }
  // Cảnh báo 18+ theo từng model: chỉ hiện khi model có mục khớp bộ lọc nội dung, và app đang ở chế độ an toàn.
  let warnedP = null, awEl = null, awCb = null, awGo = null;
  function buildAdultWarn() {
    awEl = D.createElement('div');
    awEl.id = 'awarn';
    awEl.setAttribute('role', 'dialog');
    awEl.setAttribute('aria-modal', 'true');
    const p = h('div', 'awp');
    p.append(h('div', 'awt', 'Model có nội dung 18+'));
    awEl._msg = h('div', 'awm', '');
    p.append(awEl._msg);
    const ul = D.createElement('ul');
    ['Chỉ dành cho người từ đủ 18 tuổi.',
     'Không mở ở nơi công cộng hoặc trước mặt trẻ em và người không muốn xem.',
     'Theo readme của tác giả model: cấm đăng lại, ghép lại hoặc dùng trái phép.']
      .forEach(t => ul.append(h('li', '', t)));
    p.append(ul);
    awEl._msg2 = h('div', 'awm', 'Các mục này đang ẩn cho đến khi bạn chọn hiện.');
    p.append(awEl._msg2);
    const lb = h('label', 'awc');
    awCb = D.createElement('input'); awCb.type = 'checkbox';
    awCb.onchange = () => { awGo.disabled = !awCb.checked; };
    lb.append(awCb, h('span', '', 'Tôi xác nhận mình đủ 18 tuổi và đồng ý các điều trên.'));
    p.append(lb);
    const row = h('div', 'awr');
    awGo = btn('Hiện nội dung 18+', () => {
      if (!awCb.checked) return;
      if (typeof setAdult === 'function') setAdult(true);
      closeAdultWarn();
    }, 'pri');
    awGo.disabled = true;
    row.append(awGo, btn('Giữ ẩn', closeAdultWarn));
    p.append(row);
    awEl.append(p);
    D.body.append(awEl);
  }
  function closeAdultWarn() { if (awEl) awEl.classList.remove('on'); }
  function showAdultWarn(n) {
    if (!awEl) buildAdultWarn();
    awCb.checked = false;
    awGo.disabled = true;
    awEl._msg.textContent = 'Có ' + n + ' mục trong model khớp với bộ lọc nội dung 18+ theo tên.';
    awEl.classList.add('on');
  }
  function checkAdult() {
    if (typeof P === 'undefined' || !P || P.fx || !P.mt) return;
    if (typeof ADULT === 'undefined' || ADULT) return;
    if (P === warnedP) return;
    warnedP = P;
    if (typeof RX_X === 'undefined') return;
    const n = P.mt.filter(m => RX_X.test(m.name)).length;
    if (n > 0) showAdultWarn(n);
  }

  function updateWelcome() {
    checkAdult();
    if (!welEl) return;
    const hasModel = typeof P !== 'undefined' && !!P;
    const loading = typeof LD !== 'undefined' && !!LD;
    welEl.style.display = (hasModel || loading) ? 'none' : 'flex';
    if (typeof LIB !== 'undefined' && LIB.length) {
      const packs = new Set(LIB.map(e => e.pid)).size;
      welEl._sub.textContent = 'Thư viện có ' + packs + ' gói đã lưu. Bấm Mở file rồi chọn từ thư viện, hoặc mở file mới.';
    } else {
      welEl._sub.textContent = 'Chưa có gì trong thư viện. Mở file đầu tiên để bắt đầu.';
    }
  }
  function startWelcome() {
    buildWelcome();
    updateWelcome();
    const t = setInterval(updateWelcome, 700);
    if (t && t.unref) t.unref(); // không giữ tiến trình khi chạy thử trên Node
  }

  D.addEventListener('keydown', e => { if (e.key === 'Escape' && ov && ov.classList.contains('on')) close(); });
  try { if (localStorage.getItem('vnc_fps') === '1') setFps(true); } catch (e) {}
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', () => { addButton(); startWelcome(); });
  else { addButton(); startWelcome(); }
  window.vnExtras = { open, close, parseVPD };
})();
