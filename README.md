# Trình Duyệt Ảo Hiệu Năng Cao (Virtual Browser Docker Server)

Dự án này cung cấp giải pháp chạy trình duyệt ảo Chromium đầy đủ chức năng bên trong Docker Container trên Ubuntu Server. Giao diện được truyền phát thời gian thực qua giao thức WebRTC (sử dụng công nghệ Selkies/KasmVNC) với chất lượng mượt mà, hỗ trợ tăng tốc phần cứng GPU, độ phân giải sắc nét và truyền dẫn âm thanh đầy đủ.

---

## 🚀 Các Tính Năng Nổi Bật & Tối Ưu Hóa

1. **GPU Hardware Acceleration (Zero-Copy VA-API)**:
   * GPU Intel Onboard của Server tự động đảm nhận việc nén luồng WebRTC trực tiếp từ bộ nhớ đồ họa (**Zero-Copy**), giải phóng CPU của Server xuống mức tối thiểu (dưới 5% khi hoạt động).
   * Tự động cài đặt driver driver chuyên dụng đầy đủ tính năng mã hóa **`intel-media-va-driver-non-free`** khi container khởi động thông qua kịch bản khởi chạy tự động (init script).

2. **Khóa Cứng Độ Phân Giải Full HD (`1920x1080`)**:
   * Thiết lập `SELKIES_MANUAL_WIDTH=1920`, `SELKIES_MANUAL_HEIGHT=1080` và `SELKIES_IS_MANUAL_RESOLUTION_MODE=true`.
   * Việc này ngăn chặn trình duyệt gửi yêu cầu thay đổi độ phân giải lẻ khi co giãn cửa sổ phía Client, tránh làm crash bộ mã hóa phần cứng GPU VA-API (vốn yêu cầu kích thước khung hình chuẩn).

3. **Cấu Hình Mượt Mà & Chất Lượng Cao Cho Mạng LAN (50 FPS - 20 Mbps)**:
   * **Tốc độ khung hình**: `SELKIES_FRAMERATE=50` (50 FPS giúp giảm tải nén 17% cho GPU so với 60 FPS mà vẫn đảm bảo độ mượt mà tối đa).
   * **Băng thông WebRTC**: `SELKIES_VIDEO_BITRATE=20` (20 Mbps cho hình ảnh Full HD vô cùng sắc nét, tối ưu cho đường truyền LAN 100 Mbps ổn định).
   * **Độ chi tiết ảnh**: `SELKIES_H264_CRF=21` (hệ số nén thấp giúp hình ảnh sắc nét, chữ đọc cực kỳ rõ và không bị vỡ hạt).

4. **Tăng Tốc Chromium Flags**:
   * Cấu hình cờ tăng tốc qua biến `CHROME_CLI` để tự động bật GPU rasterization, Zero-Copy và kích hoạt bộ giải mã phần cứng (`VaapiVideoDecoder`).

---

## 📦 Hướng Dẫn Cài Đặt & Khởi Chạy

Chạy lệnh sau bên trong thư mục `browser-docker/` của dự án trên Server:
```bash
cd browser-docker
docker compose up -d --build
```
Container sẽ được dựng và tự động chạy ngầm, tự tải driver đồ họa chuyên dụng trong vòng 20-30 giây đầu tiên.

---

## 🔗 Các Cổng Kết Nối & Truy Cập

Hệ thống mở 2 cổng kết nối chính trên Server:
* 🔒 **Cổng HTTPS (Bắt buộc dùng để có Âm thanh & Micro)**: 👉 **`https://<server-ip>:8086`**
  * *Lưu ý*: Vì trình duyệt Chromium yêu cầu kết nối bảo mật (HTTPS) để sử dụng âm thanh và các chức năng ngoại vi, bạn **phải sử dụng đường dẫn HTTPS**. 
  * Khi trình duyệt hiển thị cảnh báo *"Kết nối không riêng tư"* do chứng chỉ tự ký (Self-signed Certificate), chỉ cần nhấn **Nâng cao (Advanced) -> Tiếp tục truy cập (Proceed to...)** là sử dụng bình thường.
* 🔓 **Cổng HTTP (Chỉ dùng để cấu hình tĩnh, không hỗ trợ âm thanh)**: `http://<server-ip>:8085`

---

## 🛠️ Hướng Dẫn Tối Ưu Hóa Trải Nghiệm Xem Video (YouTube/Web Phim)

Khi mở các trang xem video (như YouTube) trong trình duyệt ảo, video mặc định sẽ được phát bằng các codec hiện đại như VP9 hoặc AV1. Vì các GPU Intel onboard đời cũ thường không hỗ trợ giải mã phần cứng tốt các định dạng này trong container Docker, CPU sẽ phải gánh phần việc giải mã, dẫn đến hiện tượng video bị giật/lag nhẹ.

**Cách khắc phục triệt để:**
1. Trên trình duyệt Chromium ảo, truy cập Cửa hàng Chrome trực tuyến và cài đặt extension **[enhanced-h264ify](https://chromewebstore.google.com/detail/enhanced-h264ify/omkfmpieigamamjnlolmjbellbboihof)**.
2. Mở phần cài đặt của extension này, tích chọn:
   * [x] **Block VP8**
   * [x] **Block VP9**
   * [x] **Block AV1**
3. Tải lại trang video. Lúc này YouTube sẽ bắt buộc gửi luồng video định dạng **H.264** – định dạng giải mã phần cứng cực tốt thông qua GPU (Intel VA-API), giúp video chạy mượt mà 1080p và giải phóng tải cho CPU.

---

## 🔍 Kiểm Tra Trạng Thái GPU VA-API (Xác Minh & Chẩn Đoán)

Để kiểm tra xem trình duyệt ảo có đang giao tiếp và sử dụng GPU mã hóa/giải mã hay không, chạy lệnh sau trên Terminal của Server:
```bash
docker exec browser-chromium vainfo
```
**Kết quả mong đợi:**
* Trả về thông tin driver Intel: `va_openDriver() returns 0` và `Driver version: Intel iHD driver...`
* Hiển thị danh sách các Profile hỗ trợ giải mã (`VAEntrypointVLD`) và mã hóa (`VAEntrypointEncSlice`).
