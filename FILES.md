# Bản đồ file dự án

## Trang và logic chính
| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ app: giao diện, PMX/VMD, IK, physics, thư viện, hoàn tác. Hầu hết logic ở đây. |
| `sw.js` | Service worker: cache offline. Danh sách `SHELL` phải có mọi file cục bộ. Đổi `V` khi sửa file. |
| `manifest.webmanifest` | Thông tin cài app (tên, icon, màu). |
| `icon-*.png`, `loading.webp` | Icon và ảnh chờ. |

## Script phụ (load theo thứ tự này)
| File | Vai trò |
|---|---|
| `mods/mod-core.js` | Kiểm tra mod (manifest, đường dẫn, kích thước, màu, tư thế, camera). Không đụng DOM. |
| `mods/mod-store.js` | Lưu mod trong IndexedDB, nhập/xuất, sao lưu, áp dụng theme/tư thế/camera, thứ tự ưu tiên. |
| `mods/mod-ui.js` | Màn hình Quản lý Mod (🧩), xem trước, mục tư thế/camera từ mod. |
| `extras.js` | Bảng ⓘ: thông tin cảnh, FOV, chế độ thao tác, camera, Rigid, chia sẻ, tải .vpd. |
| `mobile.js` | Trên màn hình hẹp hoặc ngang: gom ba nút công cụ (ⓘ, 🧩, ?) vào menu Cài đặt có sẵn (`#menu`), chỉnh bố cục điện thoại và chế độ ngang. Không tạo menu thứ hai. Chạy cuối cùng. |

## Mod mẫu và tài liệu
| File | Vai trò |
|---|---|
| `mods/sample-*.vnmod` | Mod mẫu: đổi màu, tư thế, góc nhìn. |
| `mods/README-VNMOD.md` | Định dạng `.vnmod` cho người tạo mod. |
| `README.md` | Hướng dẫn đưa lên GitHub Pages và tổng quan tính năng. |

## Kiểm thử và công cụ (không cần cho người dùng cuối)
| File | Vai trò |
|---|---|
| `tests/run-all.js` | Chạy toàn bộ bộ kiểm thử một lệnh: `node tests/run-all.js`. |
| `tests/wiring.test.js` | Kiểm tra file tham chiếu có tồn tại, có trong cache offline, đúng thứ tự. |
| `tests/mod-*.test.js`, `tests/mod-ui.smoke.js`, `tests/mobile.smoke.js`, `tests/extras.test.js` | Bộ kiểm thử từng phần. |
| `tests/ANDROID-CHECKLIST.md` | Checklist thử tay trên Android. |
| `tools/bump-version.js` | Tăng phiên bản cache: `node tools/bump-version.js`. |

## Quy trình sửa một lần
1. Sửa file.
2. `node tests/run-all.js` (cần JSZip; xem `JSZIP_PATH`).
3. `node tools/bump-version.js`.
4. Đóng gói và đưa lên GitHub (giữ nguyên cấu trúc thư mục).
