# Hệ Thống TV Streaming & Trình Duyệt Ảo Docker

Dự án này tích hợp 2 giải pháp truyền tải hình ảnh/video hiệu năng cao sử dụng công nghệ tăng tốc phần cứng bằng GPU Intel (VA-API) trên máy chủ Ubuntu Server.

---

# 📺 PHẦN 1: TV Streaming (MPEG-TS over HTTP Relay Server)

Dự án này cung cấp giải pháp truyền hình trực tuyến (Live TV Streaming) siêu nhẹ và ổn định, chuyển tiếp luồng video định dạng **MPEG-TS** qua giao thức HTTP. Dự án được tối ưu hóa đặc biệt cho các thiết bị Smart TV WebKit đời cũ (vốn quen thuộc với định dạng truyền hình truyền thống MPEG-TS và không yêu cầu file danh sách playlist phức tạp như HLS/DASH).

## 🚀 Các Tính Năng Nổi Bật
1. **Một Luồng Duy Nhất (Single Stream)**: Audio và Video kết hợp (multiplexed) trong một luồng MPEG-TS duy nhất truyền qua HTTP, loại bỏ độ trễ và lỗi tải tệp playlist `.m3u8` của HLS.
2. **Instant Playback (Bộ đệm 2MB)**: Server tích hợp bộ đệm vòng (Ring Buffer) 2MB tự động lưu trữ các gói dữ liệu mới nhất (gồm thông tin PAT/PMT đầu luồng), giúp thiết bị của người xem kết nối sau có thể phân tích giải mã và phát video ngay lập tức mà không phải chờ đợi.
3. **Intel GPU Acceleration (VA-API)**: Hỗ trợ đầy đủ việc giải mã và mã hóa bằng GPU Intel Onboard (như Intel UHD 520) thông qua VA-API, giải phóng CPU của máy chủ (CPU usage giảm xuống dưới 5%).
4. **Tự Động Fallback**: Script stream tự động dò tìm GPU Intel, nếu không khả dụng sẽ tự động chuyển đổi sang mã hóa phần mềm bằng CPU (`libx264`).

## 📦 Hướng Dẫn Cài Đặt & Chạy Server
Tại thư mục gốc của dự án, chạy lệnh:
```bash
docker compose up --build -d
```
Server sẽ được dựng và chạy ngầm, lắng nghe trên cổng **`8000`**.

### Kiểm tra trạng thái hoạt động
Mở trình duyệt và truy cập:
👉 `http://<server-ip>:8000/`

Bạn sẽ nhận được danh sách JSON các kênh đang phát trực tuyến cùng số lượng người xem hiện tại:
```json
{
  "activeChannels": []
}
```

## 📹 Hướng Dẫn Phát Luồng Video (Streamer Source)
Chúng ta có 2 kịch bản phát thử nghiệm chạy trực tiếp bên trong container để kiểm thử nhanh hiệu năng GPU:

### Kịch bản 1: Phát luồng thử nghiệm (Test Pattern)
```bash
docker exec -d tv-streaming-server /app/start-test-stream.sh http://localhost:8000/feed/test
```
*Xem trực tiếp kênh này tại:* `http://<server-ip>:8000/live/test`

### Kịch bản 2: Phát lặp lại một file video (Loop File)
1. Copy file video của bạn vào thư mục `videos/` trong dự án và đổi tên thành `input.mp4`.
2. Khởi chạy script:
   ```bash
   docker exec -d tv-streaming-server /app/start-file-stream.sh /app/videos/input.mp4 http://localhost:8000/feed/vtv1
   ```
*Xem trực tiếp kênh này tại:* `http://<server-ip>:8000/live/vtv1`

## 📺 Hướng Dẫn Xem Trực Tiếp (Client Player)
* **VLC Media Player**: Mở VLC -> Nhấn `Ctrl + N` -> Nhập địa chỉ: `http://<server-ip>:8000/live/test` -> Chọn **Play**.
* **Smart TV**: Nhúng luồng vào thẻ `<video>` chuẩn HTML5:
  ```html
  <video width="1280" height="720" controls autoplay>
    <source src="http://<server-ip>:8000/live/test" type="video/mp2t">
  </video>
  ```

---

# 🌐 PHẦN 2: Docker Chromium (Virtual Browser Streaming Server)

Giải pháp chạy trình duyệt ảo Chromium đầy đủ chức năng bên trong Docker Container trên Server, truyền phát giao diện thời gian thực qua giao thức WebRTC (sử dụng công nghệ Selkies/KasmVNC) mượt mà ở tốc độ 60 FPS, độ phân giải sắc nét và hỗ trợ đầy đủ truyền dẫn âm thanh.

## 🚀 Các Tính Năng Nổi Bật & Tối Ưu Hóa
1. **GPU Hardware Encoding (Zero-Copy VA-API)**: 
   * Tự động cài đặt driver **`intel-media-va-driver-non-free`** khi container khởi động thông qua custom script ở `/custom-cont-init.d`.
   * Cho phép GPU của Server tự nén luồng WebRTC trực tiếp từ bộ nhớ đồ họa (**Zero-Copy**), giảm tải CPU từ 100% xuống dưới 2%.
2. **Khóa cứng độ phân giải Full HD (`1920x1080` @ 60 FPS)**: Đảm bảo độ nét tối đa khi đọc chữ và chơi video trên màn hình lớn, đồng thời đồng bộ hóa tỷ lệ điểm ảnh với bộ mã hóa GPU để ngăn lỗi giải mã.
3. **Tối ưu hóa băng thông LAN**: Tăng băng thông mặc định lên **25 Mbps** (`SELKIES_VIDEO_BITRATE=25`) và chỉnh CRF thành **20** (`SELKIES_H264_CRF=20`) giúp video chuyển động nhanh không bị vỡ hạt (pixelated).
4. **Tăng tốc Chromium**: Cấu hình các cờ tăng tốc phần cứng giải mã video (`VaapiVideoDecoder`) và cho phép cuộn mượt (smooth scroll) ở chất lượng cao khi đi qua mạng LAN.

## 📦 Hướng Dẫn Cài Đặt & Chạy Trình Duyệt Ảo
Di chuyển vào thư mục `browser-docker/` của dự án và chạy:
```bash
cd browser-docker
docker compose up -d
```
Container trình duyệt sẽ khởi động và tự động cài đặt driver non-free trong vài giây.

## 🔗 Các Cổng Kết Nối & Truy Cập
Hệ thống mở 2 cổng kết nối chính trên Server:
* **Cổng HTTP (3000/8085)**: `http://<server-ip>:8085` (Chỉ dùng để cấu hình hoặc xem tĩnh).
* **Cổng HTTPS (3001/8086) - Bắt buộc dùng**: 👉 **`https://<server-ip>:8086`**
  * *Lưu ý*: Vì trình duyệt Chromium yêu cầu kết nối bảo mật (HTTPS) để sử dụng âm thanh (Audio) và các chức năng ngoại vi, bạn **phải sử dụng đường dẫn HTTPS**. 
  * Khi trình duyệt hiển thị cảnh báo *"Kết nối không riêng tư"* do chứng chỉ tự ký (Self-signed Certificate), chỉ cần nhấn **Nâng cao (Advanced) -> Tiếp tục truy cập (Proceed to...)** là sử dụng bình thường.

## ⚠️ Lưu ý quan trọng về mạng truyền dẫn
* Tránh sử dụng Tailscale qua máy chủ trung gian (Relay/DERP) vì băng thông bị bóp dưới 4 Mbps sẽ gây giật lag.
* Hãy kết nối thiết bị của bạn chung router Wi-Fi với server (nhận IP dải `192.168.1.x`) để đi trực tiếp qua mạng LAN tốc độ cao (100 - 1000 Mbps) giúp stream mượt mà nhất.

---

# 📺 PHẦN 3: Hướng Dẫn Triển Khai App Cho Samsung Tizen TV

Hướng dẫn này giúp bạn tự đóng gói hệ thống (Relay Server và Browser Docker) thành một ứng dụng chạy trực tiếp trên Samsung Smart TV sử dụng hệ điều hành Tizen OS.

## 1. Bản chất của Tizen App trên Samsung TV
* Mọi ứng dụng trên Tizen TV thực chất là một ứng dụng Web (HTML5/CSS/JS) được đóng gói kèm tệp cấu hình `config.xml` và ký chứng chỉ bảo mật dưới dạng tệp tin `.wgt` (Widget).

## 2. Kịch Bản Đóng Gói
* **Kịch bản 1: Mở thẳng trình duyệt ảo (KasmVNC)**: Cấu hình tệp `config.xml` trỏ trực tiếp liên kết khởi động tới URL trình duyệt ảo của Docker Server:
  ```xml
  <content src="https://192.168.1.218:8086" />
  ```
* **Kịch bản 2: Thiết kế trang Portal tĩnh (Nút bấm chọn nguồn)**: Tạo trang `index.html` chứa các nút bấm lớn trỏ vào các link tương ứng.
  * *Nút Browser*: Mở URL `https://192.168.1.218:8086`.
  * *Nút Kênh TV*: Sử dụng API trình phát video mặc định của Tizen (`webapis.avplay`) trỏ vào luồng MPEG-TS `http://192.168.1.218:8000/live/test`.

## 3. Các Bước Đóng Gói Với Tizen Studio SDK
1. **Cài đặt Tizen Studio**: Tải xuống Tizen Studio SDK từ trang chủ Samsung Developer và cài thêm gói **TV Extension**.
2. **Tạo Dự Án mới**: Chọn *New Tizen Project -> Template -> TV -> Web Application -> Basic Project*.
3. **Cấu hình `config.xml`**:
   * Cho phép kết nối mạng LAN/Internet:
     ```xml
     <access origin="*" subdomains="true"/>
     <tizen:privilege name="http://tizen.org/privilege/internet"/>
     ```
   * Bật hỗ trợ các phím trên Remote (Mũi tên, OK, Back):
     ```xml
     <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
     ```
4. **Tạo chứng chỉ ký (Certificate Manager)**:
   * Đăng nhập tài khoản Samsung Developer.
   * Tạo chứng chỉ cá nhân (Author Certificate) và chứng chỉ thiết bị (Distributor Certificate).
5. **Biên dịch**: Chuột phải vào project -> Chọn **Build Package** để xuất ra tệp `TizenApp.wgt`.

## 4. Cách Cài Đặt (Deploy) Lên Samsung TV Thực Tế
1. **Bật Developer Mode trên TV**:
   * Kết nối TV Samsung chung một mạng LAN/Wi-Fi với máy tính lập trình.
   * Mở kho ứng dụng **Apps** trên TV.
   * Nhấn chuỗi số **`1 2 3 4 5`** trên Remote để hiện bảng Developer Mode.
   * Chuyển trạng thái sang **ON**, nhập **IP của máy tính lập trình** vào ô Host IP.
2. **Khởi động lại TV**:
   * Nhấn giữ nút Nguồn trên Remote khoảng 5-10 giây cho đến khi TV tắt hẳn và hiện logo khởi động lại của Samsung.
3. **Kết nối & Cài đặt từ Tizen Studio**:
   * Mở **Device Manager** trong Tizen Studio -> Quét tìm TV Samsung qua IP nội bộ và chuyển trạng thái sang **Connect**.
   * Chuột phải vào dự án của bạn -> Chọn **Run As -> Tizen TV Web Application**. Ứng dụng sẽ tự động được truyền qua LAN và cài đặt lên TV.
