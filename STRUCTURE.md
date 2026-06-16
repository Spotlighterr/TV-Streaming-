# Cấu Trúc Dự Án (Project Structure)

Dự án **TV Streaming** được thiết kế tối giản, tập trung vào tính thực tế và dễ bảo trì. Dưới đây là mô tả chi tiết sơ đồ thư mục và chức năng của từng tệp tin trong mã nguồn.

---

## Sơ đồ thư mục (File Tree)

```text
tv-streaming/
├── Dockerfile                   # Cấu hình đóng gói Docker container (Alpine + Node + FFmpeg + Intel drivers)
├── docker-compose.yml           # Định nghĩa dịch vụ Docker Compose, cấu hình map cổng và GPU
├── package.json                 # Định nghĩa thông tin dự án Node.js và các lệnh start
├── server.js                    # Mã nguồn chính của Relay Server (chuyển tiếp luồng MPEG-TS)
├── start-file-stream.sh         # Script đẩy luồng video từ file MP4 local (Hỗ trợ GPU Intel VA-API)
├── start-test-stream.sh         # Script đẩy luồng video thử nghiệm tự sinh (Hỗ trợ GPU Intel VA-API)
└── videos/                      # Thư mục chứa các file video tĩnh để phát lặp (mapped vào container)
    └── (input.mp4)              # File video mẫu người dùng đặt vào (tùy chọn)
```

---

## Chi tiết các tệp tin

### 1. `server.js`
Tệp tin cốt lõi chạy ứng dụng Node.js.
* Sử dụng module `http` thuần không có thư viện bên ngoài để tối đa tốc độ chuyển tiếp dữ liệu socket.
* Quản lý trạng thái các kênh phát thông qua cấu trúc dữ liệu `Map` lưu trữ động.
* Route `/` hiển thị trạng thái (JSON).
* Route `/feed/:channelId` nhận dữ liệu stream nhị phân (HTTP POST).
* Route `/live/:channelId` phân phối dữ liệu cho người xem (HTTP GET).

### 2. `Dockerfile`
Dựng môi trường chạy ứng dụng khép kín:
* Sử dụng base image `node:20-alpine` giúp container có dung lượng nhỏ gọn nhất.
* Cài đặt `ffmpeg` để xử lý video.
* Cài đặt các gói VA-API drivers của Intel (`intel-media-driver`, `libva-intel-driver`, `libva-utils`) để cho phép container truy cập và sử dụng sức mạnh xử lý của GPU Intel onboard.

### 3. `docker-compose.yml`
Hỗ trợ quản lý container dễ dàng thông qua các lệnh đơn giản.
* Ánh xạ cổng `8000` của container ra cổng `8000` của máy chủ.
* Gắn thiết bị phần cứng GPU `/dev/dri` từ máy chủ vật lý vào trong container để FFmpeg có thể giao tiếp với chip Intel UHD 520.
* Khai báo biến môi trường `LIBVA_DRIVER_NAME=iHD` bắt buộc đối với driver Intel thế hệ mới.
* Mount thư mục `videos` cục bộ vào đường dẫn `/app/videos` trong container để FFmpeg đọc file phim.

### 4. `start-test-stream.sh`
Kịch bản phát sóng thử nghiệm:
* Sử dụng bộ sinh tín hiệu giả lập của FFmpeg (`testsrc` cho video và `sine` cho audio).
* Cố gắng mã hóa bằng GPU Intel thông qua bộ mã hóa VA-API `h264_vaapi`.
* Tự động chuyển vùng về CPU mã hóa (`libx264`) nếu hệ thống không có GPU Intel hoặc phân quyền truy cập bị lỗi.

### 5. `start-file-stream.sh`
Kịch bản phát phim thực tế:
* Hỗ trợ phát lặp lại vô tận (`-stream_loop -1`) một file video nằm trong thư mục `/app/videos/input.mp4`.
* Bật tính năng tăng tốc phần cứng toàn phần: sử dụng GPU Intel để giải mã luồng đầu vào (`-hwaccel vaapi`) và mã hóa luồng đầu ra (`-c:v h264_vaapi`). Giúp giảm tải tối đa cho CPU của máy chủ.
* Có cơ chế tự động chuyển đổi về mã hóa CPU phần mềm nếu VA-API bị lỗi.
