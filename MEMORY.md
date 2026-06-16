# Tài Liệu Quản Lý Bộ Nhớ (Memory Management & Optimization)

Tài liệu này giải thích chi tiết kiến trúc quản lý tài nguyên bộ nhớ (RAM) của Node.js MPEG-TS Relay Server, nhằm đảm bảo hệ thống có thể chạy liên tục 24/7 trên các máy chủ có cấu hình RAM hạn chế mà không bị rò rỉ bộ nhớ (memory leak).

---

## 1. Kiến Trúc Lưu Trữ & Phân Phối Luồng

Server hoạt động trên mô hình luồng bất đồng bộ (Asynchronous Streams). Dữ liệu dạng binary chunk nhận được từ kết nối POST của FFmpeg được phân phối trực tiếp đến các client đang xem thông qua các Socket ghi (Write Sockets).

```text
               +-----------------------+
               |  FFmpeg (POST Feed)   |
               +-----------+-----------+
                           |
                           v  (Chunks)
            +--------------+--------------+
            |  Node.js Buffer Processing  |  --> Cập nhật Ring Buffer (2MB)
            +--------------+--------------+
                           |
       +-------------------+-------------------+
       |                   |                   |
       v                   v                   v
+------x------+     +------x------+     +------x------+
| Client 1    |     | Client 2    |     | Client N    |  (GET /live/:id)
| (VLC / TV)  |     | (VLC / TV)  |     | (VLC / TV)  |
+-------------+     +-------------+     +-------------+
```

---

## 2. Giải Pháp Ring Buffer 2MB (Bộ Đệm Vòng)

### Vấn đề:
Trong luồng MPEG-TS, các bảng dữ liệu **PAT (Program Association Table)** và **PMT (Program Map Table)** mô tả cấu trúc luồng (định dạng âm thanh, hình ảnh) là bắt buộc phải có để các bộ giải mã (player) khởi động. 
* Nếu một client kết nối vào **giữa luồng stream** (khi FFmpeg đã phát được lâu), client đó sẽ phải đợi đến khi gói PAT/PMT tiếp theo được gửi tới mới có thể bắt đầu giải mã. Điều này gây trễ hoặc lỗi đen màn hình lúc mới kết nối.

### Giải pháp:
Server lưu trữ các chunk nhị phân mới nhất vào một mảng `buffer`.
* Kích thước bộ đệm được giới hạn nghiêm ngặt ở mức tối đa **2MB** (khoảng vài giây dữ liệu stream).
* Khi bộ đệm vượt quá 2MB, các chunk cũ nhất ở đầu mảng sẽ bị loại bỏ bằng phương thức `.shift()`, giải phóng bộ nhớ cho các chunk mới:
  ```javascript
  channel.buffer.push(chunk);
  let currentBufferSize = channel.buffer.reduce((acc, b) => acc + b.length, 0);
  while (currentBufferSize > 2 * 1024 * 1024 && channel.buffer.length > 0) {
    const removed = channel.buffer.shift();
    currentBufferSize -= removed.length;
  }
  ```
* Khi client mới kết nối, toàn bộ 2MB đệm này sẽ được ghi ghi ngay lập tức (`res.write(cachedChunk)`) trước khi chuyển tiếp dữ liệu live, giúp TV nhận ngay các bảng PAT/PMT và giải mã lập tức.

---

## 3. Cơ Chế Chống Rò Rỉ Bộ Nhớ (Leak Prevention)

### A. Quản lý Vòng đời Client (GET Client Lifecycle)
Khi một client ngắt kết nối (ví dụ tắt VLC hoặc chuyển kênh trên TV), đối tượng kết nối `res` phải được dọn dẹp để bộ gom rác (Garbage Collector) của Node.js giải phóng RAM:
* Lắng nghe sự kiện `'close'` của Request:
  ```javascript
  req.on('close', () => {
    channel.clients.delete(res);
    // Nếu không còn feed phát và không còn client nào xem, xóa kênh khỏi bộ nhớ
    if (channel.clients.size === 0 && !channel.feedReq) {
      channels.delete(channelId);
    }
  });
  ```
* Điều này ngăn chặn việc tích lũy các đối tượng kết nối chết (dead connections) trong Set `clients`.

### B. Dọn dẹp khi Nguồn Phát dừng (POST Feed Lifecycle)
Khi FFmpeg dừng đẩy luồng, server cần giải phóng tất cả tài nguyên liên quan đến kênh đó:
* Giải phóng mảng `buffer` về rỗng (`channel.buffer = []`).
* Đóng kết nối của tất cả các client đang xem kênh đó một cách chủ động (`client.end()`).
* Xóa kênh ra khỏi Map `channels` toàn cục:
  ```javascript
  function cleanupChannelFeed(channelId) {
    const channel = channels.get(channelId);
    if (channel) {
      channel.feedReq = null;
      channel.buffer = [];
      for (const client of channel.clients) {
        try { client.end(); } catch (e) {}
      }
      channel.clients.clear();
      channels.delete(channelId);
    }
  }
  ```

### C. Ngăn chặn tràn bộ đệm ghi (Backpressure)
Trong trường hợp client có kết nối mạng quá chậm, không kịp tiêu thụ dữ liệu nhị phân gửi đến, Node.js sẽ lưu các chunk này vào hàng đợi ghi (writable buffer) trong RAM. 
* Hệ thống sử dụng cơ chế bảo vệ khối `try-catch` khi ghi dữ liệu. Nếu client xảy ra lỗi ghi hoặc mất kết nối ngầm, client đó sẽ lập tức bị loại khỏi danh sách phát sóng để tránh phình to hàng đợi ghi trong RAM của server.

---

## 4. Tối Ưu Hóa & Cấu Hình Docker Chromium (Browser Stream Optimization)

Ghi nhận phiên làm việc ngày **16/06/2026** về việc thiết lập và tối ưu hóa hệ thống trình duyệt ảo Docker Chromium (Selkies/KasmVNC) chạy trên Ubuntu Server `ubuntuserver01`.

### A. Kích Hoạt GPU Hardware Acceleration (VA-API Zero-Copy)
* **Vấn đề**: Trình duyệt ảo mặc định sử dụng gói driver `intel-media-va-driver` (bản DFSG - Free), không hỗ trợ tính năng mã hóa phần cứng H.264 khiến hệ thống bị ép chạy mã hóa bằng CPU, gây giật lag và hao tổn RAM/CPU cực lớn.
* **Giải pháp**: 
  1. Tạo script khởi động tự động `/config/custom-cont-init.d/install-nonfree-drivers.sh` để tự động cài đặt driver bản đầy đủ: `intel-media-va-driver-non-free`.
  2. Bổ sung cấu hình volume trong `docker-compose.yml` để kích hoạt script khởi động:
     ```yaml
     volumes:
       - ./config:/config
       - ./config/custom-cont-init.d:/custom-cont-init.d:ro
     ```
* **Kết quả**: GPU Intel HD Graphics đảm nhận toàn bộ việc nén luồng WebRTC trực tiếp từ bộ nhớ đồ họa (**Zero-Copy**), giảm tải CPU về 0-2%.

### B. Thiết Lập Độ Phân Giải & Băng Thông LAN (1080p 60fps)
* **Khóa cứng độ phân giải Full HD**: Thiết lập `SELKIES_MANUAL_WIDTH=1920`, `SELKIES_MANUAL_HEIGHT=1080` và `SELKIES_IS_MANUAL_RESOLUTION_MODE=true` để tránh crash bộ mã hóa phần cứng do các độ phân giải co giãn không chuẩn của client.
* **Tối ưu băng thông WebRTC**: 
  * `SELKIES_VIDEO_BITRATE=25` (25 Mbps) và `SELKIES_H264_CRF=20` để luồng truyền tải video mượt mà, không bị vỡ hạt trên mạng LAN.
  * Tối ưu hóa Chromium flags thông qua `CHROME_CLI` để tự động kích hoạt GPU decoding (`VaapiVideoDecoder`) và tắt giới hạn chuyển động cho cuộn mượt (smooth scroll).

### C. Kết Quả Đo Tốc Độ Mạng (iperf3)
* **Mạng LAN (`192.168.1.218`)**: Bị timeout do máy Windows Client (`10.16.237.146`) và Server (`192.168.1.218`) nằm ở 2 dải mạng/router khác nhau.
* **Mạng Tailscale (`100.80.180.36`)**: Kết nối thành công nhưng băng thông bị nghẽn ở mức **3.56 Mbps** do kết nối bị chuyển hướng qua **Tailscale Relay (DERP)** thay vì kết nối P2P trực tiếp.
* **Giải pháp**: Cần kết nối máy Windows chung một cục router Wi-Fi với server để có IP `192.168.1.x`, giúp truyền dữ liệu trực tiếp LAN cực kỳ mượt mà.
