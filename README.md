# ECont Logistics

Frontend demo cho nền tảng điều phối và tái sử dụng container rỗng. Ứng dụng được xây dựng bằng React, TypeScript, Vite và Tailwind CSS.

## Kết nối API

Sao chép `apps/web/.env.example` thành `.env` và đặt `VITE_API_BASE_URL` để bật các API OTP, đăng ký tài khoản, OCR eDO và kiểm tra ảnh container:

- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `POST /api/auth/register`
- `POST /api/ai/edo/scan`
- `POST /api/ai/container/inspect`

Nếu chưa cấu hình backend, app vẫn chạy dữ liệu demo cục bộ; file thật không được tự sinh kết quả khi OCR thất bại.

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
supabase/migrations/          SQL schema cho Supabase
plan.md                       Kế hoạch đầy đủ theo SRS v1.0 (bản hiện hành)
agent(2).md                   Quy ước làm việc cho agent
```
