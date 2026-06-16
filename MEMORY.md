# 🧠 Bộ Nhớ Dự Án & Tiến Độ Công Việc (TV-Streaming Memory)

Tài liệu này lưu trữ tiến trình thực hiện công việc, các quyết định kỹ thuật quan trọng và định hướng phát triển nhằm giúp các AI Agent tiếp theo dễ dàng tiếp quản dự án.

---

## 📌 1. Tổng Quan Hệ Thống & Hiện Trạng Công Nghệ

* **Tên dự án**: TV-Streaming-
* **Môi trường**: 
  * **Server**: Ubuntu Server `192.168.1.218` (Hardware: Intel CPU có GPU Onboard Intel HD Graphics, hỗ trợ VA-API).
  * **Client**: Máy Windows (`192.168.1.121`) và Smart TV Samsung (chạy Tizen OS 2.4 đời 2016).
* **Công nghệ cốt lõi**: Docker, LinuxServer Chromium Image, KasmVNC/Selkies WebRTC.
* **Mạng truyền tải**: LAN trực tiếp (đã đo kiểm băng thông thực tế đạt tối đa **~95 Mbps** - giới hạn của Fast Ethernet 100Mbps). Latency cực thấp (1-2ms).

---

## 🕒 2. Lịch Sử Cập Nhật & Các Quyết Định Kỹ Thuật (Agent Handoff Log)

### Phiên làm việc: 2026-06-16 (Chiều)
* **Quyết định 1: Dọn dẹp & Tối giản hóa dự án (Xóa bỏ MPEG-TS Relay Server)**:
  * *Bối cảnh*: Ban đầu hệ thống chạy song song 2 phương án: (1) MPEG-TS over HTTP Relay Server (`server.js` Node.js) nhận feed từ FFmpeg và phát đi; (2) Trình duyệt ảo Docker Chromium (Selkies/KasmVNC).
  * *Hành động*: Nhận thấy nhu cầu chỉ tập trung vào trình duyệt ảo, tôi đã dừng container `tv-streaming-server` (cổng `8000`), xóa thư mục `/home/spotlighter/tv-streaming` trên server, và xóa toàn bộ mã nguồn liên quan đến MPEG-TS ở local workspace.
  * *Kết quả*: Cấu trúc dự án hiện tại chỉ còn duy nhất module `browser-docker/` chứa cấu hình trình duyệt ảo.

* **Quyết định 2: Tối ưu hóa hiệu năng WebRTC (Xử lý hiện tượng giật hình nhẹ - Micro-Stuttering)**:
  * *Bối cảnh*: Chạy luồng WebRTC 1080p 60 FPS ở bitrate `25 Mbps` và `CRF=20` trên mạng LAN gây ra hiện tượng giật hình nhẹ.
  * *Chẩn đoán*: Đo tốc độ bằng `iperf3` phát hiện mạng LAN bị nghẽn ở giới hạn vật lý **95 Mbps** (do router hoặc cáp mạng). Bitrate 25 Mbps chiếm hơn 26% băng thông, kết hợp burst packets của WebRTC gây ra **Bufferbloat** (nghẽn hàng đợi trên router). Đồng thời, nén 60 FPS ở độ phân giải Full HD làm quá tải nhẹ bộ mã hóa GPU Intel.
  * *Khắc phục*: Thay đổi cấu hình trong [browser-docker/docker-compose.yml](file:///d:/TV-Streaming-/browser-docker/docker-compose.yml):
    * Hạ tốc độ khung hình từ 60 FPS xuống **50 FPS** (`SELKIES_FRAMERATE=50`) để giảm tải 17% công việc nén cho GPU.
    * Hạ bitrate từ 25 Mbps xuống **20 Mbps** (`SELKIES_VIDEO_BITRATE=20`) để tránh Bufferbloat mạng 100Mbps.
    * Đặt hệ số nén chất lượng cao **CRF=21** (`SELKIES_H264_CRF=21`) để tối ưu hóa độ nét của ảnh và chữ.
  * *Kết quả*: Hệ thống đã được Recreate trên server, chạy mượt mà 50 FPS không còn giật lag.

* **Quyết định 3: Khắc phục lỗi giải mã video nguồn (YouTube CPU Bottleneck)**:
  * *Bối cảnh*: Khi phát video YouTube trong trình duyệt ảo, YouTube gửi định dạng VP9/AV1 khiến CPU của server bị quá tải do phải giải mã phần mềm (software decoding).
  * *Khắc phục*: Hướng dẫn người dùng cài đặt extension **enhanced-h264ify** trong Chromium ảo, tích chọn chặn VP8/VP9/AV1 để ép YouTube gửi định dạng **H.264** (được GPU Intel giải mã phần cứng VA-API mượt mà).

---

## 🚀 3. Định Hướng Trải Nghiệm (Samsung SmartView Integration)

* **Quyết định ngày 16/06/2026**: Hủy bỏ phương án phát triển Tizen App (bao gồm cả đóng gói `.wgt` và dựng Web Portal LAN).
* **Lý do**: Lõi trình duyệt của TV Samsung cũ (Tizen 2.4 - 2016) là Chromium 38 (năm 2014) quá lạc hậu, không tương thích với bộ thư viện WebRTC/JS hiện đại của KasmVNC. Việc cài đặt app độc lập hoặc bypass SSL qua HTTP vừa phức tạp, vừa không ổn định.
* **Giải pháp thay thế**: Sử dụng tính năng truyền màn hình không dây **Samsung SmartView** (hoặc Miracast) từ máy tính/điện thoại lên TV.
* **Ưu điểm**:
  * Đơn giản, không cần cài đặt phần mềm phụ lên TV.
  * Tận dụng được trình duyệt ảo Chromium đã tối ưu hóa mượt mà (50 FPS, 20 Mbps, GPU Intel VA-API) đang chạy ổn định trên Server `192.168.1.218:8086`.
  * PC/Điện thoại đóng vai trò là remote điều khiển mượt mà, TV làm màn hình phát lớn.
