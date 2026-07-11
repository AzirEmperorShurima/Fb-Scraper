# 🚀 Hướng Dẫn Sử Dụng Toàn Tập FBGroupScraper Pro

Hệ thống FBGroupScraper Pro là một giải pháp hoàn chỉnh gồm 3 thành phần liên kết chặt chẽ với nhau: **Chrome Extension** (Cào dữ liệu), **Node.js Backend** (Xử lý & Lưu trữ API), và **Vite/React Frontend** (Dashboard Phân tích).

Dưới đây là hướng dẫn chi tiết từ cài đặt đến sử dụng luồng công việc mượt mà nhất.

---

## 🛠️ 1. Cài đặt và Khởi chạy Hệ Thống

Bạn cần đảm bảo cả 3 thành phần đều được khởi chạy.

### A. Backend (Node.js)
Nhiệm vụ: Cung cấp API, xác thực và lưu trữ dữ liệu vào MongoDB.
- Mở Terminal, di chuyển vào thư mục `backend-node`.
- Chạy lệnh cài đặt thư viện: `pnpm install` (hoặc npm)
- Khởi động Server: `node server.js`
- 🟢 *Trạng thái thành công:* Server chạy trên cổng `http://localhost:8080` và báo kết nối MongoDB thành công.

### B. Frontend Dashboard (React/Vite)
Nhiệm vụ: Hiển thị giao diện quản lý, vẽ biểu đồ phân tích dữ liệu.
- Mở một Terminal khác, di chuyển vào thư mục `frontend`.
- Chạy lệnh cài đặt: `npm install`
- Khởi động Frontend: `npm run dev`
- 🟢 *Trạng thái thành công:* Giao diện chạy trên `http://localhost:5173`.

### C. Chrome Extension
Nhiệm vụ: Nhúng vào Facebook để bóc tách dữ liệu DOM trực tiếp.
- Mở Chrome, truy cập: `chrome://extensions/`
- Bật **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc phải.
- Nhấn **"Tải tiện ích đã giải nén" (Load unpacked)** và chọn thư mục `chrome-extension` của dự án.
- 🟢 *Trạng thái thành công:* Icon Extension FBGroupScraper Pro xuất hiện trên thanh công cụ.

---

## 💻 2. Hướng Dẫn Luồng Sử Dụng (Workflow)

Luồng làm việc được thiết kế tối ưu, bắt đầu từ Extension và kết thúc tại Dashboard.

### Bước 1: Khởi tạo Tài Khoản (Từ Extension)
- Truy cập vào 1 Group, Fanpage, hoặc Trang cá nhân (Profile) Facebook bất kỳ.
- Bấm vào icon Extension trên thanh công cụ trình duyệt.
- Bạn sẽ thấy giao diện Đăng ký / Đăng nhập. Hãy tạo 1 tài khoản (ví dụ: `admin@gmail.com`).
- *Lưu ý: Tài khoản này được đồng bộ xuyên suốt từ Extension tới Backend và Frontend.*

### Bước 2: Bắt đầu Cào Dữ Liệu
- Sau khi đăng nhập Extension, giao diện cấu hình cào sẽ hiện ra.
- Tùy chỉnh các thông số:
  - **Số bài viết tối đa** cần lấy.
  - **Bộ lọc từ khoá** (chỉ lấy bài có chứa từ khóa nhất định).
  - **Lọc theo ngày** hoặc **lọc theo tương tác tối thiểu**.
- Nhấn **"Bắt đầu cào"**. 
- Extension sẽ tự động cuộn trang (bypass infinite scroll của FB), bóc tách dữ liệu theo thời gian thực.
- *Tip: Bạn có thể nhấn **"Dừng tiến trình"** bất cứ lúc nào, dữ liệu cào được tới thời điểm đó vẫn được giữ nguyên.*

### Bước 3: Cào Tiếp (Tùy chọn)
- Sau khi tiến trình dừng (do đủ số lượng hoặc do bạn bấm Dừng), giao diện kết quả sẽ hiện ra.
- Nếu thấy số bài chưa đủ, bạn có thể nhấn nút **"Cào tiếp"**. Extension sẽ tiếp tục cuộn xuống từ vị trí đang dở dang và cộng dồn dữ liệu mà không làm mất dữ liệu cũ.

### Bước 4: Tải Xuống hoặc Đồng Bộ Dữ Liệu
- Tại màn hình kết quả của Extension, bạn có nhiều lựa chọn:
  1. **Tải JSON / CSV**: Tải file trực tiếp về máy.
  2. **Đồng bộ lên Dashboard**: Dữ liệu sẽ được đẩy vào Backend (`localhost:8080`). Sau đó bấm OK để mở Dashboard xem biểu đồ.
  3. **Đồng bộ lên Google Sheets**: Nếu bạn đã điền "Google Sheet Webhook URL" ở bước cấu hình, bấm nút này dữ liệu sẽ được đẩy thẳng lên bảng tính Google Sheet của bạn.

---

## 🚀 3. Hướng Dẫn Cài Đặt Google Sheets Webhook (Tùy chọn)

Nếu bạn muốn dữ liệu cào được tự động điền vào file Google Sheets của bạn:
1. Mở trang Google Sheets và tạo một bảng tính mới (để trống).
2. Trên thanh menu, chọn **Tiện ích mở rộng (Extensions) > Apps Script**.
3. Xóa code cũ, mở file `google_apps_script.js` (trong thư mục `chrome-extension`) copy toàn bộ code và dán vào đó.
4. Nhấn **Lưu (Save)**.
5. Ở góc phải trên cùng, nhấn nút **Triển khai (Deploy) > Tùy chọn triển khai mới (New deployment)**.
6. Cấu hình triển khai:
   - Loại: **Ứng dụng web (Web app)**
   - Mô tả: "FBScraper Sync"
   - Ứng dụng thực thi dưới dạng: **Tôi (Me)**
   - Người có quyền truy cập: **Bất kỳ ai (Anyone)**
7. Nhấn **Triển khai (Deploy)**. Sẽ có bảng yêu cầu Cấp quyền truy cập, bạn bấm Review Permissions và Allow (Cấp quyền).
8. Copy đường dẫn **URL ứng dụng web (Web app URL)** hiện ra.
9. Mở Extension trên Chrome, dán URL đó vào ô **Google Sheet Webhook URL**.
10. Lần tới sau khi cào, chỉ cần nhấn nút "Đồng bộ lên Google Sheets" là dữ liệu sẽ bay vèo lên bảng tính của bạn!

### Bước 5: Phân tích và Tải Xuống (Trên Dashboard)
- Khi Dashboard (cổng `5173`) mở ra, nếu bạn chưa Đăng nhập ở Frontend, hệ thống sẽ yêu cầu bạn Sign In. Bạn có thể bấm nút **Sign in with Google** cho tiện.
- Sau khi Login, bạn sẽ thấy toàn bộ dữ liệu cào được trình bày dưới dạng:
  - Bảng thống kê chi tiết.
  - Biểu đồ tương tác sinh động.
- Tại đây, bạn có thể bấm **Tải Excel** hoặc **Tải CSV/JSON** để lưu trữ file báo cáo cuối cùng.

---

## 🔐 4. Hướng Dẫn Kích Hoạt Tính Năng Đăng Nhập Google (OAuth) & Sync Backend

Hiện tại mã nguồn đang sử dụng ID ảo. Để hệ thống Đăng nhập Google hoạt động thật, bạn cần cung cấp thông tin xác thực từ Google.

**Cách tạo Google Client ID (Giao diện Google Cloud mới):**
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Nhấn vào thanh chọn Dự án ở góc trên cùng bên trái (cạnh logo Google Cloud) và chọn **Tạo dự án mới (New Project)**.
3. Trong menu điều hướng bên trái (Navigation menu), chọn **API và Dịch vụ (APIs & Services)** > Chọn **Màn hình đồng ý OAuth (OAuth consent screen)** hoặc trong giao diện mới có thể nằm ở **Thương hiệu (Branding)** / **Khán giả (Audience)**.
   - Ở phần **Loại người dùng (User Type)**, chọn **Bên ngoài (External)** và nhấn **Tạo (Create)**.
   - Điền tên Ứng dụng (FBScraper Pro), Email hỗ trợ người dùng, và Email liên hệ của nhà phát triển. Nhấn Lưu và Tiếp tục.
4. (Rất quan trọng) Ở bước **Phạm vi (Scopes)**, hãy nhấn **Thêm hoặc Xóa Phạm vi (Add or Remove Scopes)** và tìm kiếm, tích chọn các quyền cho Google Drive và Google Sheets:
   - `.../auth/drive.file`
   - `.../auth/spreadsheets`
5. (Rất quan trọng) Chuyển sang phần **Người dùng thử nghiệm (Test users)** hoặc **Audience**:
   - Nhấn **+ ADD USERS (Thêm người dùng)**.
   - Nhập chính xác Email Google của bạn (hoặc tài khoản phụ) mà bạn định dùng để Đăng nhập & Lưu file Google Sheets. Nếu không thêm ở đây, khi đăng nhập sẽ gặp **lỗi 403: access_denied**.
6. Sau khi hoàn thành Màn hình đồng ý, chuyển sang menu **Thông tin xác thực (Credentials)** ở thanh bên trái.
   - Nhấn nút dấu cộng **+ TẠO THÔNG TIN XÁC THỰC (CREATE CREDENTIALS)** > Chọn **ID ứng dụng khách OAuth (OAuth client ID)**.
   - **Loại ứng dụng (Application type):** Chọn *Ứng dụng Web (Web application)*.
   - **Nguồn gốc JavaScript được phép (Authorized JavaScript origins):** Nhập `http://localhost:5173`.
   - Nhấn **Tạo (Create)**. Một bảng thông báo sẽ hiện ra chứa **Client ID (Mã ứng dụng khách)** của bạn. Hãy Copy mã này.

**Cấu hình trên Giao diện Web (Rất Đơn Giản - Không cần Code):**
1. Mở trang Dashboard Web của bạn (`http://localhost:5173`).
2. Nhấn vào mục **Cài đặt (Settings)** ở thanh Menu bên trái.
3. Dán **Google Client ID** mà bạn vừa copy vào ô "Google Client ID" và nhấn **Lưu cấu hình**.
4. Xong! Hệ thống đã tự động kết nối hoàn hảo. Bạn không cần phải mở file `.env` hay file code nào cả.

**Sử dụng chức năng Đồng bộ Google Sheets (Sync GSheet):**
- Hệ thống Frontend và Backend đã hỗ trợ đồng bộ thẳng vào tài khoản Google Drive của bạn thông qua **Google OAuth2** hiện đại. Toàn bộ cơ chế cũ liên quan đến Service Account (`credentials.json`) đã được loại bỏ để tăng cường bảo mật và tiện dụng.
- Khi ấn nút **Sync GSheet** trên Dashboard Web, trình duyệt sẽ hiển thị cửa sổ Đăng nhập Google. Bạn chỉ cần chọn Email (đã được thêm vào mục Test users ở bước 5) và nhấn **Tiếp tục/Cho phép (Allow)**. File báo cáo Google Sheet sẽ được tạo tự động!

🎉 **Chúc bạn có những trải nghiệm bóc tách dữ liệu tuyệt vời nhất cùng FBGroupScraper Pro!**
