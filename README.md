# TV Streaming (MPEG-TS over HTTP Relay Server)

Dự án này cung cấp giải pháp truyền hình trực tuyến (Live TV Streaming) siêu nhẹ và ổn định, chuyển tiếp luồng video định dạng **MPEG-TS** qua giao thức HTTP. Dự án được tối ưu hóa đặc biệt cho các thiết bị Smart TV WebKit đời cũ (vốn quen thuộc với định dạng truyền hình truyền thống MPEG-TS và không yêu cầu file danh sách playlist phức tạp như HLS/DASH).

Hệ thống tích hợp công nghệ **tăng tốc phần cứng bằng GPU Intel (VA-API)** bên trong môi trường Docker Container để giảm thiểu tải CPU khi thực hiện xử lý video thực tế.

---

## 🚀 Các Tính Năng Nổi Bật

1. **Một Luồng Duy Nhất (Single Stream)**: Audio và Video kết hợp (multiplexed) trong một luồng MPEG-TS duy nhất truyền qua HTTP, loại bỏ độ trễ và lỗi tải tệp playlist `.m3u8` của HLS.
2. **Instant Playback (Bộ đệm 2MB)**: Server tích hợp bộ đệm vòng (Ring Buffer) 2MB tự động lưu trữ các gói dữ liệu mới nhất (gồm thông tin PAT/PMT đầu luồng), giúp thiết bị của người xem kết nối sau có thể phân tích giải mã và phát video ngay lập tức mà không phải chờ đợi.
3. **Intel GPU Acceleration (VA-API)**: Hỗ trợ đầy đủ việc giải mã và mã hóa bằng GPU Intel Onboard (như Intel UHD 520) thông qua VA-API, giải phóng CPU của máy chủ (CPU usage giảm xuống dưới 5%).
4. **Tự Động Fallback**: Script stream tự động dò tìm GPU Intel, nếu không khả dụng sẽ tự động chuyển đổi sang mã hóa phần mềm bằng CPU (`libx264`).

---

## 🛠️ Yêu Cầu Hệ Thống

* **Docker & Docker Compose** đã được cài đặt.
* (Tùy chọn) Máy chủ chạy hệ điều hành Linux có card đồ họa Intel onboard (thiết bị khả dụng tại `/dev/dri/renderD128`) để kích hoạt tăng tốc phần cứng.

---

## 📦 Hướng Dẫn Cài Đặt & Chạy Server

### 1. Khởi động Relay Server bằng Docker
Tại thư mục gốc của dự án, chạy lệnh:
```bash
docker compose up --build -d
```
Server sẽ được dựng và chạy ngầm, lắng nghe trên cổng **`8000`**.

### 2. Kiểm tra trạng thái hoạt động
Mở trình duyệt và truy cập:
👉 `http://<server-ip>:8000/`

Bạn sẽ nhận được danh sách JSON các kênh đang phát trực tuyến cùng số lượng người xem hiện tại:
```json
{
  "activeChannels": []
}
```

---

## 📹 Hướng Dẫn Phát Luồng Video (Streamer Source)

Chúng ta có 2 kịch bản phát thử nghiệm chạy trực tiếp bên trong container để kiểm thử nhanh hiệu năng GPU:

### Kịch bản 1: Phát luồng thử nghiệm (Test Pattern)
Luồng này tự tạo bảng màu động và tiếng bíp liên tục, thích hợp để kiểm thử kết nối mạng:
```bash
docker exec -d tv-streaming-server /app/start-test-stream.sh http://localhost:8000/feed/test
```
*Xem trực tiếp kênh này tại:* `http://<server-ip>:8000/live/test`

### Kịch bản 2: Phát lặp lại một file video (Loop File)
1. Copy file video của bạn vào thư mục `videos/` trong dự án và đổi tên thành `input.mp4`.
2. Khởi chạy script để GPU tự động giải mã và mã hóa phát lặp lại vô tận:
   ```bash
   docker exec -d tv-streaming-server /app/start-file-stream.sh /app/videos/input.mp4 http://localhost:8000/feed/vtv1
   ```
*Xem trực tiếp kênh này tại:* `http://<server-ip>:8000/live/vtv1`

---

## 📺 Hướng Dẫn Xem Trực Tiếp (Client Player)

### 1. Xem qua VLC Media Player (Khuyên dùng trên PC)
* Mở VLC.
* Nhấn `Ctrl + N` (Open Network Stream).
* Nhập địa chỉ: `http://<server-ip>:8000/live/test` (hoặc tên kênh tương ứng).
* Nhấn **Play**.

### 2. Xem trên Smart TV / WebKit cũ
Nhúng luồng trực tiếp bằng thẻ `<video>` chuẩn HTML5 (nếu trình duyệt TV hỗ trợ giải mã phần cứng MPEG-TS):
```html
<video width="1280" height="720" controls autoplay>
  <source src="http://<server-ip>:8000/live/test" type="video/mp2t">
  Trình duyệt TV không hỗ trợ phát trực tiếp MPEG-TS.
</video>
```
