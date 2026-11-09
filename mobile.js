/* Điện thoại: gom ba nút công cụ (ⓘ, 🧩, ?) vào menu Cài đặt có sẵn của app (#menu), và chỉnh
   bố cục cho màn hình hẹp và chế độ ngang. Nút Cài đặt (#bmenu) của app luôn giữ trên thanh trên.
   Không tạo menu thứ hai. Máy tính không thay đổi. */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const D = document;
  const TOOLS = ['bextra', 'bmod', 'bhelp'];
  const TOOL_LABEL = { bextra: 'Thông tin & công cụ', bmod: 'Quản lý Mod', bhelp: 'Hướng dẫn' };

  const CSS = `
#top button{min-height:44px;min-width:44px}
#top{padding-left:max(6px,env(safe-area-inset-left,0px));padding-right:max(6px,env(safe-area-inset-right,0px))}
#menu button{min-height:44px}
#grip::after{content:'Kéo hoặc chạm để đổi cỡ';display:block;text-align:center;font-size:11px;opacity:.6;padding-bottom:2px}
@media (max-width:700px){
  #help,#modov,#xov{align-items:flex-end!important;padding:0!important}
  #help .hc,#modov .mp,#xov .xp{max-width:none!important;width:100%!important;max-height:88vh!important;height:auto;border-radius:18px 18px 0 0!important;border:0!important;padding-top:22px!important;position:relative;padding-bottom:max(14px,env(safe-area-inset-bottom,0px))!important}
  #help .hc::before,#modov .mp::before,#xov .xp::before{content:'';position:absolute;top:8px;left:50%;transform:translateX(-50%);width:44px;height:5px;border-radius:3px;background:var(--bd,#0004)}
  #modov .mh,#xov .xh{padding-top:6px}
  #help button,#modov button,#xov button{min-height:44px}
  #modov .mt input[type=search],#modov select,#xov input[type=range]{min-height:44px;font-size:16px}
  #xov .xr button,#modov .mact button{min-height:44px}
  #xov .xcam button{min-height:48px}
}
@media (orientation:landscape) and (max-height:520px){
  #ui{left:auto!important;right:0;top:var(--topH,56px);bottom:0;height:auto!important;max-height:none!important;width:min(42vw,380px);border-top:0;border-left:1px solid var(--bd,#0002);padding-bottom:env(safe-area-inset-bottom,0px)}
  #ui.col{top:auto;width:min(42vw,380px)}
  #ui #tabs{flex-wrap:wrap}
  #help,#modov,#xov{align-items:center!important;padding:12px!important}
  #help .hc,#modov .mp,#xov .xp{width:min(560px,92vw)!important;max-width:560px!important;max-height:92vh!important;border-radius:14px!important;padding-top:14px!important}
  #help .hc::before,#modov .mp::before,#xov .xp::before{display:none}
  #top{padding-top:4px;padding-bottom:4px}
  #menu{left:auto;right:8px;width:min(420px,92vw)}
}
`;

  function injectCss() {
    const st = D.createElement('style');
    st.textContent = CSS;
    D.head.append(st);
  }

  function caption(b) {
    return TOOL_LABEL[b.id] || b.title || b.getAttribute('aria-label') || (b.textContent || '').trim() || b.id;
  }

  // Gom các nút công cụ vào menu Cài đặt của app, dưới nhóm "Công cụ". Chỉ làm một lần.
  function groupTools() {
    const menu = D.getElementById('menu');
    if (!menu || G.__vncToolsGrouped) return;
    const tools = TOOLS.map(id => D.getElementById(id)).filter(Boolean);
    if (!tools.length) return;
    const h = D.createElement('h4');
    h.id = 'mtools';
    h.textContent = 'Công cụ';
    const g = D.createElement('div');
    g.className = 'g';
    tools.forEach(b => {
      if (!b.querySelector('em')) {
        const e = D.createElement('em');
        e.style.fontStyle = 'normal';
        e.textContent = caption(b);
        b.append(e);
      }
      g.append(b);
    });
    menu.append(h, g);
    G.__vncToolsGrouped = true;
  }

  const mq = G.matchMedia ? G.matchMedia('(max-width:700px), (orientation:landscape) and (max-height:520px)') : { matches: false };

  // Đo chiều cao thanh trên để cột bên phải (chế độ ngang) nằm ngay dưới thanh
  function syncTopH() {
    const t = D.getElementById('top');
    const root = D.documentElement;
    if (t && root && root.style && root.style.setProperty) root.style.setProperty('--topH', (t.offsetHeight || 0) + 'px');
  }

  function start() {
    if (mq.matches) { injectCss(); groupTools(); }
    syncTopH();
    if (G.addEventListener) {
      G.addEventListener('resize', syncTopH);
      G.addEventListener('orientationchange', () => setTimeout(syncTopH, 250));
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start);
  else start();
})();
