// Chạy: node tests/mobile.smoke.js — kiểm tra nút công cụ được gom vào menu Cài đặt của app trên màn hình hẹp.
const assert = require('assert');
function El(tag, id) {
  const e = {
    tagName: tag.toUpperCase(), id: id || '', children: [], className: '', title: '', textContent: '', attrs: {},
    style: {}, onclick: null, parent: null,
    append(...xs) { xs.forEach(x => { if (x.parent) x.parent.children = x.parent.children.filter(c => c !== x); x.parent = this; this.children.push(x); }); },
    getAttribute(k) { return this.attrs[k] || null }, setAttribute(k, v) { this.attrs[k] = v },
    addEventListener() {}, querySelector(sel) { return sel === 'em' ? this.children.find(c => c.tagName === 'EM') || null : null },
    classList: { add() {}, remove() {}, contains() { return false }, toggle() {} }
  };
  return e;
}
const body = El('body'), head = El('head');
const top = El('div', 'top');
const menu = El('div', 'menu');
const byId = {};
function mk(id, title, parent) {
  const b = El('button', id); b.title = title || id; b.textContent = title || id;
  (parent || top).append(b); byId[id] = b; return b;
}
['bload', 'badd', 'bshot', 'bmenu'].forEach(id => mk(id));
['bextra', 'bmod', 'bhelp'].forEach(id => mk(id));
body.append(top); body.append(menu);

globalThis.matchMedia = () => ({ matches: true });
globalThis.document = {
  readyState: 'complete', head, body,
  getElementById: id => id === 'top' ? top : id === 'menu' ? menu : (byId[id] || null),
  createElement: t => El(t),
  addEventListener() {}
};
require('../mobile.js');

// Ba nút công cụ phải nằm trong menu Cài đặt
for (const id of ['bextra', 'bmod', 'bhelp']) {
  assert.ok(menu.children.some(g => g.children.includes(byId[id])) || JSON.stringify(menu).includes(id), id + ' phải nằm trong menu');
  assert.ok(!top.children.includes(byId[id]), id + ' không còn trên thanh trên');
}
// Nút Cài đặt của app vẫn trên thanh
assert.ok(top.children.includes(byId.bmenu), 'bmenu phải còn trên thanh để mở lại menu');
// Không tạo menu thứ hai
assert.ok(!top.children.some(c => c.id === 'mmenu' || c.id === 'bmore'), 'không được tạo bảng ⋯ riêng');
// Chạy lần nữa không nhân đôi nhóm
const before = menu.children.length;
delete require.cache[require.resolve('../mobile.js')];
require('../mobile.js');
assert.strictEqual(menu.children.length, before, 'không được nhân đôi nhóm Công cụ');
console.log('ok   trên màn hình hẹp: 3 nút công cụ vào menu Cài đặt, bmenu giữ trên thanh, không tạo menu thứ hai');
