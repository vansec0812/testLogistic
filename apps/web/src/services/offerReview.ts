import { Offer } from '../types';

/** Short Vietnamese title used by Ops to understand why an offer needs attention. */
export function getOfferAiConditionTitle(offer: Offer): string {
  const ai = offer.aiCheck;
  if (!ai) return 'Chưa nhận được kết quả AI đối chiếu ảnh container';

  // Luôn ưu tiên kết quả định danh có cấu trúc. Không suy diễn "không khớp"
  // từ summary vì summary hợp lệ thường vẫn nhắc đến mã số container để mô tả
  // rằng mã đã được đọc và đối chiếu thành công.
  if (ai.edoValid === false || ai.edoAnomaly) return 'eDO có dấu hiệu cần Ops xác minh';
  const mismatchDetails = ai.mismatchDetails || [];
  if (ai.photoStatus === 'MISMATCH' || (ai.matchesRegistration === false && mismatchDetails.length > 0)) {
    const identityEvidence = mismatchDetails.join(' ').toLowerCase();
    if (/mã số|số cont|container number|container no|không khớp|không chính xác|mismatch/.test(identityEvidence)) {
      return 'Mã số container không khớp thông tin đăng ký';
    }
    return 'Ảnh container chưa khớp đầy đủ thông tin đăng ký';
  }

  if (ai.matchesRegistration === true) {
    if (ai.photoCondition === 'MAJOR_DAMAGE') return 'Chất lượng container có vấn đề nghiêm trọng';
    if (ai.photoCondition === 'MINOR_DAMAGE') return 'Container có dấu hiệu xước hoặc hư hỏng nhẹ';
    if (ai.photoCondition === 'GOOD' && ai.photoChecked) {
      return 'Ảnh container khớp thông tin đăng ký, tình trạng đạt chuẩn';
    }
  }
  if (ai.passed && ai.photoChecked && !ai.hasAnomaly) {
    if (ai.photoCondition === 'MAJOR_DAMAGE') return 'Chất lượng container có vấn đề nghiêm trọng';
    if (ai.photoCondition === 'MINOR_DAMAGE') return 'Container có dấu hiệu xước hoặc hư hỏng nhẹ';
    return 'Ảnh container khớp thông tin đăng ký, tình trạng đạt chuẩn';
  }

  const evidence = [ai.photoConditionNotes, ai.summary, ...(ai.details || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/mờ|blur|không rõ|khó đọc|unreadable/.test(evidence)) {
    return 'Ảnh container mờ hoặc chưa đủ rõ để đối chiếu';
  }
  if (/không khớp|không chính xác|mismatch|sai lệch số|lệch số cont/.test(evidence)) {
    return 'Mã số container không khớp thông tin đăng ký';
  }
  if (ai.photoCondition === 'MAJOR_DAMAGE' || /thủng|móp nặng|rỉ sét nặng|hư hỏng nặng/.test(evidence)) {
    return 'Chất lượng container có vấn đề nghiêm trọng';
  }
  if (ai.photoCondition === 'MINOR_DAMAGE' || /xước|trầy|móp nhẹ|rỉ nhẹ|hư hỏng nhẹ/.test(evidence)) {
    return 'Container có dấu hiệu xước hoặc hư hỏng nhẹ';
  }
  if (!ai.photoChecked) return 'Chưa có kết quả đối chiếu ảnh container';
  if (ai.photoCondition === 'GOOD' && ai.photoChecked && ai.passed) {
    return 'Ảnh container khớp thông tin đăng ký, tình trạng đạt chuẩn';
  }

  const shortDescription = ai.photoConditionNotes || ai.details?.[0] || ai.summary;
  if (shortDescription) {
    return shortDescription.length > 110 ? `${shortDescription.slice(0, 107)}...` : shortDescription;
  }
  return 'AI chưa phân loại được tình trạng; Ops cần kiểm tra ảnh';
}

/** Ops queue: pending first, then approved; newest records first within each group. */
export function sortOffersForOps(offers: Offer[]): Offer[] {
  const statusRank = (offer: Offer) => offer.status === 'UNDER_REVIEW' ? 0 : offer.status === 'AVAILABLE' ? 1 : 2;
  return [...offers].sort((a, b) => {
    const rankDiff = statusRank(a) - statusRank(b);
    if (rankDiff !== 0) return rankDiff;
    const createdAtA = new Date(a.createdAt || 0).getTime() || 0;
    const createdAtB = new Date(b.createdAt || 0).getTime() || 0;
    return createdAtB - createdAtA;
  });
}
