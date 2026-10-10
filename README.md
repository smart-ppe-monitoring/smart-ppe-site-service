# smart-ppe-site-service

> **Site Management Microservice** cho Hệ thống Giám sát An toàn Lao động Thông minh (**Smart PPE Monitoring System**), phụ trách quản lý công trường, khu vực (zones), vùng hạn chế nguy hiểm (restricted area polygons) và cấu hình ngưỡng an toàn AI (SiteSafetyConfig) theo chuẩn **D08.pdf (Mục 3.5 & Task BE-04)**.

---

## 🏛️ Trách nhiệm nghiệp vụ

- **Quản lý công trường (`/api/v1/sites`)**: CRUD thông tin dự án, mã công trường, thời gian thi công và trạng thái.
- **Quản lý phân khu (`/api/v1/zones`)**: Chia nhỏ công trường thành các zone độc lập, kiểm tra quan hệ phân cấp chặt chẽ.
- **Vùng nguy hiểm (`/api/v1/restricted-areas`)**: Quản lý tọa độ đa giác polygon (min 3 đỉnh, max 50 đỉnh, chuẩn hóa float) phục vụ thuật toán Ray Casting kiểm tra xâm nhập.
- **Cấu hình an toàn AI (`/api/v1/sites/:id/safety-config`)**: Tự động cấp cấu hình an toàn khi tạo công trường (Confidence Threshold: 0.8, Confirmation: 2s, Cooldown: 30s) theo nguyên tắc Fail-Safe.

---

## 🚀 Khởi chạy cục bộ (Local Development)

```bash
# 1. Cài đặt dependencies
pnpm install

# 2. Cấu hình biến môi trường
cp .env.example .env

# 3. Sinh Prisma Client từ schema
pnpm run prisma:generate

# 4. Khởi chạy chế độ phát triển
pnpm run dev
# Server lắng nghe tại http://localhost:8891
```

---

## 🧪 Kiểm thử tự động (Unit Tests)

```bash
pnpm test
```

---

## 🐳 Triển khai Docker

```bash
docker build -t smart-ppe-site-service .
docker run -p 8891:8891 --env-file .env smart-ppe-site-service
```
