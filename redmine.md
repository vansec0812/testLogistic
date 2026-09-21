# ECont Logistics — Tài liệu hướng dẫn sử dụng website

- **Phiên bản tài liệu:** 1.0
- **Ngày cập nhật:** 21/09/2026
**Phạm vi:** bản demo ECont Logistics hiện tại

## 1. Mục đích

ECont là nền tảng demo điều phối và tái sử dụng container rỗng giữa:

- Nhà cung cấp container.
- Đơn vị cần vỏ container.
- Bộ phận vận hành ECont (Ops).

Tài liệu này hướng dẫn cách đăng nhập, tạo Offer/Booking, ghép cặp, xử lý giao dịch, kiểm duyệt hồ sơ, dùng AI, quản lý hồ sơ cá nhân và khôi phục dữ liệu mẫu.

## 2. Phạm vi và giới hạn của bản demo

| Nội dung | Trạng thái trong bản demo |
|---|---|
| Dữ liệu Offer, Booking, giao dịch, Case, chat | Lưu trong `localStorage` của trình duyệt hiện tại |
| Nhiều người dùng trên nhiều máy | Chưa phải realtime production; mỗi trình duyệt có bộ dữ liệu riêng |
| OTP SMS/Gmail | Đang mô phỏng; mã OTP được hiển thị ngay trên giao diện demo |
| Đăng nhập/mật khẩu | Tài khoản demo và thay đổi mật khẩu được lưu local; production cần backend xác thực thật |
| AI eDO, ảnh container, file Booking | Gọi gateway server-side nếu đã cấu hình API key; lỗi AI sẽ chuyển sang Ops kiểm tra thủ công |
| Supabase | Tùy chọn, chỉ dùng khi cấu hình URL và anon key hợp lệ |
| Reset Seed | Chỉ reset dữ liệu nghiệp vụ trên trình duyệt đang thao tác; không reset Git, Vercel hay dữ liệu trên trình duyệt khác |

## 3. Truy cập website

### 3.1. Chạy local

Từ thư mục gốc dự án:

```powershell
if (!(Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
cd apps/web
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:5173`.

Nếu `VITE_API_BASE_URL` đang đặt thành `http://localhost:8000`, hãy xóa giá trị đó khi dùng gateway tích hợp với Vite, sau đó khởi động lại Vite.

### 3.2. Đăng nhập nhanh bằng tài khoản mẫu

| Tài khoản | Mật khẩu | Vai trò | Doanh nghiệp |
|---|---|---|---|
| `bena` | `bena123` | Nhà cung cấp Container | Hưng Thịnh Logistics |
| `benb` | `benb123` | Cần vỏ Container | Toàn Cầu Export Corp |
| `ops` | `ops123` | Ops | ECont Ops |
| `cangmiennam` | `cangmiennam123` | Nhà cung cấp Container | Cảng Miền Nam Logistics |
| `phuquocxanh` | `phuquocxanh123` | Cần vỏ Container, chờ xác minh | Phú Quốc Green Trade |

Tài khoản `phuquocxanh` dùng để kiểm tra trường hợp doanh nghiệp chưa được Ops xác minh. Doanh nghiệp chưa xác minh không được tạo Offer/Booking mới.

## 4. Các vai trò và quyền sử dụng

Website có ba nhóm vai trò nghiệp vụ. Vai trò “cả hai” là một lựa chọn tham gia dành cho doanh nghiệp, không phải một vai trò quản trị mới.

| Vai trò hiển thị | Quyền chính |
|---|---|
| Nhà cung cấp Container | Tạo/sửa/gửi Offer nguồn vỏ; theo dõi duyệt; xác nhận giao; tham gia giao dịch và chat |
| Cần vỏ Container | Tạo/sửa/gửi Booking/Nhu cầu tìm vỏ; xem Offer phù hợp; chọn ứng viên/giữ chỗ; xác nhận nhận cont và chat |
| Cả Nhà cung cấp và Cần vỏ Container | Có đầy đủ quyền của hai nhóm doanh nghiệp trên sau khi công ty được xác minh |
| Ops | Kiểm tra doanh nghiệp, duyệt Offer/Booking, xử lý RU, xác nhận thanh toán, xem hồ sơ/ảnh và xử lý Case |

Thông tin nhận diện đối tác được ẩn ở giai đoạn tìm kiếm/matching đối với doanh nghiệp. Ops được xem tên chính xác của cả bên cung cấp và bên cần vỏ để kiểm duyệt và xử lý nghiệp vụ.

## 5. Đăng ký tài khoản

1. Tại màn hình đăng nhập, chọn **Đăng ký**.
2. Nhập thông tin cá nhân:
   - Họ và tên.
   - Số điện thoại.
   - Email.
   - Tên đăng nhập và mật khẩu.
3. Chọn **Vai trò tham gia ECont**: Nhà cung cấp, Cần vỏ Container hoặc cả hai.
4. Nhập thông tin công ty:
   - Tên công ty.
   - Mã số thuế.
   - Địa chỉ.
   - Số điện thoại công ty.
   - Email công ty.
5. Gửi OTP cho số điện thoại và nhập mã xác nhận.
6. Gửi đăng ký. Công ty chuyển sang trạng thái chờ Ops xác minh.

Các trường bắt buộc được đánh dấu `*`. Khi submit có lỗi, hệ thống đưa màn hình tới trường lỗi và highlight trường cần sửa.

> Trong bản demo, mã OTP được hiển thị bằng thông báo trên giao diện. Khi triển khai thật, cần kết nối dịch vụ SMS/email và backend xác thực.

## 6. Hướng dẫn Nhà cung cấp tạo Offer

### 6.1. Mở chức năng

Đăng nhập bằng tài khoản Nhà cung cấp, chọn **Offer nguồn vỏ của tôi** ở thanh bên, sau đó chọn **Đăng ký Offer**.

Role “Cả hai” cũng nhìn thấy và sử dụng được chức năng này.

### 6.2. Thông tin bắt buộc của một Offer

Mỗi Offer tương ứng với **một container và một hồ sơ eDO**.

| Trường | Hướng dẫn |
|---|---|
| Số container | Nhập đúng mã ISO 6346; thông tin này không public cho bên cần vỏ ở màn hình matching |
| Loại container | Chọn `20GP` hoặc `40HC` |
| Hãng tàu | Chọn/nhập hãng tàu |
| Hồ sơ eDO | Upload đúng một ảnh hoặc một file PDF; đây là phần Ops kiểm tra, không public cho bên cần vỏ |
| Vị trí container | Nhập vị trí bàn giao |
| Sẵn sàng bàn giao từ/đến | Chọn ngày bằng lịch; hiển thị theo `dd/mm/yyyy` |
| Tình trạng container | Chọn tình trạng khai báo |
| Mô tả chi tiết | Mô tả các vết xước, móp, rỉ sét, sàn, cửa, khóa và vấn đề thực tế khác |
| Ảnh container | Tối thiểu 6 ảnh, tải theo đúng thứ tự bắt buộc |

Không còn trường **Chi phí đưa về depot dự kiến** trong form Offer. eDO được gọi đúng tên **Hồ sơ eDO / Tệp eDO**, không phải Booking.

### 6.3. Upload ảnh container theo thứ tự

Không được bỏ qua bước. Hệ thống yêu cầu hoàn tất lần lượt:

1. Mặt trước.
2. Mặt sau/cửa.
3. Mặt trái.
4. Mặt phải.
5. Mặt trên/nóc.
6. Mặt dưới/gầm.

Sau khi đủ 6 ảnh, người dùng mới được chuyển sang các trường tiếp theo. Có thể upload thêm ảnh nếu cần. Khi sửa Offer, có thể xóa ảnh cũ, thêm ảnh mới hoặc thay ảnh; nếu sửa thông tin trọng yếu, Offer có thể quay lại trạng thái chờ Ops kiểm tra.

### 6.4. AI và duyệt Offer

Sau khi upload file/ảnh, hệ thống có thể gọi AI để:

- Kiểm tra eDO có hợp lệ hay có dấu hiệu bất thường.
- Đối chiếu ảnh container với thông tin đã đăng ký.
- Mô tả tình trạng thực tế bằng tiếng Việt: mới/cũ, xước, móp, rỉ sét, ảnh mờ, mã container khó đọc hoặc sai lệch.
- Điền kết quả phù hợp vào phần mô tả tình trạng khi có kết quả.

Quy tắc kết quả:

- Nếu AI pass toàn bộ điều kiện, Offer có thể được tự động duyệt.
- Nếu AI phát hiện sai lệch, ảnh không rõ, eDO bất thường hoặc không nhận được kết quả, Offer chuyển Ops kiểm tra.
- Ops xem được tất cả ảnh nhà cung cấp đã tải lên, kết quả AI và lý do cần kiểm tra.
- Offer chỉ được hiển thị cho bên cần vỏ sau khi ở trạng thái được duyệt/`AVAILABLE`.

### 6.5. Trạng thái Offer thường gặp

| Trạng thái | Ý nghĩa |
|---|---|
| Nháp | Chưa gửi kiểm tra |
| Chờ duyệt | Đã gửi, Ops đang kiểm tra |
| Cần bổ sung | Ops yêu cầu sửa/thêm thông tin |
| Đã duyệt | Có thể được matching |
| Đang giữ chỗ/đã phân bổ | Đang tham gia giao dịch |
| Đã hoàn tất | Giao nhận xong, quyền quản lý đã chuyển sang bên cần vỏ |
| Đã rút | Nhà cung cấp chủ động rút Offer |

## 7. Hướng dẫn bên Cần vỏ tạo Booking/Nhu cầu

### 7.1. Mở chức năng

Đăng nhập bằng tài khoản bên Cần vỏ, chọn **Nhu cầu tìm vỏ cont**, sau đó chọn **Đăng nhu cầu mới**.

Role “Cả hai” cũng tạo được Booking.

### 7.2. Thông tin Booking/Nhu cầu

| Trường | Hướng dẫn |
|---|---|
| Số Booking | Nhập mã booking |
| Hãng tàu | Chọn/nhập hãng tàu |
| Loại container | Chọn `20GP` hoặc `40HC` |
| Vị trí lấy và giao | Nhập địa điểm phục vụ matching |
| Lấy cont sớm nhất/muộn nhất | Chọn ngày bằng lịch, hiển thị `dd/mm/yyyy` |
| Thời hạn Cut-off booking | Chọn ngày bằng lịch, hiển thị `dd/mm/yyyy` |
| Tệp Booking | Upload ảnh hoặc PDF; AI được gọi tự động sau khi tải lên |
| Yêu cầu/tình trạng mong muốn | Mô tả thông tin cần thiết cho việc ghép cặp |

Form không còn trường **Chi phí đưa về depot dự kiến**. Các giá trị gợi ý được hiển thị dưới dạng placeholder, không phải dữ liệu đã nhập.

### 7.3. Matching và giữ chỗ

Sau khi Booking được xác minh:

1. Hệ thống tìm Offer phù hợp theo hãng tàu, loại cont, khoảng cách, thời gian và điều kiện.
2. Màn hình hiển thị các ứng viên cùng các chỉ số matching như khoảng cách, thời gian sẵn sàng, tình trạng khai báo, điểm matching, điểm tin cậy và mức tiết kiệm ước tính.
3. Thông tin định danh nhà cung cấp không hiển thị ở giai đoạn public.
4. Chọn **Chọn vỏ này, giữ chỗ** để gửi đề xuất matching.
5. Có thể bấm bong bóng chat cạnh từng ứng viên để trao đổi; nút chat ở đây là chat với đối tác và cuộc hội thoại được quản lý tại **Tin nhắn trao đổi**.
6. Khi hai bên chấp nhận, hệ thống tạo/tiếp tục giao dịch.

Các Booking và Offer được sắp xếp từ mới đến cũ theo `CreateAt`. Ứng viên hoặc đề xuất bị từ chối không làm mất Offer gốc nếu Offer vẫn còn khả dụng.

## 8. Hướng dẫn Ops kiểm duyệt

### 8.1. Kiểm duyệt Offer

1. Đăng nhập bằng `ops`.
2. Mở **Thẩm định Nguồn vỏ**.
3. Offer chưa duyệt được đưa lên đầu; trong cùng nhóm sắp xếp từ mới đến cũ theo `CreateAt`. Sau đó mới đến các Offer đã duyệt, cũng theo `CreateAt`.
4. Mở Offer để xem:
   - Tên chính xác nhà cung cấp.
   - Số container và thông tin đăng ký.
   - Tệp eDO gốc.
   - Toàn bộ ảnh theo 6 góc và ảnh bổ sung.
   - Kết quả xác minh eDO của AI.
   - Kết quả tình trạng thực tế do AI báo về.
   - Cảnh báo, sai lệch, lý do phải chuyển Ops.
5. Chọn một hành động:
   - **Duyệt** nếu hồ sơ hợp lệ.
   - **Yêu cầu bổ sung/chỉnh sửa** nếu thiếu hoặc cần sửa.
   - **Từ chối** nếu hồ sơ không đáp ứng.

Tiêu đề cảnh báo nên mô tả ngắn gọn vấn đề, ví dụ: “Chất lượng container cần kiểm tra”, “Mã số container không khớp”, “Ảnh container mờ” hoặc “eDO có dấu hiệu bất thường”.

### 8.2. Kiểm duyệt Booking

Mở **Thẩm định Nhu cầu cần vỏ** để xem hồ sơ Booking, tên chính xác bên cần vỏ, file Booking và kết quả AI. Booking chưa duyệt được ưu tiên ở đầu danh sách. Ops có thể duyệt, yêu cầu bổ sung hoặc từ chối.

### 8.3. Ops trong giao dịch

Ops là vai trò kiểm duyệt và điều phối duy nhất trên website; không có role Finance riêng. Ops:

- Tiếp nhận kết quả RU từ hãng tàu.
- Theo dõi trạng thái giao dịch.
- Xác nhận đã nhận đủ tiền của hai bên sau khi mỗi bên xác nhận chuyển khoản.
- Phát phiếu điều phối.
- Xử lý sai lệch và Case.
- Xem đúng tên của nhà cung cấp và bên cần vỏ trong màn hình nội bộ.

## 9. Luồng giao dịch hoàn chỉnh

Trước 7 bước chính có giai đoạn ghép lệnh: Offer được duyệt, Booking được duyệt, bên cần vỏ chọn ứng viên, nhà cung cấp chấp nhận đề xuất.

| Bước | Trạng thái | Người thực hiện | Kết quả cần đạt |
|---:|---|---|---|
| 1 | `NEGOTIATING` | Hai bên | Bên cần vỏ giữ chỗ; hai bên trao đổi và ký phần thỏa thuận tương ứng |
| 2 | `PENDING_CARRIER` | Ops | Tiếp nhận/phê duyệt cấp lại vỏ (RU Approval) từ hãng tàu |
| 3 | `AWAITING_PAYMENT` | Hai bên và Ops | Mỗi bên xem đúng mã QR, chuyển khoản và bấm xác nhận; Ops đối soát đủ tiền |
| 4 | `READY_FOR_PICKUP` | Ops | Phát phiếu điều phối, ghi nhận tài xế/xe/thời hạn |
| 5 | `INSPECTION` | Bên cần vỏ/tài xế | Kiểm tra thực tế container theo checklist và ảnh |
| 5a | `ON_HOLD`/Case | Ops | Nếu có sai lệch, giao dịch tạm dừng; Ops xử lý Case trước khi tiếp tục |
| 6 | `HANDOVER_PENDING` | Hai bên | Nhà cung cấp xác nhận đã giao; bên cần vỏ xác nhận đã nhận |
| 7 | `COMPLETED` | Hệ thống | Hoàn tất giao nhận; quyền quản lý/custody chuyển từ nhà cung cấp sang bên cần vỏ |

### 9.1. Thanh toán

Tại bước thanh toán:

1. Mở giao dịch và xem mã QR hiển thị trên màn hình.
2. Kiểm tra số tiền và nội dung chuyển khoản.
3. Thực hiện chuyển khoản.
4. Nhập mã tham chiếu nếu có.
5. Bấm **Xác nhận đã chuyển khoản**.
6. Cả hai bên phải xác nhận phần của mình.
7. Ops kiểm tra và xác nhận đã nhận đủ tiền trước khi giao dịch sang bước tiếp theo.

### 9.2. Xem lại các bước đã hoàn thành

Trên thanh 7 bước, người dùng có thể chọn các bước đã submit để xem lại thông tin. Những bước cũ chỉ ở chế độ **Chỉ xem**, không được sửa hoặc thực hiện lại hành động đã hoàn tất.

## 10. Chat và bảo mật thông tin đối tác

- Mở **Tin nhắn trao đổi** để xem các cuộc hội thoại.
- Chat có thể mở từ từng ứng viên matching bằng nút **Chat với đối tác** hoặc từ thanh bên.
- Ở giai đoạn doanh nghiệp trao đổi, giao diện chỉ hiển thị nhãn nghiệp vụ như **Nhà cung cấp Container** hoặc **Cần vỏ Container**, không hiển thị chi tiết tên đối tác.
- Ops được xem tên chính xác khi cần kiểm duyệt.
- Bản demo lưu tin nhắn trong `localStorage`; chat giữa hai máy khác nhau chưa phải realtime production.

## 11. Hồ sơ, đổi role và mật khẩu

### 11.1. Sửa hồ sơ

1. Bấm tên người dùng ở cuối thanh bên.
2. Chọn **Chỉnh sửa hồ sơ**.
3. Có thể sửa họ tên, số điện thoại, email, thông tin công ty và **Vai trò tham gia ECont**.
4. **Tên đăng nhập không được sửa**.
5. Chọn kênh nhận OTP bằng số điện thoại hoặc email đã đăng ký.
6. Gửi và xác nhận OTP.
7. Bấm lưu hồ sơ.

OTP luôn gửi tới thông tin đã đăng ký trước đó, không gửi tới giá trị mới đang chỉnh sửa. Đổi sang vai trò “Cả hai” sẽ làm xuất hiện đầy đủ menu Offer và Booking sau khi lưu thành công.

### 11.2. Đổi mật khẩu

Từ màn hình chỉnh sửa hồ sơ, chọn **Đổi mật khẩu**:

1. Nhập mật khẩu hiện tại.
2. Chọn số điện thoại hoặc email đã đăng ký để nhận OTP.
3. Xác nhận OTP.
4. Nhập mật khẩu mới và nhập lại mật khẩu.
5. Lưu thay đổi.

Mật khẩu hiện tại là bắt buộc trong luồng đổi mật khẩu đang đăng nhập.

### 11.3. Quên mật khẩu

Tại màn hình đăng nhập, chọn **Quên mật khẩu?**, nhập username/email/số điện thoại, chọn kênh OTP, xác nhận OTP rồi đặt mật khẩu mới. Đây là luồng khôi phục nên không yêu cầu mật khẩu cũ.

## 12. Sự cố và khiếu nại

Mở **Sự cố & Khiếu nại** để tạo Case hoặc theo dõi Case liên quan:

- Bên tạo Case nhìn thấy các khiếu nại do mình đăng ký.
- Ops nhìn thấy toàn bộ Case.
- Có thể upload ảnh và video làm bằng chứng.
- Khi kiểm tra container phát hiện sai lệch, giao dịch chuyển sang tạm giữ/Case.
- Ops cập nhật yêu cầu bổ sung, kết luận, giải quyết hoặc đóng Case.

## 13. Thông báo và số lượng task

- Chuông thông báo và badge ở thanh bên phản ánh các task chưa xử lý trong phạm vi role hiện tại.
- Khi xử lý xong một task, số lượng chưa xử lý giảm tương ứng.
- Bấm vào thông báo sẽ chuyển tới màn hình nghiệp vụ liên quan, ví dụ Offer cần duyệt, Booking cần duyệt, giao dịch hoặc Case.
- Nếu đang mở nhiều tab, nên tải lại trang để đồng bộ state localStorage của bản demo.

## 14. Khôi phục dữ liệu mẫu — Reset Seed

Có thể reset tại một trong các vị trí:

- Cuối trang **Bàn làm việc**: **Reset về dữ liệu demo ban đầu**.
- Màn **Cơ sở dữ liệu**: **Khôi phục Dữ liệu mẫu (Reset Seed)**.

Reset Seed khôi phục các dữ liệu nghiệp vụ mẫu gồm Offer, Booking, tài sản, giao dịch, Case, thông báo, matching và chat. Tài khoản, profile, mật khẩu đã đổi và biến môi trường không bị xóa.

Bộ dữ liệu mẫu hiện có:

- Khoảng 5 Offer của nhà cung cấp chính, gồm Offer đang khả dụng, đã ghép, đã rút và đã hoàn tất.
- 5 Booking/Nhu cầu của bên cần vỏ.
- Một Booking có 2 ứng viên auto matching.
- Một Booking có 1 ứng viên auto matching.
- Một giao dịch mẫu đang ở bước **PENDING_CARRIER — Tiếp nhận phê duyệt cấp lại vỏ (RU Approval) từ hãng tàu**.
- Một giao dịch mẫu đã hoàn tất.

Reset chỉ tác động tới trình duyệt đang mở website. Để test lại từ đầu, đăng nhập đúng role sau khi reset và tải lại trang nếu cần.

## 15. AI eDO, ảnh container và Booking

### 15.1. Các endpoint

Gateway cung cấp các endpoint:

- `POST /api/ai/edo/verify`
- `POST /api/ai/edo/scan` (tùy chọn)
- `POST /api/ai/container/inspect`
- `POST /api/ai/container/verify`

`GET /api/health` cho biết gateway đã nhận cấu hình AI hay chưa.

### 15.2. Cấu hình local

Tạo `apps/api/.env` từ file mẫu và điền key ở phía server:

```env
ECONT_AI_API_KEY=...
ECONT_AI_MODEL=gemini-2.5-flash
ECONT_AI_TIMEOUT_MS=90000
AI_ALLOWED_ORIGIN=http://localhost:5173
```

Không đặt API key vào biến `VITE_*`, không commit `apps/api/.env` và không đưa key vào code frontend.

### 15.3. Kết quả AI

AI eDO cần trả về các nhóm thông tin: hợp lệ/pháp lý, dấu hiệu bất thường, tóm tắt, chi tiết và có cần Ops xem hay không.

AI ảnh container cần trả về: ảnh có khớp đăng ký không, tình trạng thực tế, mô tả chi tiết bằng tiếng Việt, chi tiết sai lệch, điểm đánh giá và có cần Ops xem hay không.

Nếu AI không kết nối, lỗi HTTP hoặc kết quả không đủ tin cậy:

1. Tệp/ảnh vẫn được giữ trong hồ sơ.
2. Offer/Booking chuyển sang Ops kiểm tra thủ công.
3. Không tự đánh dấu hồ sơ là hợp lệ.

### 15.4. Xử lý lỗi AI thường gặp

| Hiện tượng | Kiểm tra |
|---|---|
| `Failed to fetch` | Để `VITE_API_BASE_URL` trống khi chạy gateway tích hợp; kiểm tra Vite đã khởi động lại |
| `AI_KEY_MISSING` | Đã điền `ECONT_AI_API_KEY` trong `apps/api/.env` chưa |
| `AI_KEY_REJECTED` | Key hết hạn, sai hoặc không có quyền gọi model |
| `AI_MODEL_UNAVAILABLE` | Kiểm tra `ECONT_AI_MODEL` và model đang được provider hỗ trợ |
| `AI_TIMEOUT` | File/ảnh quá lớn hoặc provider xử lý quá lâu; thử tệp nhỏ hơn |
| HTTP 500 | Xem log gateway/Vercel, kiểm tra biến môi trường server và deploy lại |

## 16. Deploy demo lên Vercel

1. Import repository vào Vercel.
2. Để **Root Directory** ở thư mục gốc repository, không chọn riêng `apps/web` vì API handler nằm ở root `api/` theo cấu hình Vercel.
3. Giữ build configuration theo `vercel.json`:
   - Install: `npm ci --prefix apps/web`
   - Build: `npm run build --prefix apps/web`
   - Output: `apps/web/dist`
4. Thêm Environment Variables cho Production/Preview khi cần:
   - `ECONT_AI_API_KEY` — Secret phía server.
   - `ECONT_AI_MODEL` — ví dụ `gemini-2.5-flash`.
   - `ECONT_AI_TIMEOUT_MS`.
   - `AI_ALLOWED_ORIGIN` — domain Vercel của website nếu cần kiểm tra origin.
5. Redeploy sau khi thêm hoặc thay đổi biến môi trường.

Bản demo vẫn lưu dữ liệu nghiệp vụ ở browser `localStorage`; Vercel không biến dữ liệu đó thành database dùng chung. Muốn nhiều người dùng/thiết bị thấy cùng dữ liệu cần backend xác thực, database và realtime thật.

## 17. Thuật ngữ nhanh

| Thuật ngữ | Giải thích |
|---|---|
| Offer | Tin đăng cung cấp một container cụ thể |
| Booking/Nhu cầu | Yêu cầu tìm một container phù hợp của bên cần vỏ |
| eDO | Hồ sơ/lệnh giao vỏ điện tử để Ops kiểm tra quyền lấy/giao container |
| RU Approval | Phê duyệt cấp lại vỏ từ hãng tàu |
| Depot | Bãi/container depot nơi container rỗng được lưu giữ hoặc bàn giao |
| Matching | Đối chiếu Offer và Booking theo điều kiện phù hợp |
| Ops | Bộ phận vận hành kiểm duyệt, điều phối và xử lý ngoại lệ |
| Case | Hồ sơ sự cố/khiếu nại dùng để xử lý sai lệch |
| Custody | Quyền quản lý/kiểm soát container; chuyển từ nhà cung cấp sang bên cần vỏ sau khi hoàn tất |
| AI manual fallback | Khi AI lỗi hoặc phát hiện bất thường, Ops kiểm tra thủ công |

## 18. Checklist demo một nghiệp vụ hoàn chỉnh

1. Reset Seed.
2. Đăng nhập `bena` và kiểm tra Offer nguồn vỏ.
3. Đăng nhập `benb`, mở Nhu cầu tìm vỏ và xem ứng viên matching.
4. Chọn Offer và giữ chỗ; dùng Chat với đối tác nếu cần.
5. Đăng nhập `bena` để chấp nhận đề xuất.
6. Hai bên ký phần thỏa thuận.
7. Đăng nhập `ops`, duyệt RU.
8. Hai bên xem QR, xác nhận đã chuyển khoản; Ops xác nhận thanh toán.
9. Ops phát phiếu điều phối.
10. Bên cần vỏ/tài xế gửi kiểm tra container.
11. Nếu đạt, hai bên xác nhận giao/nhận; nếu sai lệch, tạo Case để Ops xử lý.
12. Kiểm tra giao dịch chuyển `COMPLETED` và custody chuyển sang bên cần vỏ.
