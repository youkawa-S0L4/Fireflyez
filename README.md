# 雲月閣 · Vân Nguyệt Các

Trình xem model PMX và chuyển động VMD chạy ngay trên trình duyệt (cài được như app).

## Đưa lên GitHub Pages
1. Tạo repo, tải **tất cả** file trong thư mục này lên, giữ nguyên cấu trúc thư mục:
   `index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `loading.webp`, và thư mục `mods/` (gồm `mod-core.js`, `mod-store.js`, `mod-ui.js`, `README-VNMOD.md`, `sample-ocean.vnmod`).
   Thư mục `tests/` không cần để trên web, nhưng có thể giữ để kiểm thử.
2. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. Mở `https://<tên>.github.io/<repo>/`.

## Cài như app
- Android/Chrome: menu ⚙️ → **Cài app** (hoặc menu trình duyệt → Cài đặt ứng dụng).
- iPhone/Safari: nút Chia sẻ → **Thêm vào Màn hình chính**.

## Offline
Lần đầu phải mở khi có mạng để trình duyệt lưu thư viện. Sau đó mở lại không cần mạng.
Thư viện vật lý Rigid body (Ammo.js, MMDPhysics) được tải sẵn ngay lần đầu mở app, nên dùng offline không cần bật "Rigid" trước. Dịch tên mục luôn cần mạng.

## Cập nhật bản mới
Sau khi sửa bất kỳ file nào, tăng số trong `const V = 'vnc-vNN'` ở `sw.js` (ví dụ `vnc-v15`) để máy người dùng lấy bản mới. Khi có bản mới, app báo "Đã có bản mới... Tải lại trang" thay vì tự tải lại (để không mất model đang mở).

## Lưu ý
Model chứa nội dung 18+ cần người dùng tự mở từ máy của họ; app có cổng xác nhận 18+.

## Quản lý Mod và đọc gói nén
- Bấm nút 🧩 trên thanh công cụ để mở Quản lý Mod.
- Có thể đọc danh sách tệp trong `.zip`, `.rar` (RAR5) và `.7z`; lần đầu đọc RAR/7Z cần mạng để tải 7z-wasm.
- Chọn **Đọc gói ZIP / RAR5 / 7Z** để xem cấu trúc, dung lượng, đường dẫn đáng ngờ và các tài nguyên model/texture/chuyển động.
- Chọn **Nhập gói mod** để thử cài gói có `manifest.json` đúng chuẩn VNMOD; gói mod game/MMD thông thường không tự biến thành VNMOD.
- Gói MMD có PMX/PMD/VMD có thể thử mở bằng nút **Mở file** ở thanh công cụ.
- Bật/tắt từng mod, tìm kiếm, lọc, xuất, xoá, sao lưu và khôi phục.
- Định dạng và cách tạo mod: xem `mods/README-VNMOD.md`.
- Mod không chứa mã chạy. Quyền hiện có: `theme` (đổi màu giao diện), `pose` (thêm tư thế), `camera` (thêm góc nhìn) và `light` (đổi độ sáng).

## Kiểm thử
```
node tests/mod-core.test.js
JSZIP_PATH=<đường dẫn thư mục jszip> node tests/mod-store.test.js
JSZIP_PATH=<đường dẫn thư mục jszip> node tests/mod-ui.smoke.js
```

## Thông tin & công cụ (nút ⓘ)
- Thông tin cảnh: tên model, số đỉnh, mặt, vật liệu, xương, morph, texture, số key chuyển động.
- Chế độ thao tác: Camera (kéo để xoay góc nhìn), Xoay xương, hoặc IK.
- Hiệu năng: bật/tắt số FPS ở góc trên bên trái (lưu lại cho lần mở sau).
- Vật lý: xem trạng thái Rigid và bật/tắt. Trọng lực và độ cứng chưa chỉnh được (cần kiểm tra thư viện vật lý trước).
- Camera chuyển động: chọn camera có trong gói của model đang mở, hoặc tắt camera.
- Góc nhìn (FOV): chỉnh độ rộng camera.
- Chia sẻ ảnh: chụp rồi mở bảng chia sẻ của Android (hoặc tải về nếu không hỗ trợ).
- Tải tư thế `.vpd`: đặt góc xoay của các xương trùng tên trong model.

## Mod từ cảnh
- Quản lý Mod → Tạo mod từ cảnh: lưu màu, tư thế và góc nhìn hiện tại thành mod dữ liệu, xem trước rồi cài.

## Màn hình chào
- Khi chưa có model, hiện thẻ chào với các nút Mở file, Quản lý Mod, Hướng dẫn. Có số gói trong thư viện nếu có. Tự ẩn khi đã nạp model.

## Cảnh báo 18+
- Không còn cổng chặn khi mở app. App mở ở chế độ an toàn.
- Khi nạp model có mục khớp bộ lọc nội dung, app hiện cảnh báo cho model đó. Muốn xem mục ẩn, phải tick xác nhận đủ 18 tuổi rồi bấm Hiện nội dung 18+. Bấm Giữ ẩn thì mục vẫn ẩn.
- Nút 18+ trên thanh công cụ vẫn bật/tắt được.

## Tiến độ nạp và đặt lại
- Khi nạp model, thanh tiến độ hiện phần trăm thật: giải nén zip (số file), đọc PMX (phần trăm giải nén), và tải texture (số texture).
- Nút "Reset toàn bộ về lúc mở file" (trong ⓘ, mục Đặt lại) đưa morph, tư thế, IK, ẩn/hiện vật liệu, camera và vật lý về trạng thái lúc mở file. Cài đặt chung không đổi.


## Bộ đọc 3DMigoto (v42+)
- Bấm **3DM** → tab **Mod** nạp package body/bikini, tab **Gốc** nạp dump full (có Face/Head).
- Tool tự ghép: **Face từ Gốc**, **Body từ Mod**, Hair ưu tiên Mod.
- **Áp vào PMX đang mở**: body 3DM đè lên model PMX gốc (ẩn body cũ). Face + xương + VMD vẫn chạy từ PMX.
- Hỗ trợ HSR Position/Blend/Texcoord.buf và classic VB/FMT; DDS DXT1/DXT5.
- Xuất GLB được. Body overlay chưa skin theo xương (bản tiếp theo sẽ cải thiện).

