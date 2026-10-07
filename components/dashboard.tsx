'use client';

import { useEffect, useRef, useState } from 'react';
import { GraduationCap, LayoutDashboard, ListChecks, Info, X, ShieldCheck } from 'lucide-react';
import AttendanceDashboard from './attendance-dashboard';

export default function Dashboard() {
  const [infoOpen, setInfoOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (infoOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!infoOpen && dialog.current?.open) dialog.current.close();
  }, [infoOpen]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="PHX · Theo dõi điểm danh">
          <span className="brand-icon"><GraduationCap size={24}/></span>
          <span>PHX<small>SCHOOL OPERATIONS</small></span>
        </a>
        <div className="workspace"><span className="workspace-dot"/>Không gian điểm danh<small>Vận hành trường học K12</small></div>
        <p className="nav-label">THEO DÕI & ĐỐI CHIẾU</p>
        <nav aria-label="Điều hướng dashboard">
          <a className="nav-item active" href="#overview" aria-label="Tổng quan điểm danh"><LayoutDashboard size={18}/><span>Tổng quan điểm danh</span></a>
          <a className="nav-item" href="#attendance-details" aria-label="Chi tiết & kiểm tra"><ListChecks size={18}/><span>Chi tiết & kiểm tra</span></a>
          <button className="nav-item" onClick={() => setInfoOpen(true)} aria-label="Cách đọc chỉ báo"><Info size={18}/><span>Cách đọc chỉ báo</span></button>
        </nav>
        <div className="side-note"><ShieldCheck size={22}/><strong>Theo dõi để hành động</strong><p>Nhận biết phần chưa hoàn thành và dữ liệu cần xác minh trước khi sử dụng báo cáo.</p></div>
        <div className="sidebar-bottom"><span className="workspace-dot"/>Điểm danh · Sổ đầu bài</div>
      </aside>
      <div className="main-shell">
        <header className="topbar"><span>Vận hành trường học <span className="breadcrumb-separator">/</span> <strong>Điểm danh</strong></span><span className="environment">Dữ liệu staging</span></header>
        <main><AttendanceDashboard onOpenBusinessGoals={() => setInfoOpen(true)}/></main>
      </div>
      <dialog className="definitions-dialog" ref={dialog} onCancel={() => setInfoOpen(false)} onClose={() => setInfoOpen(false)} aria-labelledby="definitions-title">
        <div className="dialog-heading"><span className="eyebrow">CÁCH ĐỌC DASHBOARD</span><button className="icon-button" onClick={() => setInfoOpen(false)} aria-label="Đóng hướng dẫn"><X size={20}/></button></div>
        <h2 id="definitions-title">Hiểu đúng các chỉ báo điểm danh</h2>
        <p className="muted">Theo dõi trạng thái phân công theo tiết và tiến độ ghi sổ đầu bài trong phạm vi đang chọn.</p>
        <dl className="definitions">
          <div><dt>Tỷ lệ hoàn thành điểm danh</dt><dd>Số lượt có trạng thái HOAN_THANH chia cho tổng HOAN_THANH, DEN_GIO và TRONG_TIET. Nhóm này dựa trên trạng thái hiện có; chưa đo việc điểm danh đúng hạn hay trong 5 phút đầu tiết.</dd></div>
          <div><dt>Chờ cập nhật điểm danh</dt><dd>Số lượt DEN_GIO và TRONG_TIET. Bản ghi đang trong tiết có thể vẫn đang được xử lý; cần đối chiếu lịch học trước khi kết luận bỏ sót.</dd></div>
          <div><dt>Sổ đầu bài chưa nhập</dt><dd>Các lượt có trạng thái khác DA_NHAP. Biểu đồ tháng nhóm theo ngày của tiết học, mô tả trạng thái ở lần cập nhật hiện tại.</dd></div>
          <div><dt>Vấn đề dữ liệu</dt><dd>Số lượt vi phạm quy tắc cần xác minh. Một bản ghi có thể vi phạm nhiều quy tắc, nên tổng này không phải số tiết hay số học sinh bị ảnh hưởng.</dd></div>
          <div><dt>Phạm vi ngày</dt><dd>Điểm danh, sổ đầu bài và loại tiết dùng ngày tiết học theo UTC+7. Đánh giá dùng ngày tạo đánh giá; vấn đề dữ liệu dùng ngày gắn với quy tắc. Bản ghi chưa rõ ngày được tách riêng khi lọc khoảng ngày.</dd></div>
          <div><dt>Chuyên cần học sinh</dt><dd>Dashboard hiện theo dõi quá trình ghi nhận điểm danh theo tiết. Chỉ báo có mặt, vắng hoặc đi muộn theo học sinh cần thêm trạng thái chi tiết và xác nhận tiết đã được chốt.</dd></div>
        </dl>
      </dialog>
    </div>
  );
}
