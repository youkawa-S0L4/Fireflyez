/* 3DMigoto reconstruction viewer for Vân Nguyệt Các (v44).
 * A: Dual source merge (Base face + Mod body)
 * B: Apply reconstructed body onto currently open PMX (overlay, keeps animation)
 * Supports classic VB/FMT and HSR Position/Blend/Texcoord.buf + basic DDS.
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let root, scene, camera, renderer, raf, filesBase = [], filesMod = [], urls = [], modelRoot = null, animating = false;
  let activeTab = 'mod'; // which list is being filled by file picker (mod | base)

  const css = `#migoto{position:fixed;inset:0;z-index:100;background:#080b12f2;color:#edf2ff;display:none;font:14px system-ui}
#migoto.on{display:flex;flex-direction:column}
#migoto .mh{display:flex;gap:8px;align-items:center;padding:10px 14px;background:#111827;border-bottom:1px solid #334155;flex-wrap:wrap}
#migoto .mh strong{flex:1;font-size:16px}
#migoto button{border:1px solid #526078;background:#1e293b;color:#fff;border-radius:9px;padding:8px 11px;font:inherit;cursor:pointer}
#migoto button.primary{background:#6651b8;border-color:#8b78df}
#migoto button:disabled{opacity:.45;cursor:default}
#migoto button.tab{padding:6px 10px;opacity:.7}
#migoto button.tab.on{opacity:1;background:#334155;border-color:#8b78df}
#migoto .body{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:minmax(0,1fr);min-height:0;flex:1;overflow:hidden}
#migoto #mg-view{position:relative;overflow:hidden;min-width:0;min-height:0}
#migoto canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#migoto .side{overflow:auto;padding:12px;background:#111827;border-left:1px solid #334155}
#migoto .drop{border:1px dashed #64748b;border-radius:12px;padding:14px;text-align:center;margin-bottom:8px;color:#cbd5e1}
#migoto .drop.on{border-color:#8b78df;background:#1e293b88}
#migoto .muted{color:#9ca3af;font-size:12px;line-height:1.5}
#migoto .stat{padding:9px;border:1px solid #334155;border-radius:9px;margin:7px 0;overflow-wrap:anywhere;white-space:pre-wrap}
#migoto input{max-width:100%}
#migoto .actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
#migoto .log{white-space:pre-wrap;font:11px ui-monospace,monospace;max-height:180px;overflow:auto;color:#cbd5e1}
#migoto .src{display:flex;gap:6px;margin-bottom:8px}
#migoto #mg-x{position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;z-index:101;width:44px;height:44px;padding:0;font-size:22px;line-height:1;background:#6651b8;border-color:#8b78df}
#migoto .mh{padding-right:60px;min-height:52px}
@media(max-width:900px),(pointer:coarse){
  #migoto .body{grid-template-columns:1fr;grid-template-rows:minmax(200px,42vh) minmax(0,1fr)}
  #migoto .side{border-left:0;border-top:1px solid #334155}
}`;

  function addUI() {
    if ($('#migoto')) return;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.append(st);
    root = document.createElement('section');
    root.id = 'migoto';
    root.innerHTML = `
<header class="mh">
  <strong>3DMigoto · v44 · Ghép mod + gốc</strong>
  <button id="mg-close">Đóng</button>
</header>
<button id="mg-x" aria-label="Đóng" title="Đóng">✕</button>
<div class="body">
  <div id="mg-view"></div>
  <aside class="side">
    <div class="src">
      <button class="tab on" id="mg-tab-mod" data-tab="mod">Mod (Body)</button>
      <button class="tab" id="mg-tab-base" data-tab="base">Gốc (Face)</button>
    </div>
    <div class="drop" id="mg-drop">
      <span id="mg-drop-label">Chọn / thả package <b>Mod</b> (Body/Hair)</span><br>
      ZIP hoặc file .buf/.ib/.dds/.vb/.fmt<br>
      <input id="mg-files" type="file" multiple accept=".zip,.vb,.ib,.fmt,.ini,.buf,.dds,.png,.jpg,.jpeg,.tga,.txt">
    </div>
    <div class="muted" id="mg-counts">Mod: 0 file · Gốc: 0 file</div>
    <div class="actions">
      <button class="primary" id="mg-build">Tái dựng (ghép)</button>
      <button id="mg-reset" disabled>Camera</button>
      <button id="mg-export" disabled>Xuất GLB</button>
      <button id="mg-apply" disabled title="Cần mở PMX gốc trước">Áp vào PMX đang mở</button>
      <button id="mg-clear-apply" title="Gỡ overlay body 3DM">Gỡ overlay</button>
    </div>
    <div class="stat" id="mg-stats">Chưa có dữ liệu.\n\nCách dùng nhanh:\n1. Tab Mod → nạp package bikini/body\n2. Tab Gốc → nạp dump full (có Face/Head)\n3. Tái dựng → Áp vào PMX đang mở</div>
    <div class="muted">Face/Head ưu tiên từ Gốc · Body ưu tiên từ Mod · Hair ưu tiên Mod rồi Gốc. Animation vẫn từ PMX gốc.</div>
    <div class="log" id="mg-log"></div>
  </aside>
</div>`;
    document.body.append(root);
    $('#mg-close').onclick = close;
    $('#mg-x').onclick = close;
    addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('on')) close(); });
    addEventListener('popstate', () => { if (root.classList.contains('on')) close(true); });
    $('#mg-build').onclick = () => build();
    $('#mg-reset').onclick = resetCamera;
    $('#mg-export').onclick = exportGLB;
    $('#mg-apply').onclick = applyToPMX;
    $('#mg-clear-apply').onclick = () => {
      if (window.__vncClear3dmBody) window.__vncClear3dmBody();
      else log('Chưa có bridge PMX.');
    };
    const inp = $('#mg-files');
    inp.onchange = () => ingest(inp.files);
    const drop = $('#mg-drop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('on'); };
    drop.ondragleave = () => drop.classList.remove('on');
    drop.ondrop = e => {
      e.preventDefault();
      drop.classList.remove('on');
      ingest(e.dataTransfer.files);
    };
    $('#mg-tab-mod').onclick = () => setTab('mod');
    $('#mg-tab-base').onclick = () => setTab('base');
  }

  function setTab(tab) {
    activeTab = tab;
    $('#mg-tab-mod').classList.toggle('on', tab === 'mod');
    $('#mg-tab-base').classList.toggle('on', tab === 'base');
    $('#mg-drop-label').innerHTML = tab === 'mod'
      ? 'Chọn / thả package <b>Mod</b> (Body/Hair)'
      : 'Chọn / thả package <b>Gốc</b> (có Face/Head)';
    updateCounts();
  }

  function updateCounts() {
    $('#mg-counts').textContent = 'Mod: ' + filesMod.length + ' file · Gốc: ' + filesBase.length + ' file';
  }

  function log(msg) {
    const el = $('#mg-log');
    if (!el) return;
    el.textContent += (el.textContent ? '\n' : '') + msg;
    el.scrollTop = el.scrollHeight;
  }

  function open() {
    addUI();
    root.classList.add('on');
    try { history.pushState({ migoto: 1 }, ''); } catch (e) {}
    initView();
    // preload BC7 decoder in background
    getBC7Decoder().catch(() => {});
  }

  function close(fromPop) {
    if (!root.classList.contains('on')) return;
    root.classList.remove('on');
    if (fromPop !== true) { try { if (history.state && history.state.migoto) history.back(); } catch (e) {} }
    if (raf) cancelAnimationFrame(raf);
    animating = false;
    urls.forEach(u => URL.revokeObjectURL(u));
    urls = [];
  }

  function initView() {
    if (renderer) return;
    const view = $('#mg-view');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f18);
    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    camera.position.set(1.5, 1.2, 2.2);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    view.append(renderer.domElement);
    scene.add(new THREE.DirectionalLight(0xffffff, 1.15).translateX(2).translateY(4).translateZ(3));
    scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x223344, 0.35));
    let dragging = false, lx = 0, ly = 0, theta = 0.6, phi = 0.4, dist = 2.8;
    const updateCam = () => {
      camera.position.set(dist * Math.sin(theta) * Math.cos(phi), dist * Math.sin(phi), dist * Math.cos(theta) * Math.cos(phi));
      camera.lookAt(0, 0, 0);
    };
    updateCam();
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', e => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} });
    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      theta -= (e.clientX - lx) * 0.008; phi = Math.max(-1.4, Math.min(1.4, phi + (e.clientY - ly) * 0.008));
      lx = e.clientX; ly = e.clientY; updateCam();
    });
    canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(0.15, Math.min(80, dist * (e.deltaY > 0 ? 1.12 : 0.89))); updateCam(); }, { passive: false });
    const resize = () => {
      const w = view.clientWidth || 1, h = view.clientHeight || 1;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    };
    new ResizeObserver(resize).observe(view); resize();
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
    animating = true; loop();
  }

  async function ingest(fileList) {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    log('Nạp vào ' + (activeTab === 'mod' ? 'Mod' : 'Gốc') + ': ' + arr.length + ' mục…');
    const out = [];
    for (const f of arr) {
      if (/\.zip$/i.test(f.name)) {
        try {
          const zip = await JSZip.loadAsync(f);
          const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
          // Detect body-size variants like FireflyModf0001 / f0002
          const variantFolders = new Set();
          for (const name of names) {
            const parts = name.replace(/\\/g, '/').split('/');
            for (const part of parts) {
              if (/f0*\d+$/i.test(part) || /modf0*\d+/i.test(part) || /size|variant|body\d/i.test(part))
                variantFolders.add(part);
            }
          }
          // Prefer variant that has Diffuse textures; else first folder; else all
          let prefer = null;
          if (variantFolders.size > 1) {
            const scored = [];
            for (const vf of variantFolders) {
              let score = 0, hasDiffuse = false, hasPos = false;
              for (const name of names) {
                if (!name.includes(vf)) continue;
                if (/diffuse|albedo|color/i.test(name) && /\.dds$/i.test(name)) { hasDiffuse = true; score += 10; }
                if (/Position\.buf$/i.test(name)) { hasPos = true; score += 3; }
                if (/\.ib$/i.test(name)) score += 1;
              }
              scored.push({ vf, score, hasDiffuse, hasPos });
            }
            scored.sort((a, b) => b.score - a.score);
            prefer = scored[0].vf;
            log('Phát hiện ' + variantFolders.size + ' body-size; chọn: ' + prefer +
              ' (có diffuse: ' + scored[0].hasDiffuse + ')');
            for (const s of scored) log('  · ' + s.vf + ' score=' + s.score);
          }
          for (const name of names) {
            if (prefer && !name.includes(prefer) && [...variantFolders].some(vf => name.includes(vf)))
              continue; // skip other variants
            const entry = zip.files[name];
            const blob = await entry.async('blob');
            // Keep unique basename; if collision, prefix with parent folder
            const parts = name.replace(/\\/g, '/').split('/');
            let base = parts.pop();
            const parent = parts.filter(Boolean).pop() || '';
            // Always use flat basename after variant filter (no collision within one variant)
            const file = new File([blob], base, { type: blob.type || 'application/octet-stream' });
            file._zipPath = name;
            file._variant = prefer || parent;
            out.push(file);
          }
          log('ZIP → ' + out.length + ' file' + (prefer ? ' (variant ' + prefer + ')' : ''));
        } catch (e) { log('Lỗi ZIP: ' + e.message); }
      } else out.push(f);
    }
    if (activeTab === 'mod') filesMod = out; else filesBase = out;
    updateCounts();
    log('Đã nạp ' + out.length + ' file vào ' + (activeTab === 'mod' ? 'Mod' : 'Gốc'));
    const texN = out.filter(f => /\.(dds|png|jpe?g)$/i.test(f.name)).length;
    $('#mg-stats').textContent = 'Mod: ' + filesMod.length + ' · Gốc: ' + filesBase.length +
      '\nTexture trong lần nạp: ' + texN + '\nBấm Tái dựng (ghép).';
  }

  // ---- DDS (same as v41) ----
  const DDS_MAGIC = 0x20534444, DDPF_FOURCC = 0x4, DDPF_RGB = 0x40, DDPF_ALPHAPIXELS = 0x1;
  const FOURCC_DXT1 = 0x31545844, FOURCC_DXT5 = 0x35545844, FOURCC_DX10 = 0x30315844;
  const DXGI_BC1 = 71, DXGI_BC3 = 77, DXGI_BC7 = 98, DXGI_BC7S = 99;

  function decodeDXT1Block(block, out, outX, outY, width) {
    const c0 = block[0] | (block[1] << 8), c1 = block[2] | (block[3] << 8);
    const colors = new Uint8Array(16);
    const r0 = ((c0 >> 11) & 31) * 255 / 31 | 0, g0 = ((c0 >> 5) & 63) * 255 / 63 | 0, b0 = (c0 & 31) * 255 / 31 | 0;
    const r1 = ((c1 >> 11) & 31) * 255 / 31 | 0, g1 = ((c1 >> 5) & 63) * 255 / 63 | 0, b1 = (c1 & 31) * 255 / 31 | 0;
    colors[0] = r0; colors[1] = g0; colors[2] = b0; colors[3] = 255;
    colors[4] = r1; colors[5] = g1; colors[6] = b1; colors[7] = 255;
    if (c0 > c1) {
      colors[8] = (2 * r0 + r1) / 3 | 0; colors[9] = (2 * g0 + g1) / 3 | 0; colors[10] = (2 * b0 + b1) / 3 | 0; colors[11] = 255;
      colors[12] = (r0 + 2 * r1) / 3 | 0; colors[13] = (g0 + 2 * g1) / 3 | 0; colors[14] = (b0 + 2 * b1) / 3 | 0; colors[15] = 255;
    } else {
      colors[8] = (r0 + r1) / 2 | 0; colors[9] = (g0 + g1) / 2 | 0; colors[10] = (b0 + b1) / 2 | 0; colors[11] = 255;
      colors[12] = 0; colors[13] = 0; colors[14] = 0; colors[15] = 0;
    }
    let bits = block[4] | (block[5] << 8) | (block[6] << 16) | (block[7] << 24);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const code = bits & 3; bits >>>= 2; const px = outX + x, py = outY + y; if (px >= width) continue;
      const o = (py * width + px) * 4;
      out[o] = colors[code * 4]; out[o + 1] = colors[code * 4 + 1]; out[o + 2] = colors[code * 4 + 2]; out[o + 3] = colors[code * 4 + 3];
    }
  }
  function decodeDXT5Block(block, out, outX, outY, width) {
    const a0 = block[0], a1 = block[1], alphas = new Uint8Array(8);
    alphas[0] = a0; alphas[1] = a1;
    if (a0 > a1) for (let i = 1; i <= 6; i++) alphas[i + 1] = ((7 - i) * a0 + i * a1) / 7 | 0;
    else { for (let i = 1; i <= 4; i++) alphas[i + 1] = ((5 - i) * a0 + i * a1) / 5 | 0; alphas[6] = 0; alphas[7] = 255; }
    let abits = 0n; for (let i = 0; i < 6; i++) abits |= BigInt(block[2 + i]) << BigInt(8 * i);
    const c0 = block[8] | (block[9] << 8), c1 = block[10] | (block[11] << 8);
    const colors = new Uint8Array(12);
    const r0 = ((c0 >> 11) & 31) * 255 / 31 | 0, g0 = ((c0 >> 5) & 63) * 255 / 63 | 0, b0 = (c0 & 31) * 255 / 31 | 0;
    const r1 = ((c1 >> 11) & 31) * 255 / 31 | 0, g1 = ((c1 >> 5) & 63) * 255 / 63 | 0, b1 = (c1 & 31) * 255 / 31 | 0;
    colors[0] = r0; colors[1] = g0; colors[2] = b0; colors[3] = r1; colors[4] = g1; colors[5] = b1;
    colors[6] = (2 * r0 + r1) / 3 | 0; colors[7] = (2 * g0 + g1) / 3 | 0; colors[8] = (2 * b0 + b1) / 3 | 0;
    colors[9] = (r0 + 2 * r1) / 3 | 0; colors[10] = (g0 + 2 * g1) / 3 | 0; colors[11] = (b0 + 2 * b1) / 3 | 0;
    let bits = block[12] | (block[13] << 8) | (block[14] << 16) | (block[15] << 24);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const code = bits & 3; bits >>>= 2; const aCode = Number(abits & 7n); abits >>= 3n;
      const px = outX + x, py = outY + y; if (px >= width) continue;
      const o = (py * width + px) * 4;
      out[o] = colors[code * 3]; out[o + 1] = colors[code * 3 + 1]; out[o + 2] = colors[code * 3 + 2]; out[o + 3] = alphas[aCode];
    }
  }


  // ---- BC7 via texture2ddecoder-wasm (CDN) ----
  let _bc7Mod = null, _bc7Loading = null;
  async function getBC7Decoder() {
    if (_bc7Mod) return _bc7Mod;
    if (_bc7Loading) return _bc7Loading;
    _bc7Loading = (async () => {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/texture2ddecoder-wasm@1.2.6/dist/index.mjs');
        await mod.initialize({
          wasmPath: 'https://cdn.jsdelivr.net/npm/texture2ddecoder-wasm@1.2.6/wasm/'
        });
        _bc7Mod = mod;
        log('BC7 decoder (WASM) sẵn sàng');
        return mod;
      } catch (e) {
        log('Không tải được BC7 WASM: ' + (e && e.message ? e.message : e));
        _bc7Loading = null;
        throw e;
      }
    })();
    return _bc7Loading;
  }

  async function decodeBC7ToRGBA(blockData, width, height) {
    const mod = await getBC7Decoder();
    // returns BGRA
    const bgra = await mod.decode_bc7(blockData, width, height);
    if (!bgra) return null;
    // BGRA -> RGBA
    const rgba = new Uint8Array(bgra.length);
    for (let i = 0; i < bgra.length; i += 4) {
      rgba[i] = bgra[i + 2];
      rgba[i + 1] = bgra[i + 1];
      rgba[i + 2] = bgra[i];
      rgba[i + 3] = bgra[i + 3];
    }
    return rgba;
  }

  async function loadDDSTexture(file) {
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    if (dv.byteLength < 128 || dv.getUint32(0, true) !== DDS_MAGIC) throw new Error('Không phải DDS: ' + file.name);
    const height = dv.getUint32(12, true), width = dv.getUint32(16, true);
    const pfFlags = dv.getUint32(80, true), fourCC = dv.getUint32(84, true);
    let format = null, dataOffset = 128, blockSize = 16;
    if (pfFlags & DDPF_FOURCC) {
      if (fourCC === FOURCC_DXT1) { format = 'dxt1'; blockSize = 8; }
      else if (fourCC === FOURCC_DXT5) { format = 'dxt5'; blockSize = 16; }
      else if (fourCC === FOURCC_DX10) {
        dataOffset = 148;
        const dxgi = dv.getUint32(128, true);
        if (dxgi === DXGI_BC1) { format = 'dxt1'; blockSize = 8; }
        else if (dxgi === DXGI_BC3) { format = 'dxt5'; blockSize = 16; }
        else if (dxgi === DXGI_BC7 || dxgi === DXGI_BC7S) { format = 'bc7'; blockSize = 16; }
        else throw new Error('DXGI ' + dxgi + ' chưa hỗ trợ');
      } else throw new Error('FourCC chưa hỗ trợ');
    } else if (pfFlags & DDPF_RGB) format = 'rgba';
    else throw new Error('Pixel format không hỗ trợ');
    const rgba = new Uint8Array(width * height * 4);
    if (format === 'bc7') {
      // data after header
      const blockBytes = Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * 16;
      const blockData = new Uint8Array(buf, dataOffset, Math.min(blockBytes, buf.byteLength - dataOffset));
      try {
        const decoded = await decodeBC7ToRGBA(blockData, width, height);
        if (!decoded) { log('BC7 decode null: ' + file.name); return null; }
        rgba.set(decoded);
        log('DDS BC7 OK: ' + file.name + ' (' + width + '×' + height + ')');
      } catch (e) {
        log('BC7 decode lỗi (' + file.name + '): ' + (e && e.message ? e.message : e));
        return null;
      }
    } else if (format === 'rgba') {
      const bpp = (pfFlags & DDPF_ALPHAPIXELS) ? 4 : 3; let src = dataOffset;
      for (let i = 0; i < width * height; i++) {
        rgba[i * 4] = dv.getUint8(src); rgba[i * 4 + 1] = dv.getUint8(src + 1); rgba[i * 4 + 2] = dv.getUint8(src + 2);
        rgba[i * 4 + 3] = bpp === 4 ? dv.getUint8(src + 3) : 255; src += bpp;
      }
    } else {
      const blocksX = Math.max(1, Math.ceil(width / 4)), blocksY = Math.max(1, Math.ceil(height / 4));
      let src = dataOffset;
      for (let by = 0; by < blocksY; by++) for (let bx = 0; bx < blocksX; bx++) {
        const block = new Uint8Array(buf, src, blockSize); src += blockSize;
        if (format === 'dxt1') decodeDXT1Block(block, rgba, bx * 4, by * 4, width);
        else decodeDXT5Block(block, rgba, bx * 4, by * 4, width);
      }
    }
    const tex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
    tex.needsUpdate = true; tex.flipY = false; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    log('DDS OK: ' + file.name + ' ' + width + 'x' + height + ' (' + format + ')');
    return tex;
  }

  async function loadTexture(file) {
    if (/\.dds$/i.test(file.name)) {
      try { return await loadDDSTexture(file); } catch (e) { log('DDS lỗi: ' + e.message); return null; }
    }
    if (/\.(png|jpe?g|tga)$/i.test(file.name)) {
      const u = URL.createObjectURL(file); urls.push(u);
      return await new Promise(res => new THREE.TextureLoader().load(u, t => { t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; res(t); }, undefined, () => res(null)));
    }
    return null;
  }

  function classifyPart(name) {
    const n = name.toLowerCase();
    if (/face|head|脸|頭|头|face/.test(n)) return 'face';
    if (/hair|发|髮|髪/.test(n)) return 'hair';
    if (/body|dress|cloth|body|体|胴|服装/.test(n)) return 'body';
    return 'other';
  }

  function groupHSR(fileList) {
    const groups = {};
    for (const f of fileList) {
      const n = f.name;
      let kind = null, key = null;
      if (/Position\.buf$/i.test(n)) { kind = 'pos'; key = n.replace(/Position\.buf$/i, ''); }
      else if (/Blend\.buf$/i.test(n)) { kind = 'blend'; key = n.replace(/Blend\.buf$/i, ''); }
      else if (/Texcoord\.buf$/i.test(n)) { kind = 'tex'; key = n.replace(/Texcoord\.buf$/i, ''); }
      else if (/\.ib$/i.test(n) && !/DISABLED/i.test(n)) {
        const m = n.match(/^(.+?)([A-Z]?)\.ib$/i);
        if (m) { kind = 'ib'; key = m[1]; f._sub = m[2] || ''; }
      }
      if (kind && key) {
        if (!groups[key]) groups[key] = { key, part: classifyPart(key), pos: null, blend: null, tex: null, ibs: [], source: null };
        if (kind === 'ib') groups[key].ibs.push(f);
        else groups[key][kind] = f;
      }
    }
    return Object.values(groups).filter(g => g.pos && g.ibs.length);
  }

  async function buildGroup(g, texFiles, tag) {
    const posBuf = await g.pos.arrayBuffer();
    const posStride = 40;
    const vcount = Math.floor(posBuf.byteLength / posStride);
    if (vcount < 3 || vcount > 5e6) { log('Bỏ ' + g.key + ' vcount=' + vcount); return []; }
    const pos = new Float32Array(vcount * 3), nrm = new Float32Array(vcount * 3);
    const pdv = new DataView(posBuf);
    for (let i = 0; i < vcount; i++) {
      const o = i * posStride;
      pos[i * 3] = pdv.getFloat32(o, true); pos[i * 3 + 1] = pdv.getFloat32(o + 4, true); pos[i * 3 + 2] = pdv.getFloat32(o + 8, true);
      nrm[i * 3] = pdv.getFloat32(o + 12, true); nrm[i * 3 + 1] = pdv.getFloat32(o + 16, true); nrm[i * 3 + 2] = pdv.getFloat32(o + 20, true);
    }
    let uvs = null;
    if (g.tex) {
      const tb = await g.tex.arrayBuffer();
      const tStride = Math.round(tb.byteLength / vcount);
      if (tStride >= 8 && tStride <= 32) {
        uvs = new Float32Array(vcount * 2);
        const tdv = new DataView(tb);
        let uvOff = (tStride === 12 || tStride === 20) ? 4 : (tStride === 8 ? 0 : Math.max(0, tStride - 8));
        for (let i = 0; i < vcount; i++) {
          const o = i * tStride + uvOff;
          if (o + 8 <= tb.byteLength) { uvs[i * 2] = tdv.getFloat32(o, true); uvs[i * 2 + 1] = tdv.getFloat32(o + 4, true); }
        }
      }
    }
    let matMap = null;
    const candidates = texFiles.filter(t => {
      const tn = t.name.toLowerCase(), key = g.key.toLowerCase();
      return tn.includes(key) || (g.part === 'body' && /body.*(diffuse|albedo|color)/i.test(tn)) ||
        (g.part === 'hair' && /hair.*(diffuse|albedo|color)/i.test(tn)) ||
        (g.part === 'face' && /face|head.*(diffuse|albedo|color)/i.test(tn));
    });
    candidates.sort((a, b) => {
      const score = (n) => {
        let s = 0;
        if (/diffuse|albedo|basecolor|color/i.test(n) && !/light/i.test(n)) s += 20;
        if (/lightmap|light_map|lm\b/i.test(n)) s -= 15;
        if (/normal|bump|specular|metal/i.test(n)) s -= 10;
        if (/\.png|\.jpe?g/i.test(n)) s += 2;
        return s;
      };
      return score(b.name) - score(a.name);
    });
    if (candidates.length) matMap = await loadTexture(candidates[0]);

    const meshes = [];
    for (const ibFile of g.ibs) {
      const ibuf = await ibFile.arrayBuffer();
      let ic = Math.floor(ibuf.byteLength / 2), indices = new Uint16Array(ic), max = 0;
      const idv = new DataView(ibuf);
      for (let i = 0; i < ic; i++) { const n = idv.getUint16(i * 2, true); indices[i] = n; if (n > max) max = n; }
      if (max >= vcount) {
        ic = Math.floor(ibuf.byteLength / 4); indices = new Uint32Array(ic); max = 0;
        for (let i = 0; i < ic; i++) { const n = idv.getUint32(i * 4, true); indices[i] = n; if (n > max) max = n; }
      }
      if (max >= vcount) { log('IB ' + ibFile.name + ' lệch → bỏ'); continue; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      if (uvs) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({
        color: matMap ? 0xffffff : 0xb8c0cc, roughness: 0.78, metalness: 0.05,
        side: THREE.DoubleSide, map: matMap || null
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = g.key + (ibFile._sub || '') + (tag ? '@' + tag : '');
      mesh.userData.part = g.part;
      mesh.userData.source = tag;
      meshes.push(mesh);
      log((tag || '') + ' ' + mesh.name + ' [' + g.part + '] ' + vcount + 'v ' + Math.floor(ic / 3) + 'tri' + (matMap ? ' +tex' : ''));
    }
    return meshes;
  }

  async function build() {
    try {
      if (!filesMod.length && !filesBase.length) throw new Error('Chưa nạp file nào.');
      $('#mg-log').textContent = '';
      log('Bắt đầu ghép…');
      if (modelRoot) scene.remove(modelRoot);
      modelRoot = new THREE.Group();

      const groupsMod = groupHSR(filesMod);
      const groupsBase = groupHSR(filesBase);
      groupsMod.forEach(g => g.source = 'mod');
      groupsBase.forEach(g => g.source = 'base');

      // Merge policy:
      // face → prefer base, else mod
      // body → prefer mod, else base
      // hair → prefer mod, else base
      // other → both
      const byPart = { face: [], body: [], hair: [], other: [] };
      for (const g of groupsBase) byPart[g.part] = byPart[g.part] || [], byPart[g.part].push(g);
      for (const g of groupsMod) byPart[g.part] = byPart[g.part] || [], byPart[g.part].push(g);

      const chosen = [];
      function pick(part, prefer) {
        const list = byPart[part] || [];
        const pref = list.filter(g => g.source === prefer);
        const alt = list.filter(g => g.source !== prefer);
        if (pref.length) chosen.push(...pref);
        else if (alt.length) chosen.push(...alt);
      }
      pick('face', 'base');
      pick('body', 'mod');
      pick('hair', 'mod');
      // other: take all unique keys, mod wins on conflict
      const otherKeys = new Set();
      for (const g of (byPart.other || [])) {
        if (otherKeys.has(g.key)) continue;
        const modG = (byPart.other || []).find(x => x.key === g.key && x.source === 'mod');
        chosen.push(modG || g);
        otherKeys.add(g.key);
      }

      if (!chosen.length) {
        // fallback: just build everything from mod then base
        chosen.push(...groupsMod, ...groupsBase);
      }

      log('Chọn ' + chosen.length + ' nhóm: ' + chosen.map(g => g.key + '(' + g.part + '/' + g.source + ')').join(', '));

      const allTex = [...filesMod, ...filesBase].filter(f => /\.(png|jpe?g|dds)$/i.test(f.name));
      let built = 0, totalVerts = 0, totalTris = 0;
      for (const g of chosen) {
        const texFiles = (g.source === 'mod' ? filesMod : filesBase).filter(f => /\.(png|jpe?g|dds)$/i.test(f.name));
        // also allow cross textures
        const tex = texFiles.length ? texFiles : allTex;
        const meshes = await buildGroup(g, tex, g.source);
        for (const mesh of meshes) {
          modelRoot.add(mesh);
          built++;
          const pos = mesh.geometry.getAttribute('position');
          const idx = mesh.geometry.getIndex();
          totalVerts += pos ? pos.count : 0;
          totalTris += idx ? Math.floor(idx.count / 3) : 0;
        }
      }

      if (!built) throw new Error('Không dựng được mesh. Cần Position.buf + .ib.');

      scene.add(modelRoot);
      const box = new THREE.Box3().setFromObject(modelRoot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      modelRoot.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(maxDim * 1.8, maxDim * 1.2, maxDim * 2);
      camera.near = maxDim / 10000; camera.far = maxDim * 100; camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);

      const parts = {};
      modelRoot.children.forEach(c => { parts[c.userData.part] = (parts[c.userData.part] || 0) + 1; });
      $('#mg-stats').textContent =
        'Ghép thành công ' + built + ' mesh\n' +
        totalVerts.toLocaleString() + ' v · ' + totalTris.toLocaleString() + ' tri\n' +
        'Parts: ' + JSON.stringify(parts) + '\n' +
        (parts.face ? 'Có Face' : 'Chưa có Face (nạp thêm Gốc)') +
        (parts.body ? ' · Có Body' : ' · Chưa có Body');
      $('#mg-reset').disabled = false;
      $('#mg-export').disabled = false;
      $('#mg-apply').disabled = false;
      log('Hoàn tất ghép.');
    } catch (e) {
      $('#mg-stats').textContent = 'Lỗi: ' + e.message;
      log('LỖI: ' + e.message);
    }
  }

  function resetCamera() {
    if (!modelRoot) return;
    const b = new THREE.Box3().setFromObject(modelRoot);
    const s = b.getSize(new THREE.Vector3());
    const m = Math.max(s.x, s.y, s.z) || 1;
    camera.position.set(m * 1.8, m * 1.2, m * 2); camera.lookAt(0, 0, 0);
  }

  function exportGLB() {
    if (!modelRoot) return;
    const run = () => {
      if (!THREE.GLTFExporter) { log('Thiếu GLTFExporter'); return; }
      new THREE.GLTFExporter().parse(modelRoot, result => {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = '3dmigoto-merged.glb'; a.click();
        setTimeout(() => URL.revokeObjectURL(u), 3000);
      }, e => log('GLB lỗi: ' + e.message), { binary: true });
    };
    if (THREE.GLTFExporter) return run();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
    s.onload = run; s.onerror = () => log('Không tải GLTFExporter'); document.head.append(s);
  }

  function applyToPMX() {
    if (!modelRoot) { log('Chưa dựng model'); return; }
    const bodyOnly = new THREE.Group();
    // Body + hair from mod overlay; face stays on PMX
    modelRoot.children.forEach(c => {
      const part = c.userData.part;
      if (part === 'body' || part === 'hair' || part === 'other') bodyOnly.add(c.clone(true));
    });
    if (!bodyOnly.children.length) {
      modelRoot.children.forEach(c => {
        if (c.userData.part !== 'face') bodyOnly.add(c.clone(true));
      });
    }
    if (!bodyOnly.children.length) {
      log('Không có mesh body/hair để áp.');
      return;
    }
    if (window.__vncApply3dmBody) {
      const ok = window.__vncApply3dmBody(bodyOnly);
      if (ok) log('Đã áp Body+Hair 3DM lên PMX (overlay). Face + xương + VMD vẫn từ PMX gốc.');
      else log('Áp thất bại — hãy mở PMX gốc trước ở app chính.');
    } else {
      log('Bridge PMX chưa sẵn sàng. Tải lại trang (v44).');
    }
  }

  function addButton() {
    if ($('#b3dm')) return;
    const b = document.createElement('button');
    b.id = 'b3dm'; b.type = 'button'; b.textContent = '3DM';
    b.title = 'Ghép mod 3DMigoto + model gốc, áp lên PMX';
    const anchor = $('#badd');
    if (anchor) anchor.insertAdjacentElement('afterend', b);
    else ($('#top') || document.body).append(b);
    b.onclick = open;
  }

  window.__open3DMigoto = open;
  addButton();
})();
