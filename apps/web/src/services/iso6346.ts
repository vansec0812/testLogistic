// ==============================================================================
// ISO 6346 Standard Container Check Digit Calculator & Validator
// Tuân thủ quy tắc BR07 & BR08 của SRS v1.0
// ==============================================================================

const CHAR_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
};

export function calculateCheckDigit(containerNumber10: string): number | null {
  const clean = containerNumber10.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 10) return null;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = clean[i];
    let val: number;
    if (char >= '0' && char <= '9') {
      val = parseInt(char, 10);
    } else if (CHAR_VALUES[char] !== undefined) {
      val = CHAR_VALUES[char];
    } else {
      return null;
    }
    const weight = Math.pow(2, i);
    sum += val * weight;
  }

  const remainder = sum % 11;
  return remainder === 10 ? 0 : remainder;
}

export function validateContainerNumber(containerNumber11: string): {
  isValid: boolean;
  expectedCheckDigit?: number;
  actualCheckDigit?: number;
  message?: string;
} {
  const clean = containerNumber11.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 11) {
    return {
      isValid: false,
      message: 'Mã container phải bao gồm đúng 11 ký tự (4 chữ cái + 7 chữ số).'
    };
  }

  const prefix4 = clean.slice(0, 4);
  if (!/^[A-Z]{4}$/.test(prefix4)) {
    return {
      isValid: false,
      message: '4 ký tự đầu phải là chữ cái in hoa (Mã chủ sở hữu + loại thiết bị).'
    };
  }

  const first10 = clean.slice(0, 10);
  const actualCheckDigit = parseInt(clean[10], 10);
  const expectedCheckDigit = calculateCheckDigit(first10);

  if (expectedCheckDigit === null || actualCheckDigit !== expectedCheckDigit) {
    return {
      isValid: false,
      expectedCheckDigit: expectedCheckDigit ?? undefined,
      actualCheckDigit,
      message: `Số kiểm tra không khớp (Ký tự thứ 11: ${actualCheckDigit}, chuẩn ISO tính được: ${expectedCheckDigit}).`
    };
  }

  return {
    isValid: true,
    expectedCheckDigit,
    actualCheckDigit,
    message: 'Mã container hợp lệ chuẩn ISO 6346.'
  };
}

