# Facebook Group Scraper (Chrome Extension)

Extension này giúp bạn cào dữ liệu từ các nhóm Facebook một cách tự động thông qua giao diện web của Facebook, cho phép vượt qua các cơ chế chống bot và thu thập dữ liệu chính xác nhất.

## 🚀 Tính năng nổi bật
- **Bypass Infinite Scroll**: Tự động cuộn trang thông minh để lừa Facebook nạp thêm bài viết mới.
- **Vượt qua Skeleton Loading**: Nhận diện và tự động bỏ qua các thẻ ảo (đang tải) của giao diện Facebook để không làm rác dữ liệu.
- **Xuất CSV siêu tốc**: Tự động đóng gói và tải xuống file CSV ngay lập tức sau khi cào xong (chặn lỗi format số của Excel).
- **Đồng bộ với Backend (NodeJS)**: Click 1 nút là đẩy toàn bộ dữ liệu cào được thẳng vào Database qua API để quản lý trên Dashboard.

## 📥 Hướng dẫn cài đặt
1. Tải toàn bộ thư mục `chrome-extension` về máy.
2. Mở trình duyệt Chrome, truy cập vào `chrome://extensions/`.
3. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
4. Click vào **Load unpacked** (Tải tiện ích đã giải nén).
5. Trỏ tới thư mục `chrome-extension` mà bạn vừa tải. Extension sẽ xuất hiện trên thanh công cụ.

## 📖 Hướng dẫn sử dụng
1. Mở trang chủ của một Nhóm Facebook (Group) bất kỳ (ví dụ: `https://www.facebook.com/groups/xxxxx/`).
2. Click vào icon của Extension trên thanh công cụ.
3. Thiết lập các thông số:
   - **Số lượng bài tối đa**: Nhập số bài bạn muốn cào (VD: 100, 500).
   - Có thể thiết lập ngày tháng hoặc từ khóa lọc nếu cần.
4. Nhấn **"Bắt đầu cào"**. Trình duyệt sẽ tự động lướt xuống để thu thập dữ liệu. Không đóng tab trong lúc extension đang chạy.
5. Sau khi hoàn tất, trình duyệt sẽ tự động tải xuống file CSV.

## 🔗 Hướng dẫn đồng bộ lên Backend (NodeJS)
Nếu bạn đang chạy Server Backend (ví dụ ở cổng `8080`):
1. Chắc chắn rằng Backend đang chạy `npm run start` hoặc `npm run dev`.
2. Trên Popup của extension, điền địa chỉ API Server (ví dụ: `http://localhost:8080`).
3. Nhấn **"Đồng bộ lên Server"**.
4. Dữ liệu sẽ tự động được Push qua API `/api/jobs/sync-extension`. (Lưu ý API này đã được cấu hình mở (Public) để extension đẩy data mà không cần xác thực token lằng nhằng).
5. Click **"Xem trên Dashboard"** để xem trực quan dữ liệu.

## ⚠️ Lưu ý quan trọng
- Không thu nhỏ trình duyệt hay chuyển tab liên tục trong lúc đang lướt trang vì có thể làm đứng Intersection Observer của Facebook.
- Nếu bạn cào số lượng rất lớn (ví dụ 1000 bài), Facebook có thể tạm dừng nạp dữ liệu. Extension đã được lập trình để chờ và thử cuộn 15 lần. Nếu sau 15 lần (khoảng 1 phút) không có bài mới, nó sẽ tự chốt dữ liệu để bảo vệ thành quả.
