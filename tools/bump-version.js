// Tăng phiên bản cache trong sw.js: node tools/bump-version.js
// Chạy mỗi lần sửa bất kỳ file nào để máy người dùng lấy bản mới.
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '..', 'sw.js');
const src = fs.readFileSync(f, 'utf8');
const m = src.match(/const V = 'vnc-v(\d+)';/);
if (!m) { console.error('Không tìm thấy "const V = \'vnc-vN\'" trong sw.js'); process.exit(1); }
const next = Number(m[1]) + 1;
fs.writeFileSync(f, src.replace(m[0], "const V = 'vnc-v" + next + "';"));
console.log('Phiên bản cache: vnc-v' + m[1] + ' -> vnc-v' + next);
