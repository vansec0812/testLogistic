// ==============================================================================
// ECont Transaction State Machine & Guards - Version 2.0
// Tuân thủ SRS mục 4.4, agent.md mục 8 và plan.md mục 6.1
// ==============================================================================

import { Transaction, TransactionStatus } from '../types';

export interface TransitionResult {
  allowed: boolean;
  nextStatus?: TransactionStatus;
  reason?: string;
  blockingReasons?: string[];
  nextAction?: string;
}

/**
 * Kiểm tra xem giao dịch có thể chuyển sang targetStatus không.
 * Mọi endpoint/job/UI đều gọi cùng hàm này - không bypass.
 */
export function canTransitionTo(
  txn: Transaction,
  targetStatus: TransactionStatus,
  actorCompanyId?: string,
  actorEmail?: string
): TransitionResult {
  const blocking: string[] = [];

  // Bất biến: ON_HOLD chặn tất cả trừ CANCELLED
  if (txn.isOnHold && targetStatus !== 'CANCELLED') {
    return {
      allowed: false,
      reason: `Giao dịch đang bị TẠM DỪNG (${txn.holdReason || 'Đang xử lý sự cố'}). Vui lòng giải quyết Case liên quan trước khi tiếp tục.`,
      blockingReasons: [txn.holdReason || 'Đang xử lý sự cố'],
    };
  }

  // COMPLETED không thể hủy hoặc reject
  if (txn.status === 'COMPLETED' && (targetStatus === 'CANCELLED' || targetStatus === 'REJECTED' || targetStatus === 'EXPIRED')) {
    return {
      allowed: false,
      reason: 'Giao dịch COMPLETED không thể hủy hoặc từ chối ngược lại. Nếu cần điều chỉnh, hãy tạo Case.',
    };
  }

  // Kiểm tra deadline hết hạn
  const dueAt = new Date(txn.dueAt).getTime();
  const nowMs = Date.now();

  switch (targetStatus) {
    case 'PENDING_CARRIER': {
      if (txn.status !== 'NEGOTIATING') {
        return { allowed: false, reason: `Chỉ chuyển sang chờ hãng từ trạng thái NEGOTIATING (hiện: ${txn.status}).` };
      }
      // Kiểm tra deadline giữ chỗ
      if (nowMs > dueAt) {
        blocking.push('Đồng hồ giữ chỗ 30 phút đã hết. Giao dịch sẽ EXPIRED.');
      }
      // Kiểm tra hai bên đã ký cùng version/hash
      const currentAgreement = txn.agreements.find(a => a.version === txn.currentAgreementVersion);
      if (!currentAgreement) {
        blocking.push('Không tìm thấy phiên bản Thỏa thuận hiện tại.');
      } else {
        if (!currentAgreement.companyAAcceptedAt) {
          blocking.push('Bên A chưa ký chấp thuận Thỏa thuận v' + txn.currentAgreementVersion);
        }
        if (!currentAgreement.companyBAcceptedAt) {
          blocking.push('Bên B chưa ký chấp thuận Thỏa thuận v' + txn.currentAgreementVersion);
        }
        // BR01: Kiểm tra không phải cùng actor ký cả hai bên
        if (
          currentAgreement.companyAAcceptedBy &&
          currentAgreement.companyBAcceptedBy &&
          currentAgreement.companyAAcceptedBy === currentAgreement.companyBAcceptedBy
        ) {
          blocking.push('SAME_ACTOR_BOTH_PARTIES: Cùng một người không được ký cả Bên A và Bên B.');
        }
        // BR01: Kiểm tra không cùng company
        if (
          currentAgreement.companyACompanyId &&
          currentAgreement.companyBCompanyId &&
          currentAgreement.companyACompanyId === currentAgreement.companyBCompanyId
        ) {
          blocking.push('Bên A và Bên B không thể là cùng một công ty.');
        }
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'PENDING_CARRIER',
        nextAction: 'Chờ bộ phận Vận hành (Ops) tiếp nhận và thẩm định văn bản RU từ Hãng tàu.',
      };
    }

    case 'AWAITING_PAYMENT': {
      if (txn.status !== 'PENDING_CARRIER') {
        return { allowed: false, reason: `Chỉ chuyển sang AWAITING_PAYMENT từ PENDING_CARRIER (hiện: ${txn.status}).` };
      }
      // Kiểm tra deadline PENDING_CARRIER
      if (nowMs > dueAt) {
        blocking.push('Đồng hồ 4 giờ PENDING_CARRIER đã hết. Giao dịch sẽ EXPIRED.');
      }
      if (!txn.carrierApproval) {
        blocking.push('Chưa có Carrier Approval.');
      } else if (txn.carrierApproval.status !== 'APPROVED') {
        blocking.push(`Carrier Approval hiện ở trạng thái ${txn.carrierApproval.status}, cần APPROVED.`);
      } else {
        // Kiểm tra hạn approval
        if (txn.carrierApproval.expiresAt && nowMs > new Date(txn.carrierApproval.expiresAt).getTime()) {
          blocking.push('Carrier Approval đã hết hạn. Cần xin approval mới.');
        }
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'AWAITING_PAYMENT',
        nextAction: 'Bên A và Bên B tiến hành thanh toán nghĩa vụ tài chính qua hệ thống ECont.',
      };
    }

    case 'READY_FOR_PICKUP': {
      if (txn.status !== 'AWAITING_PAYMENT') {
        return { allowed: false, reason: `Chỉ phát phiếu từ AWAITING_PAYMENT (hiện: ${txn.status}).` };
      }
      if (nowMs > dueAt) {
        blocking.push('Đồng hồ 2 giờ AWAITING_PAYMENT đã hết. Tiền đến muộn vào suspense.');
      }
      // Kiểm tra cả hai bên đã thanh toán đủ
      const paidA = txn.paymentOrderA?.status === 'PAID';
      const paidB = txn.paymentOrderB?.status === 'PAID';
      if (!paidA) {
        blocking.push('Bên A chưa hoàn tất thanh toán (cần PAID, hiện: ' + (txn.paymentOrderA?.status ?? 'chưa có lệnh') + ')');
      }
      if (!paidB) {
        blocking.push('Bên B chưa hoàn tất thanh toán (cần PAID, hiện: ' + (txn.paymentOrderB?.status ?? 'chưa có lệnh') + ')');
      }
      // Carrier approval vẫn phải còn hiệu lực
      if (txn.carrierApproval?.status !== 'APPROVED') {
        blocking.push('Carrier Approval không còn hợp lệ.');
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'READY_FOR_PICKUP',
        nextAction: 'Đã phát hành Phiếu điều phối (Dispatch Permit). Tài xế chuẩn bị phương tiện đến kho A nhận cont.',
      };
    }

    case 'INSPECTION': {
      if (txn.status !== 'READY_FOR_PICKUP') {
        return { allowed: false, reason: `Phải có Phiếu điều phối hợp lệ mới được tiến hành kiểm tra (hiện: ${txn.status}).` };
      }
      if (!txn.dispatchPermit || txn.dispatchPermit.status !== 'ACTIVE') {
        blocking.push('Phiếu điều phối không hợp lệ hoặc đã bị thu hồi.');
      }
      if (txn.dispatchPermit?.status === 'ACTIVE') {
        const permitExpiry = new Date(txn.dispatchPermit.validUntil).getTime();
        if (nowMs > permitExpiry) {
          blocking.push('Phiếu điều phối đã hết hạn. Cần xem xét lại.');
        }
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'INSPECTION',
        nextAction: 'Đại diện Bên B kiểm tra thực tế 6 mặt cont tại kho A và ghi nhận biên bản.',
      };
    }

    case 'HANDOVER_PENDING': {
      if (txn.status !== 'INSPECTION') {
        return { allowed: false, reason: `Chỉ chuyển sang chờ bàn giao sau khi hoàn tất kiểm tra (hiện: ${txn.status}).` };
      }
      if (!txn.inspection) {
        blocking.push('Chưa có biên bản kiểm tra thực địa.');
      } else {
        // QA: tại handover hai bên chọn Confirm hoặc Dispute. Không tự chặn
        // chỉ vì checklist có ghi nhận khác biệt; Dispute do bên nhận mở.
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'HANDOVER_PENDING',
        nextAction: 'Chờ đại diện Bên A xác nhận đã giao và Bên B xác nhận đã nhận cùng biên bản (cùng version/hash).',
      };
    }

    case 'COMPLETED': {
      if (txn.status !== 'HANDOVER_PENDING') {
        return { allowed: false, reason: `Giao dịch chưa ở trạng thái HANDOVER_PENDING (hiện: ${txn.status}).` };
      }
      const record = txn.handoverRecord;
      if (!record) {
        blocking.push('Chưa có Biên bản bàn giao (HandoverRecord).');
      } else {
        if (!record.confirmationA) {
          blocking.push('Bên A chưa xác nhận đã giao. (Người có quyền xác nhận giao của Bên A)');
        }
        if (!record.confirmationB) {
          blocking.push('Bên B chưa xác nhận đã nhận. (Người có quyền xác nhận nhận của Bên B)');
        }
        // Kiểm tra cùng version/hash
        if (record.confirmationA && record.confirmationB) {
          if (record.confirmationA.recordVersion !== record.confirmationB.recordVersion) {
            blocking.push('Hai bên xác nhận khác phiên bản biên bản. Cần cùng ký một phiên bản.');
          }
          if (record.confirmationA.recordHash !== record.confirmationB.recordHash) {
            blocking.push('Mã băm biên bản không khớp giữa hai bên. Biên bản bị sửa đổi sau khi ký.');
          }
          // BR18: Không cùng actor/company
          if (record.confirmationA.confirmedBy === record.confirmationB.confirmedBy) {
            blocking.push('SAME_ACTOR_BOTH_PARTIES: Cùng một người không được xác nhận cả Bên A và Bên B.');
          }
          if (record.confirmationA.companyId === record.confirmationB.companyId) {
            blocking.push('Hai xác nhận phải đến từ hai công ty khác nhau.');
          }
        }
      }

      if (blocking.length > 0) {
        return { allowed: false, reason: blocking[0], blockingReasons: blocking };
      }
      return {
        allowed: true,
        nextStatus: 'COMPLETED',
        nextAction: 'Giao dịch hoàn tất thành công. Quyền quản lý vận hành cont (Custody) đã chuyển giao sang Bên B.',
      };
    }

    case 'REJECTED': {
      // Carrier từ chối RU - chỉ từ PENDING_CARRIER
      if (txn.status !== 'PENDING_CARRIER') {
        return { allowed: false, reason: 'REJECTED chỉ áp dụng khi đang PENDING_CARRIER.' };
      }
      return {
        allowed: true,
        nextStatus: 'REJECTED',
        nextAction: 'Hãng tàu từ chối duyệt RU. Xử lý phân bổ và hoàn tiền (nếu có) theo hiện trạng.',
      };
    }

    case 'EXPIRED': {
      if (txn.status === 'COMPLETED') {
        return { allowed: false, reason: 'COMPLETED không thể EXPIRED.' };
      }
      return {
        allowed: true,
        nextStatus: 'EXPIRED',
        nextAction: 'Giao dịch đã hết hạn. Xử lý nghĩa vụ tài chính và giải phóng giữ chỗ.',
      };
    }

    case 'CANCELLED': {
      if (txn.status === 'COMPLETED') {
        return {
          allowed: false,
          reason: 'Giao dịch COMPLETED không thể CANCELLED. Nếu cần điều chỉnh, hãy tạo Case/Adjustment.',
        };
      }
      return {
        allowed: true,
        nextStatus: 'CANCELLED',
        nextAction: 'Giao dịch bị hủy. Thu hồi phiếu điều phối, xử lý hoàn tiền (nếu có), xác minh hiện trạng trước release.',
      };
    }

    default:
      return { allowed: false, reason: `Trạng thái chuyển đổi không được xác định: ${targetStatus}` };
  }
}

/**
 * Lấy danh sách allowed actions cho một giao dịch theo role
 */
export function getAllowedActions(
  txn: Transaction,
  role: 'ENTERPRISE_A' | 'ENTERPRISE_B' | 'OPS' | 'FINANCE' | 'SUPER_ADMIN',
  companyId: string
): string[] {
  const actions: string[] = [];
  const isPartyA = txn.companyAId === companyId && (role === 'ENTERPRISE_A');
  const isPartyB = txn.companyBId === companyId && (role === 'ENTERPRISE_B');
  const isOps = role === 'OPS' || role === 'SUPER_ADMIN';
  const isFinance = role === 'FINANCE' || role === 'SUPER_ADMIN';

  if (txn.isOnHold) {
    if (isOps) actions.push('RELEASE_HOLD');
    return actions;
  }

  switch (txn.status) {
    case 'NEGOTIATING':
      if (isPartyA) {
        const currentAgreement = txn.agreements.find(a => a.version === txn.currentAgreementVersion);
        if (!currentAgreement?.companyAAcceptedAt) {
          actions.push('ACCEPT_AGREEMENT_A');
        }
      }
      if (isPartyB) {
        const currentAgreement = txn.agreements.find(a => a.version === txn.currentAgreementVersion);
        if (!currentAgreement?.companyBAcceptedAt) {
          actions.push('ACCEPT_AGREEMENT_B');
        }
      }
      if (isPartyA || isPartyB) {
        actions.push('REQUEST_AGREEMENT_CHANGE');
        actions.push('CANCEL_TRANSACTION');
      }
      break;

    case 'PENDING_CARRIER':
      if (isOps) {
        actions.push('RECORD_CARRIER_APPROVAL');
        actions.push('RECORD_CARRIER_REJECTION');
        actions.push('PUT_ON_HOLD');
      }
      if (isPartyA || isPartyB) {
        actions.push('CANCEL_TRANSACTION');
      }
      break;

    case 'AWAITING_PAYMENT':
      if (isFinance) {
        if (txn.paymentOrderA?.status !== 'PAID') actions.push('SETTLE_PAYMENT_A');
        if (txn.paymentOrderB?.status !== 'PAID') actions.push('SETTLE_PAYMENT_B');
      }
      if (isOps) {
        actions.push('PUT_ON_HOLD');
        actions.push('CANCEL_TRANSACTION');
      }
      break;

    case 'READY_FOR_PICKUP':
      if (isOps) {
        actions.push('ACTIVATE_INSPECTION');
        actions.push('PUT_ON_HOLD');
      }
      break;

    case 'INSPECTION':
      if (isPartyB) {
        actions.push('SUBMIT_INSPECTION');
      }
      if (isOps) {
        actions.push('PUT_ON_HOLD');
      }
      break;

    case 'HANDOVER_PENDING':
      if (isPartyA && !txn.handoverRecord?.confirmationA) {
        actions.push('CONFIRM_HANDOVER_A');
      }
      if (isPartyB && !txn.handoverRecord?.confirmationB) {
        actions.push('CONFIRM_HANDOVER_B');
      }
      if (isOps) {
        actions.push('PUT_ON_HOLD');
      }
      break;

    case 'COMPLETED':
      actions.push('VIEW_HISTORY');
      if (isPartyA || isPartyB) {
        actions.push('SUBMIT_RATING');
      }
      if (isFinance) {
        actions.push('PROCESS_REFUND');
      }
      break;
  }

  return actions;
}
