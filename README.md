# PHX Attendance Dashboard & Analytics

Hệ thống trực quan hóa & đối soát dữ liệu điểm danh học sinh đa chiều (Multi-touchpoint Student Attendance Analysis), hỗ trợ điều hành Ban Giám Hiệu, Văn phòng Học vụ và Giáo viên Chủ nhiệm (GVCN).

🌐 **Live Demo on GitHub Pages**: [https://n4tsukii.github.io/phx-attendance-dashboard/](https://n4tsukii.github.io/phx-attendance-dashboard/)

---

## 🎯 Tính năng chính

1. **Chỉ số điều hành cấp cao (Executive KPI Strip)**:
   - Tỷ lệ chuyên cần trong lớp (ADA - Average Daily Attendance).
   - Tỷ lệ có mặt tại cổng trường (Gate Arrival Rate).
   - Tỷ lệ hoàn thành sổ đầu bài & điểm danh tiết (Lesson Attendance Completion).
   - Tỷ lệ dùng bữa bán trú & đi xe buýt trường học.

2. **Cơ chế Bảo toàn Sĩ số & 8 Mốc điểm danh trong ngày (Timeline Touchpoints)**:
   - Đối soát bảo toàn sĩ số qua từng chặng:
     - `01. Đón xe Bus sáng`
     - `02. Cổng trường vào sáng`
     - `03. Điểm danh lớp sáng (SĐB)`
     - `04. Bếp ăn trưa bán trú`
     - `05. Điểm danh lớp chiều`
     - `06. Cổng trường ra chiều`
     - `07. Lên xe Bus về`
     - `08. Trả xe Bus cuối ngày`
   - Nhận diện phân kỳ dữ liệu (sĩ số đủ điều kiện theo từng dịch vụ đăng ký).

3. **Cây nguyên nhân thiếu điểm danh (Root Cause Tree)**:
   - Phân rã nguyên nhân: Nghỉ học có phép / Không phép, Học sinh không đi Bus / Bán trú, Quên quẹt thẻ cổng, Lớp chưa mở sổ đầu bài.

4. **Đối soát Luồng Cổng vào / Cổng ra & Độ trễ quét thẻ**:
   - Biểu đồ Sankey / Bar chart đối soát tín hiệu cổng: Vào & Ra hợp lệ, Chỉ vào không ra, Chỉ ra không vào, Không có tín hiệu.
   - Phân tích độ trễ quẹt thẻ theo khung giờ cao điểm (Morning Peak 06:45 - 07:45).

5. **Bản đồ nhiệt theo Lớp (Heatmap)** & **Bảng tác nghiệp GVCN (Worklist)**:
   - Danh sách lớp chưa hoàn thành điểm danh tiết, vi phạm quy chế hoặc có học sinh vắng bất thường.
   - Hỗ trợ lọc theo Trường (Ban Mai, Phenikaa), Khối lớp (Khối 1 - 12), Buổi học (Sáng, Chiều).
   - Xuất dữ liệu báo cáo dạng CSV chuẩn UTF-8 BOM trực tiếp trên trình duyệt.

---

## 🛠️ Công nghệ sử dụng

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Biểu đồ & Trực quan hóa**: Apache ECharts (`echarts`), Lucide Icons
- **Static Export & Zero-Server Deployment**: Tích hợp snapshot dữ liệu thực tế giúp web hoạt động 24/7 trên GitHub Pages mà không cần kết nối máy chủ database nội bộ.
- **CI/CD**: GitHub Actions tự động build và deploy lên GitHub Pages khi push code.

---

## 🚀 Hướng dẫn chạy Local

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy môi trường phát triển (Port 3002)
npm run dev

# 3. Build Static Export (GitHub Pages)
npm run build:export
```
