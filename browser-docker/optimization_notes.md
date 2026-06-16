# Nhật Ký Tối Ưu Hóa & Chẩn Đoán Hệ Thống (Browser Docker)

Tài liệu này ghi lại toàn bộ các bước tối ưu hóa hiệu năng stream 60 FPS, kích hoạt GPU Hardware Acceleration, cấu hình độ phân giải Full HD và kết quả chẩn đoán băng thông mạng nội bộ thực hiện vào ngày **16/06/2026**.

---

## 1. Kích Hoạt Tăng Tốc Phần Cứng GPU (VA-API Hardware Encoding)

### Vấn Đề
Trước đó, container logs liên tục xuất hiện lỗi:
```text
[Parsed_scale_vaapi_1 @ 0x...] Failed to create processing pipeline config: 12 (the requested VAProfile is not supported).
[Wayland] Failed to init VAAPI: Failed to config filter graph. Falling back to CPU.
```
* **Nguyên nhân**: Hệ điều hành Debian bên trong Docker mặc định cài đặt gói driver `intel-media-va-driver` (bản DFSG - Free). Bản này bị cắt bỏ hoàn toàn tính năng mã hóa H.264/H.265 do vấn đề bản quyền sáng chế phần mềm. Hệ thống bị ép chạy mã hóa bằng CPU làm quá tải CPU và gây giật lag nghiêm trọng.

### Giải Pháp
1. **Tạo Script Khởi Động Tự Động (`custom-cont-init.d/install-nonfree-drivers.sh`)**:
   Tự động tải và cài đặt gói driver đầy đủ tính năng mã hóa **`intel-media-va-driver-non-free`**:
   ```bash
   #!/bin/bash
   if ! dpkg -s intel-media-va-driver-non-free >/dev/null 2>&1; then
     apt-get update
     apt-get install -y --no-install-recommends intel-media-va-driver-non-free
   fi
   ```
2. **Ánh Xạ Volume cho S6 Overlay v3**:
   Để container thực thi script khi khởi động, bổ sung ánh xạ volume trong `docker-compose.yml`:
   ```yaml
   volumes:
     - ./config:/config
     - ./config/custom-cont-init.d:/custom-cont-init.d:ro
   ```

### Kết Quả
GPU Intel HD Graphics của Server đã kích hoạt thành công chế độ mã hóa phần cứng **Zero-Copy**:
```text
[Wayland] VAAPI Encoder initialized successfully.
[Wayland] Decision: Zero-Copy path active.
Stream settings active -> Res: 1920x1080 | FPS: 60.0 | Mode: H264 (VAAPI) FullFrame
```

---

## 2. Chuẩn Hóa Độ Phân Giải (Full HD 1080p)

* Khóa cứng độ phân giải hiển thị phía server ở mức **`1920x1080` @ 60 FPS** bằng cách thiết lập các biến môi trường:
  * `SELKIES_MANUAL_WIDTH=1920`
  * `SELKIES_MANUAL_HEIGHT=1080`
  * `SELKIES_IS_MANUAL_RESOLUTION_MODE=true`
* Việc này giúp ngăn chặn trình duyệt gửi yêu cầu thay đổi độ phân giải lẻ (ví dụ `1914x964`) khi co giãn cửa sổ client, tránh làm crash bộ mã hóa phần cứng VA-API vốn chỉ hỗ trợ các kích thước chuẩn.

---

## 3. Tối Ưu Hóa Trình Duyệt Chromium Cho Xem Video & Cuộn Mượt

### Thiết Lập Chất Lượng Stream (WebRTC)
* **`SELKIES_VIDEO_BITRATE=25` (25 Mbps)**: Tăng từ 8 Mbps mặc định để đảm bảo chất lượng hình ảnh video 1080p sắc nét tối đa trên mạng LAN, không bị vỡ hạt (pixelated) khi có chuyển động nhanh.
* **`SELKIES_H264_CRF=20`**: Tối ưu chất lượng mã hóa chi tiết ảnh.

### Tăng Tốc Giải Mã Video (GPU Decoding inside Chrome)
Cấu hình biến `CHROME_CLI` trong `docker-compose.yml` để Chromium sử dụng GPU của server giải mã video:
```yaml
- CHROME_CLI=--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --num-raster-threads=4 --enable-features=VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization --disable-features=UseChromeOSDirectVideoDecoder --autoplay-policy=no-user-gesture-required
```
* **Bật lại Cuộn Mượt (Smooth Scroll)**: Sau khi GPU đã gánh thành công luồng stream 60 FPS, các cờ vô hiệu hóa cuộn mượt đã được gỡ bỏ để khôi phục trải nghiệm nguyên bản cao cấp nhất.

---

## 4. Chẩn Đoán Mạng Nội Bộ (LAN vs Tailscale)

Sử dụng công cụ `iperf3` để kiểm tra băng thông thực tế từ máy Windows Client đến Docker Server:

### Kết Quả Đo Tốc Độ
* **Mạng LAN (`192.168.1.218`):** **Timeout (Không thể kết nối)**.
* **Mạng Tailscale (`100.80.180.36`):** **Thành công nhưng bị nghẽn ở `3.56 Mbps`**.

### Phân Tích Hiện Trạng & Khắc Phục
1. **Lệch dải IP mạng LAN**:
   * Máy Windows Client nhận IP Wi-Fi: `10.16.237.146`.
   * Server nhận IP LAN: `192.168.1.218`.
   * *Khắc phục*: Cần kết nối máy Windows vào cùng cục Router Wi-Fi phát ra dải mạng `192.168.1.x` của Server để đi trực tiếp qua mạng LAN tốc độ cao (100 - 1000 Mbps).
2. **Tailscale bị định tuyến qua Relay (DERP)**:
   * Do router/firewall chặn kết nối UDP trực tiếp, Tailscale phải truyền qua server trung gian dẫn đến tốc độ bị giới hạn dưới 4 Mbps (không đủ cho stream video mượt mà).
   * *Khắc phục*: Mở cổng **UDP `41641`** trên router hoặc bật **UPnP** để Tailscale thiết lập kết nối P2P trực tiếp (Direct Connection).
