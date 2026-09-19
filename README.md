# ECont Logistics

Frontend demo cho nền tảng điều phối và tái sử dụng container rỗng. Ứng dụng được xây dựng bằng React, TypeScript, Vite và Tailwind CSS.

## Kết nối API

API quét ảnh/eDO chạy cùng web khi dùng `npm run dev` hoặc `npm run preview`; không cần mở thêm gateway ở cổng 8000. Khóa được đọc phía server từ `apps/api/.env` (Git bỏ qua file này):

```powershell
# Từ thư mục gốc dự án, chỉ sao chép nếu chưa có .env:
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
# Điền khóa Gemini API vào ECONT_AI_API_KEY trong apps/api/.env
cd apps/web
npm.cmd run dev
```

Để `VITE_API_BASE_URL` trống khi chạy local. Nếu đã đặt biến này thành `http://localhost:8000`, hãy xóa giá trị và khởi động lại Vite. Gateway đọc lại `.env` mỗi request nên chỉ cập nhật key là có thể quét lại.

Khi deploy bản build tĩnh, chạy `npm start` trong `apps/api` và cấu hình reverse proxy `/api` hoặc đặt `VITE_API_BASE_URL` tới URL backend trước khi build. Nếu khác origin, cấu hình `AI_ALLOWED_ORIGIN` trùng origin của web. Vite middleware chỉ dành cho dev/preview, không được đóng gói vào frontend production.

`GET /api/health` kiểm tra gateway: `AI_KEY_MISSING` nghĩa chưa có khóa, `AI_CONFIGURED` chỉ xác nhận đã có cấu hình (chưa chứng minh khóa được provider chấp nhận). Gateway phân biệt các lỗi `AI_KEY_REJECTED`, `AI_MODEL_UNAVAILABLE`, `AI_RATE_LIMITED`, `AI_TIMEOUT` và không trả khóa/nội dung chứng từ trong thông báo lỗi.

Model mặc định là `gemini-2.5-flash`, có thể thay bằng `ECONT_AI_MODEL`. Đã bỏ mặc định `gemini-2.0-flash` theo [lịch ngừng cung cấp của Google](https://ai.google.dev/gemini-api/docs/deprecations). Frontend chờ tối đa 120 giây cho API AI; provider có 90 giây xử lý.

Gateway local giữ khóa AI ở server và cung cấp các endpoint AI:

- `POST /api/ai/edo/verify`
- `POST /api/ai/edo/scan` (tùy chọn, chỉ dùng nếu cần đọc metadata eDO)
- `POST /api/ai/container/inspect`
- `POST /api/ai/container/verify`

Các endpoint `/api/auth/*` vẫn cần backend tài khoản/OTP của môi trường triển khai.

Nếu gateway chưa có khóa hoặc provider tạm thời lỗi, file/ảnh vẫn được lưu trong luồng nghiệp vụ và chuyển sang Ops kiểm tra thủ công; frontend không tự đánh dấu hợp lệ.

Luồng Offer chỉ bắt buộc upload đúng một file eDO/Booking (ảnh hoặc PDF). Mã eDO và Depot không phải trường bắt buộc; AI xác minh trực tiếp nội dung file qua `/api/ai/edo/verify`. Nếu backend chưa cấu hình hoặc không phản hồi, hồ sơ phải chuyển Ops kiểm tra thủ công, không tự đánh dấu hợp lệ.

AI eDO cần trả `isLegal`, `hasAnomaly`, `summary`, `details` và `requiresOpsReview`. AI ảnh container cần trả `matchesRegistration`, `actualCondition`, `actualConditionNotes`, `mismatchDetails`, `score` và `requiresOpsReview`. Offer chỉ chuyển `AVAILABLE` sau khi Ops nhập kết luận và duyệt.

## Yêu cầu

- Node.js 22 (khuyến nghị) hoặc Node.js 18/20
- npm

## Chạy dự án

```bash
git clone https://github.com/vansec0812/testLogistic.git
cd testLogistic/apps/web
npm ci
npm run dev
```

Mở <http://localhost:5173> trên trình duyệt.

Nếu PowerShell trên Windows chặn `npm.ps1`, dùng:

```powershell
npm.cmd ci
npm.cmd run dev
```

## Build production

```bash
cd apps/web
npm ci
npm run build
npm run preview
```

Thư mục build được tạo tại `apps/web/dist`.

## Dữ liệu

Frontend có sẵn dữ liệu demo và lưu trạng thái trong `localStorage`, vì vậy có thể chạy ngay mà không cần backend. Chức năng đồng bộ Supabase chỉ hoạt động sau khi cấu hình URL và anon key hợp lệ trong trang quản trị cơ sở dữ liệu online.

## Cấu trúc chính

```text
apps/web/                     React frontend
apps/api/                     Local ECont API gateway cho AI
supabase/migrations/          SQL schema cho Supabase
plan.md                       Kế hoạch đầy đủ theo SRS v1.0 (bản hiện hành)
agent(2).md                   Quy ước làm việc cho agent
```
