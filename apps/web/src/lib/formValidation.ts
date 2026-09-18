import { FieldErrors } from '../components/FormValidation';
import { validateContainerNumber } from '../services/iso6346';

export const required = (value: unknown, message: string): string | undefined => {
  if (value === undefined || value === null || String(value).trim() === '') return message;
  return undefined;
};

export const positiveNumber = (value: unknown, message: string): string | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? undefined : message;
};

export const validEmail = (value: string, message = 'Email không đúng định dạng.'): string | undefined => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? undefined : message;
};

export const validPhone = (value: string, message = 'Số điện thoại không đúng định dạng.'): string | undefined => {
  return /^(?:\+84|0)(?:\d{9,10})$/.test(value.replace(/[\s.-]/g, '')) ? undefined : message;
};

export const validDateRange = (from: string | undefined, to: string | undefined, label: string): string | undefined => {
  if (!from || !to) return `Vui lòng nhập đủ ${label}.`;
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime <= fromTime) {
    return `${label} không hợp lệ: thời điểm kết thúc phải sau thời điểm bắt đầu.`;
  }
  return undefined;
};

export const validFutureDate = (value: string | undefined, label: string): string | undefined => {
  if (!value) return `Vui lòng nhập ${label}.`;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now() ? undefined : `${label} phải là thời điểm trong tương lai.`;
};

export function setError(errors: FieldErrors, field: string, message?: string): void {
  if (message) errors[field] = message;
}

export function validateIsoContainer(value: string | undefined): string | undefined {
  const missing = required(value, 'Vui lòng nhập số container.');
  if (missing) return missing;
  const result = validateContainerNumber(value!.trim().toUpperCase());
  return result.isValid ? undefined : (result.message || 'Số container không hợp lệ theo ISO 6346.');
}
