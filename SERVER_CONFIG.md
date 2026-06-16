# Hướng Dẫn Cấu Hình GPU Acceleration Trên Server (Dành cho Người Dùng và Agent)

Tài liệu này hướng dẫn chi tiết cách cấu hình và khắc phục lỗi khi kích hoạt tính năng tăng tốc phần cứng bằng GPU Intel (Intel QuickSync / VA-API) trên máy chủ vật lý chạy Linux và Docker.

---

## 1. Chuẩn Bị Trên Máy Chủ Vật Lý (Host OS - Ubuntu/Debian)

Để Docker Container có thể sử dụng GPU, card đồ họa onboard hoặc rời của máy chủ vật lý phải được nhận diện và phân quyền chính xác.

### Bước A: Xác minh thiết bị đồ họa
Chạy lệnh sau trên Terminal của máy chủ:
```bash
ls -la /dev/dri
```
**Kết quả mong đợi:** Bạn sẽ thấy các node thiết bị đồ họa, đặc biệt là **`renderD128`**:
```text
drwxr-xr-x  3 root root        100 Jun  4 18:29 .
crw-rw----+ 1 root video  226,   1 Jun  4 18:37 card1
crw-rw----+ 1 root render 226, 128 Jun  4 18:37 renderD128
```
*Ghi chú:* Thiết bị `renderD128` là node phần cứng được sử dụng để tính toán đồ họa (render/encode/decode) không cần giao diện hiển thị (headless server).

### Bước B: Kiểm tra quyền truy cập (Permissions)
Nếu bạn chạy Docker bằng tài khoản không phải root (Non-root user), bạn cần đảm bảo tài khoản của bạn được cấp quyền truy cập thiết bị này bằng cách thêm user vào nhóm `video` hoặc `render`:
```bash
sudo usermod -aG video,render $USER
newgrp docker
```

---

## 2. Cấu Hình Trên Docker Container

### Bước A: Gắn thiết bị vào Container (`docker-compose.yml`)
Trong cấu hình compose, chúng ta bắt buộc phải khai báo mục `devices` để đưa thiết bị đồ họa từ máy chủ vào trong môi trường cô lập của container:
```yaml
services:
  tv-streaming:
    ...
    devices:
      - /dev/dri:/dev/dri  # Chia sẻ thư mục driver đồ họa
    environment:
      - LIBVA_DRIVER_NAME=iHD  # Chỉ định driver Intel thế hệ mới (Gen 8 trở lên như UHD 520)
```
*Lưu ý:* Đối với các dòng CPU Intel cực cũ (thế hệ 4 Haswell trở xuống), bạn có thể phải đổi giá trị biến môi trường thành `LIBVA_DRIVER_NAME=i965`.

### Bước B: Cài đặt Driver đồ họa tương ứng (`Dockerfile`)
Môi trường Alpine Linux siêu nhỏ gọn mặc định không có sẵn driver để giao tiếp với GPU Intel. Chúng ta cần cài đặt thêm các gói sau:
```dockerfile
RUN apk add --no-cache \
    intel-media-driver \
    libva-intel-driver \
    libva-utils
```

---

## 3. Xác Minh Hoạt Động (Verification & Debugging)

Sau khi khởi chạy container, Agent hoặc Quản trị viên cần thực hiện các bước sau để xác nhận tăng tốc đồ họa hoạt động tốt:

### Bước A: Chạy `vainfo` trong container
Lệnh này hiển thị toàn bộ các codec video được hỗ trợ giải mã/mã hóa bằng GPU:
```bash
docker exec tv-streaming-server vainfo
```
**Kết quả thành công:**
* Trả về dòng: `va_openDriver() returns 0`
* Hiển thị danh sách các Profile kèm theo điểm truy cập `VAEntrypointEncSlice` (cho phép mã hóa cứng) và `VAEntrypointVLD` (cho phép giải mã cứng).
* Nhận diện đúng driver: `Driver version: Intel iHD driver...`

**Lỗi thường gặp và cách khắc phục:**
1. **Lỗi `va_openDriver() returns -1` hoặc `permission denied`**:
   * *Nguyên nhân:* User chạy ứng dụng trong container không có quyền đọc/ghi file `/dev/dri/renderD128`.
   * *Khắc phục:* Đảm bảo container chạy bằng quyền `root` (mặc định của Docker) hoặc thêm cấu hình `group_add` vào file compose để map group ID của nhóm `video`/`render` trên host vào container.
2. **Lỗi `driver not found`**:
   * *Nguyên nhân:* Chọn sai biến môi trường `LIBVA_DRIVER_NAME` hoặc cài thiếu driver trong Dockerfile.
   * *Khắc phục:* Kiểm tra lại thế hệ chip CPU và thử đổi sang driver `i965` hoặc cài gói `mesa-va-gallium`.

---

## 4. Lệnh Chạy FFmpeg Tối Ưu Với GPU Intel VA-API

### Mã hóa luồng kiểm thử (Software frame -> Hardware encode):
Khi nguồn phát là hình ảnh tự sinh (lavfi testsrc), chúng ta phải nạp các frame này vào GPU trước khi mã hóa bằng bộ lọc `-vf 'format=nv12,hwupload'`:
```bash
ffmpeg -init_hw_device vaapi=va:/dev/dri/renderD128 -filter_hw_device va -re \
  -f lavfi -i testsrc=size=1280x720:rate=30 \
  -vf 'format=nv12,hwupload' \
  -c:v h264_vaapi \
  -f mpegts http://localhost:8000/feed/test
```

### Mã hóa và giải mã file video (Hardware decode -> Hardware encode):
Khi nguồn phát là file video MP4/MKV H.264 tĩnh, chúng ta bật tính năng tăng tốc toàn phần (Full acceleration) để giải mã bằng GPU trước rồi chuyển thẳng sang mã hóa bằng GPU mà không cần tải dữ liệu xuống RAM của CPU:
```bash
ffmpeg -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -hwaccel_output_format vaapi \
  -re -stream_loop -1 -i /app/videos/input.mp4 \
  -c:v h264_vaapi \
  -c:a aac -b:a 128k \
  -f mpegts http://localhost:8000/feed/vtv1
```
*(Cơ chế này tiêu thụ ít hơn 5% CPU, hoạt động tối ưu nhất cho các server phát 24/7).*
