import { Offer, OfferAiCheckResult } from '../types';
import { OFFER_PHOTO_ANGLE_LABELS, OFFER_PHOTO_ANGLES } from './qaRules';

/** One approval gate for creation and resubmission; old partial verdicts never auto-pass. */
export function offerAiCanAutoApprove(ai?: OfferAiCheckResult): boolean {
  return Boolean(ai?.passed && !ai.hasAnomaly
    && ai.edoChecked && ai.edoValid && ai.edoAnomaly === false
    && ai.edoDocumentType === 'EDO' && ai.edoMatchesRegistration === true
    && ai.edoActualContainerNumber && ai.edoActualCarrierCode && ai.edoActualContainerType
    && !ai.edoMismatchDetails?.length
    && ai.photoChecked && ai.photoStatus === 'MATCHED' && ai.matchesRegistration === true
    && ai.actualContainerNumber && ai.actualContainerType && ai.actualCarrierCode
    && ai.photoCondition && ai.photoConditionNotes && !ai.mismatchDetails?.length
    && ai.verificationStatus === 'VERIFIED');
}

/** True when the AI has actually produced a photo-comparison result. */
export function hasOfferPhotoAiResult(ai?: OfferAiCheckResult): boolean {
  return Boolean(
    ai && (
      ai.photoChecked !== undefined
      || ai.photoStatus !== undefined
      || ai.photoCondition !== undefined
      || ai.photoConditionNotes
      || ai.actualConditionNotes
      || ai.missingAngles?.length
      || ai.actualContainerNumber
      || ai.actualContainerType
      || ai.actualCarrierCode
      || ai.matchesRegistration !== undefined
    ),
  );
}

/**
 * Compact evidence for the Ops queue. Keep the detail useful for a decision,
 * but bounded so a card does not become a full AI transcript.
 */
export function getOfferAiReviewEvidence(offer: Offer): string[] {
  const ai = offer.aiCheck;
  if (!ai) return [];

  const evidence: string[] = [];
  const add = (value?: string) => {
    const text = String(value || "").trim();
    if (!text) return;
    const duplicate = evidence.some(
      (item) => item.toLocaleLowerCase() === text.toLocaleLowerCase(),
    );
    if (duplicate) return;
    evidence.push(text.length > 180 ? `${text.slice(0, 177)}...` : text);
  };

  const edoNeedsReview = Boolean(
    ai.edoAnomaly ||
      ai.edoValid === false ||
      ai.edoMatchesRegistration === false ||
      (ai.edoDocumentType && ai.edoDocumentType !== "EDO"),
  );
  if (edoNeedsReview) {
    (ai.edoMismatchDetails || []).slice(0, 2).forEach(add);
    if (!ai.edoMismatchDetails?.length) add(ai.anomalyReason);
    const edoIdentity = [
      ai.edoActualContainerNumber,
      ai.edoActualCarrierCode,
      ai.edoActualContainerType,
    ]
      .filter(Boolean)
      .join(" · ");
    if (edoIdentity) {
      add(
        `eDO đọc được: ${edoIdentity}. Offer đăng ký: ${offer.asset.containerNumber} · ${offer.asset.carrierCode} · ${offer.asset.containerType}.`,
      );
    }
    if (!evidence.length)
      add("eDO chưa được xác minh đầy đủ hoặc có dấu hiệu bất thường.");
  }

  const photoNeedsReview = Boolean(
    ai.photoStatus && ai.photoStatus !== "MATCHED" ||
    ai.matchesRegistration === false ||
      ai.missingAngles?.length ||
      ai.mismatchDetails?.length,
  );
  if (photoNeedsReview) {
    if (ai.missingAngles?.length) {
      const missingLabels = ai.missingAngles.map((angle) => {
        const index = OFFER_PHOTO_ANGLES.indexOf(angle as typeof OFFER_PHOTO_ANGLES[number]);
        return OFFER_PHOTO_ANGLE_LABELS[index] || angle;
      });
      add(`Thiếu góc ảnh bắt buộc: ${missingLabels.join(', ')}.`);
    }
    (ai.mismatchDetails || []).slice(0, 2).forEach(add);
    const photoIdentity = [
      ai.actualContainerNumber,
      ai.actualCarrierCode,
      ai.actualContainerType,
    ]
      .filter(Boolean)
      .join(" · ");
    if (photoIdentity) {
      add(
        `Ảnh đọc được: ${photoIdentity}. Offer đăng ký: ${offer.asset.containerNumber} · ${offer.asset.carrierCode} · ${offer.asset.containerType}.`,
      );
    }
  }

  if (ai.photoConditionNotes) add(`Tình trạng thực tế: ${ai.photoConditionNotes}`);
  if (evidence.length < 3) (ai.details || []).slice(0, 2).forEach(add);
  if (evidence.length < 2) add(ai.summary);

  return evidence.slice(0, 4);
}

/** Short Vietnamese title used by Ops to understand why an offer needs attention. */
export function getOfferAiConditionTitle(offer: Offer): string {
  const ai = offer.aiCheck;
  if (ai?.photoStatus === 'INSPECTION_INCOMPLETE' || ai?.missingAngles?.length) {
    return 'Thiếu góc ảnh container bắt buộc cần bổ sung';
  }
  if (!ai) return 'Chưa nhận được kết quả AI đối chiếu ảnh container';

  // Luôn ưu tiên kết quả định danh có cấu trúc. Không suy diễn "không khớp"
  // từ summary vì summary hợp lệ thường vẫn nhắc đến mã số container để mô tả
  // rằng mã đã được đọc và đối chiếu thành công.
  if (ai.edoValid === false || ai.edoAnomaly) return 'eDO có dấu hiệu cần Ops xác minh';
  const mismatchDetails = ai.mismatchDetails || [];
  if (ai.photoStatus === 'MISMATCH' || (ai.matchesRegistration === false && mismatchDetails.length > 0)) {
    const identityEvidence = mismatchDetails.join(' ').toLowerCase();
    if (/mã số|số cont|container number|container no/.test(identityEvidence) && /không khớp|không chính xác|mismatch|sai lệch/.test(identityEvidence)) {
      return 'Mã số container không khớp thông tin đăng ký';
    }
    if (/hàng|hãng/.test(identityEvidence)) return 'Hãng tàu trên ảnh không khớp thông tin đăng ký';
    if (/loại/.test(identityEvidence)) return 'Loại container trên ảnh không khớp thông tin đăng ký';
    if (/tình trạng|hư hỏng|xước|móp|rỉ/.test(identityEvidence)) return 'Tình trạng thực tế khác với khai báo';
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
  if (/số cont|mã cont|container number/.test(evidence) && /không khớp|không chính xác|mismatch|sai lệch số|lệch số cont/.test(evidence)) {
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
