# Định dạng mod .vnmod

Mod là file zip đổi đuôi thành `.vnmod`. Mod chỉ chứa **dữ liệu khai báo**, không chứa mã chạy.
App không thực thi JavaScript từ mod.

## Cấu trúc
```
manifest.json      (bắt buộc, ở thư mục gốc)
theme.json         (nếu có quyền "theme")
README.md          (tuỳ chọn)
```

## manifest.json
```json
{
  "format": "vnmod",
  "format_version": 1,
  "id": "tacgia.ten-mod",
  "name": "Tên hiển thị",
  "version": "1.0.0",
  "author": "Tên tác giả",
  "description": "Mô tả ngắn",
  "api": 1,
  "permissions": ["theme"],
  "provides": { "theme": "theme.json", "readme": "README.md" }
}
```
- `id`: chữ thường, số, `.` `_` `-`, 3–64 ký tự. Phải duy nhất.
- `version`: dạng `x.y.z`.
- `api`: phiên bản API app cần. App hiện hỗ trợ API 1. Mod có `api` cao hơn sẽ được lưu nhưng bị tắt.
- `permissions`: `theme` (đổi màu giao diện), `pose` (thêm tư thế), `camera` (thêm góc nhìn), và `light` (đổi độ sáng).
- `tags` (tuỳ chọn): tối đa 5 nhóm, mỗi nhóm 1–20 ký tự chữ, số, khoảng trắng, `_` hoặc `-`. App chuẩn hoá về chữ thường, dùng để lọc trong Quản lý Mod. Ví dụ: `"tags": ["giao diện", "màu sắc"]`.

## theme.json (quyền `theme`)
```json
{ "vars": { "--ac": "#0e7490", "--bg": "#0b1d24" } }
```
Biến được phép: `--ac`, `--ac2`, `--bg`, `--fg`, `--pn`, `--bd`. Giá trị phải là mã màu hex (`#rgb`, `#rrggbb`, `#rrggbbaa`).

## pose.json (quyền `pose`)
```json
{ "poses": { "Giơ 2 tay": { "左腕": [0, 0, 120], "右腕": [0, 0, -120] } } }
```
- Tối đa 10 tư thế, mỗi tư thế tối đa 40 xương.
- Tên xương là tên xương có sẵn trong model (ví dụ `左腕`, `頭`). Xương không có trong model sẽ bị bỏ qua và app báo số xương bị bỏ.
- Góc là 3 số, đơn vị độ, trong khoảng -180 đến 180.
- Tư thế xuất hiện trong tab **Tư thế**, mục "Tư thế từ mod". Chỉ hiện khi mod đang bật.
- Mod không chạy mã: app chỉ đặt góc xương đã kiểm tra vào model đang mở.

## camera.json (quyền `camera`)
```json
{ "views": { "Chính diện": { "th": 0, "ph": 1.5, "ds": 60, "tg": [0, 10, 0] } } }
```
- Tối đa 10 góc nhìn. `th`, `ph`, `rl` là radian (`th` và `rl` trong -3.2..3.2, `ph` trong 0.05..3.1), `ds` là khoảng cách trong 1..1000, `tg` là điểm nhìn 3 số trong -1000..1000.
- Góc nhìn xuất hiện trong tab **Tư thế**, mục "Góc nhìn từ mod". Camera tự chuyển mượt tới góc đã chọn.
- Mod không chạy mã: app chỉ đặt các giá trị camera đã kiểm tra.

## light.json (quyền `light`)
```json
{ "light": { "level": 0.9 } }
```
- `level` là độ sáng tổng, trong khoảng 0.2 đến 1.
- Chỉ được có thuộc tính `level`. Không đổi màu, không thêm hay bỏ nguồn sáng.
- Khi mod đang bật, độ sáng của app hiện "(mod)". Tắt mod thì trở về mức sáng đã chọn trong app.
- Mức sáng do mod đặt không được lưu lại. Khi bấm nút Sáng trên thanh công cụ, app dùng mức đó.

## Giới hạn
- Tối đa 40 file, mỗi file 512 KB, tổng sau giải nén 2 MB, file .vnmod 3 MB.
- Loại file được phép: `.json .md .txt .png .jpg .jpeg .webp .gif`. Không có `.js`, `.html`, `.wasm`, `.svg`.
- Không dùng đường dẫn có `..`, đường dẫn tuyệt đối, hoặc dấu `\`.

## Xem trước và cập nhật
- Khi nhập, app hiện thông tin mod và quyền mod xin (đổi màu, thêm tư thế, thêm góc nhìn) trước khi cài. Chưa xác nhận thì không lưu gì.
- Nếu đã có mod cùng ID: app ghi rõ là nâng cấp, cùng phiên bản, hay hạ cấp (bản cũ hơn). Khi nâng cấp, thứ tự ưu tiên và trạng thái bật/tắt được giữ nguyên.

## Tạo mod từ cảnh đang xem
Trong Quản lý Mod (🧩), bấm **＋ Tạo mod từ cảnh**. App lấy màu giao diện, tư thế đang chỉnh và góc nhìn hiện tại, rồi tạo file `.vnmod` dữ liệu thuần. Bạn xem trước và xác nhận trước khi cài. Mod tạo ra đi qua đúng bộ kiểm tra khi nhập.

Mod không chứa mã JavaScript. App không tạo hay chạy script từ mod, vì mã từ bên ngoài có thể đọc hoặc xoá dữ liệu trên máy.

## Xung đột
- Trùng `id`: nhập lại sẽ được hỏi có thay thế không.
- Hai mod cùng đặt một biến màu và đều đang bật: mod đứng sau trong thứ tự ưu tiên sẽ thắng. Thứ tự đặt bằng nút ▲ ▼ trên thẻ mod. Thẻ mod cho biết đang áp hay bị ghi đè.
- Mod có dữ liệu hỏng: tự tắt và ghi lý do, các mod khác vẫn chạy.

## Kiểm thử (trong thư mục dự án)
```
node tests/mod-core.test.js
JSZIP_PATH=<đường dẫn jszip> node tests/mod-store.test.js
```
