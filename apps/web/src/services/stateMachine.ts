// ==============================================================================
// ECont Transaction State Machine & Guards
// Tuân thủ nghiêm ngặt SRS mục 4.4, agent.md mục 8 và plan.md mục 6.1
// ==============================================================================

import { Transaction, TransactionStatus } from '../types';

export interface TransitionResult {
  allowed: boolean;
  nextStatus?: TransactionStatus;
  reason?: string;
  nextAction?: string;
}

export function canTransitionTo(
  txn: Transaction,
  targetStatus: TransactionStatus
): TransitionResult {
  // Bất biến: Khi đang ON_HOLD, không được phép chuyển trạng thái bất kỳ
  if (txn.isOnHold && targetStatus !== 'CANCELLED') {
    return {
      allowed: false,
      reason: `Giao dịch đang bị TẠM DỪNG (${txn.holdReason || 'Đang xử lý sự cố'}). Vui lòng giải quyết Case trước khi tiếp tục.`
    };
  }

  switch (targetStatus) {
    case 'PENDING_CARRIER': {
      if (txn.status !== 'NEGOTIATING') {
        return { allowed: false, reason: 'Chỉ có thể chuyển sang chờ hãng tàu từ trạng thái Đang thương lượng.' };
      }
      if (!txn.companyAAcceptedAt || !txn.companyBAcceptedAt) {
        return { 
          allowed: false, 
          reason: 'Cả Bên A và Bên B phải cùng ký chấp nhận Thỏa thuận tái sử dụng (Agreement v1.0).' 
        };
      }
      return { 
        allowed: true, 
        nextStatus: 'PENDING_CARRIER',
        nextAction: 'Chờ bộ phận Vận hành (Ops) tiếp nhận và thẩm định văn bản RU từ Hãng tàu.' 
      };
    }

    case 'AWAITING_PAYMENT': {
      if (txn.status !== 'PENDING_CARRIER') {
        return { allowed: false, reason: 'Chỉ chuyển sang Chờ thanh toán khi Hãng tàu đã duyệt RU.' };
      }
      if (!txn.carrierApproval || txn.carrierApproval.status !== 'APPROVED') {
        return { 
          allowed: false, 
          reason: 'Hãng tàu chưa có văn bản phê duyệt RU hợp lệ kèm minh chứng.' 
        };
      }
      return { 
        allowed: true, 
        nextStatus: 'AWAITING_PAYMENT',
        nextAction: 'Bên A và Bên B tiến hành thanh toán nghĩa vụ tài chính qua hệ thống ECont.' 
      };
    }

    case 'READY_FOR_PICKUP': {
      if (txn.status !== 'AWAITING_PAYMENT') {
        return { allowed: false, reason: 'Chỉ phát phiếu điều phối khi đã hoàn tất nghĩa vụ tiền.' };
      }
      const paidA = txn.paymentOrderA?.status === 'SETTLED';
      const paidB = txn.paymentOrderB?.status === 'SETTLED';
      if (!paidA || !paidB) {
        return { 
          allowed: false, 
          reason: 'Chưa đủ điều kiện: Cả hai bên A và B đều phải được Tài chính xác nhận đã thanh toán.' 
        };
      }
      return { 
        allowed: true, 
        nextStatus: 'READY_FOR_PICKUP',
        nextAction: 'Đã phát hành Phiếu điều phối (Dispatch Permit). Tài xế chuẩn bị phương tiện đến kho A nhận cont.' 
      };
    }

    case 'INSPECTION': {
      if (txn.status !== 'READY_FOR_PICKUP') {
        return { allowed: false, reason: 'Phải có Phiếu điều phối hợp lệ mới được tiến hành kiểm tra cont.' };
      }
      return { 
        allowed: true, 
        nextStatus: 'INSPECTION',
        nextAction: 'Tài xế/đại diện Bên B kiểm tra thực tế 6 mặt cont tại kho A và ghi nhận biên bản.' 
      };
    }

    case 'HANDOVER_PENDING': {
      if (txn.status !== 'INSPECTION') {
        return { allowed: false, reason: 'Chỉ chuyển sang chờ ký sau khi đã hoàn tất kiểm tra cont.' };
      }
      if (!txn.inspection) {
        return { allowed: false, reason: 'Chưa có dữ liệu biên bản kiểm tra thực địa.' };
      }
      if (txn.inspection.isDiscrepancyFound) {
        return { 
          allowed: false, 
          reason: 'Phát hiện sai lệch/hư hỏng nặng tại biên bản kiểm tra. Cần lập Case giải quyết.' 
        };
      }
      return { 
        allowed: true, 
        nextStatus: 'HANDOVER_PENDING',
        nextAction: 'Chờ đại diện Bên A và Bên B cùng ký xác nhận hoàn tất bàn giao.' 
      };
    }

    case 'COMPLETED': {
      if (txn.status !== 'HANDOVER_PENDING') {
        return { allowed: false, reason: 'Giao dịch chưa ở trạng thái chờ xác nhận bàn giao cuối.' };
      }
      if (!txn.handoverAConfirmedAt || !txn.handoverBConfirmedAt) {
        return { allowed: false, reason: 'Cả Bên A và Bên B phải xác nhận bàn giao.' };
      }
      if (!txn.handoverHash) {
        return { allowed: false, reason: 'Thiếu mã băm chứng thực (Handover Hash) phiên bản thống nhất.' };
      }
      return { 
        allowed: true, 
        nextStatus: 'COMPLETED',
        nextAction: 'Giao dịch hoàn tất thành công. Quyền quản lý cont (Custody) đã được chuyển giao cho Bên B.' 
      };
    }

    case 'CANCELLED': {
      if (txn.status === 'COMPLETED') {
        return { allowed: false, reason: 'Giao dịch đã hoàn tất (COMPLETED) không thể hủy ngược lại.' };
      }
      return { 
        allowed: true, 
        nextStatus: 'CANCELLED',
        nextAction: 'Giao dịch đã bị hủy. Giải phóng giữ chỗ và chuyển hoàn tiền nếu có.' 
      };
    }

    default:
      return { allowed: false, reason: 'Trạng thái chuyển đổi không xác định.' };
  }
}
