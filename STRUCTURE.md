# Cấu Trúc Dự Án (Project Structure)

Dự án **Virtual Browser Streaming** được thiết kế tối giản, tập trung vào giải pháp trình duyệt ảo bảo mật và hiệu năng cao. Dưới đây là mô tả chi tiết sơ đồ thư mục và chức năng của từng tệp tin trong mã nguồn.

---

## Sơ đồ thư mục (File Tree)

```text
tv-streaming/
├── .gitignore                   # Cấu hình bỏ qua các file log và file tạm khi commit Git
├── LICENSE                      # Giấy phép bản quyền mã nguồn mở MIT
├── README.md                    # Tài liệu hướng dẫn cài đặt, cấu hình GPU và tối ưu hóa xem video
├── STRUCTURE.md                 # Tài liệu mô tả cấu trúc thư mục dự án
└── browser-docker/              # Thư mục cấu hình cho Docker Chromium
    ├── docker-compose.yml       # Định nghĩa container Chromium, ánh xạ cổng, GPU và các thông số WebRTC
    └── optimization_notes.md    # Nhật ký tối ưu hóa 50 FPS, GPU Hardware Encoding và chẩn đoán mạng
```
