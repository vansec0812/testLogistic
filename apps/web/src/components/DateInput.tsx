import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

// =============================================================================
// DateInput — Always dd/mm/yyyy format regardless of browser/OS locale
// =============================================================================

export interface DateInputProps {
  value?: string; // ISO string (yyyy-mm-dd or full ISO) or empty
  onChange: (isoValue: string) => void;
  id?: string;
  'data-field'?: string;
  className?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
  placeholder?: string;
  endOfDay?: boolean; // if true, emits T23:59:59 otherwise T00:00:00
  min?: string; // ISO min date
  max?: string; // ISO max date
  disabled?: boolean;
}

/** Extract yyyy-mm-dd from ISO string or return '' */
function isoToYmd(value?: string): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Convert yyyy-mm-dd to dd/mm/yyyy display string */
function ymdToDisplay(ymd: string): string {
  if (!ymd) return '';
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ymd;
}

/** Convert dd/mm/yyyy to yyyy-mm-dd */
function displayToYmd(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Validate dd/mm/yyyy and check that the date is real */
function isValidDisplay(display: string): boolean {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return false;
  // Check actual date validity (e.g., handles leap years and month lengths)
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  id,
  'data-field': dataField,
  className = '',
  'aria-invalid': ariaInvalid,
  required,
  placeholder = 'dd/mm/yyyy',
  endOfDay = false,
  min,
  max,
  disabled = false,
}) => {
  const ymd = isoToYmd(value);
  const [displayValue, setDisplayValue] = useState(() => ymdToDisplay(ymd));
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  // Sync display when external value changes
  useEffect(() => {
    const newYmd = isoToYmd(value);
    const newDisplay = ymdToDisplay(newYmd);
    setDisplayValue(prev => {
      // Only update if actual date changed (avoid cursor jumps during typing)
      if (displayToYmd(prev) !== newYmd) return newDisplay;
      return prev;
    });
  }, [value]);

  const emitValue = useCallback(
    (ymdStr: string) => {
      if (!ymdStr) {
        onChange('');
        return;
      }
      const time = endOfDay ? 'T23:59:59' : 'T00:00:00';
      onChange(`${ymdStr}${time}`);
    },
    [onChange, endOfDay]
  );

  /** Auto-format and insert slashes as user types */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Handle ISO paste like 2026-09-19
      const isoPasteMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoPasteMatch) {
        const converted = `${isoPasteMatch[3]}/${isoPasteMatch[2]}/${isoPasteMatch[1]}`;
        setDisplayValue(converted);
        if (isValidDisplay(converted)) {
          emitValue(displayToYmd(converted));
        }
        return;
      }

      // Remove non-digit/non-slash characters
      raw = raw.replace(/[^\d/]/g, '');
      const digits = raw.replace(/\//g, '');

      // Allow user to completely clear the field
      if (digits.length === 0) {
        setDisplayValue('');
        emitValue('');
        return;
      }

      // Auto-insert slashes
      let formatted = '';
      for (let i = 0; i < Math.min(digits.length, 8); i++) {
        if (i === 2 || i === 4) formatted += '/';
        formatted += digits[i];
      }
      setDisplayValue(formatted);

      // If complete and valid dd/mm/yyyy, emit
      if (isValidDisplay(formatted)) {
        emitValue(displayToYmd(formatted));
      }
    },
    [emitValue]
  );

  const handleBlur = useCallback(() => {
    if (displayValue && !isValidDisplay(displayValue)) {
      // If partial or invalid on blur, revert to current valid external value if available
      const fallback = ymdToDisplay(isoToYmd(value));
      setDisplayValue(fallback);
    }
  }, [displayValue, value]);

  /** Open native date picker via hidden input */
  const handleCalendarClick = useCallback(() => {
    if (disabled || !hiddenDateRef.current) return;
    const el = hiddenDateRef.current;
    try {
      if (typeof (el as any).showPicker === 'function') {
        (el as any).showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  }, [disabled]);

  /** Handle native picker selection */
  const handleNativePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const ymdVal = e.target.value; // yyyy-mm-dd
      if (ymdVal) {
        setDisplayValue(ymdToDisplay(ymdVal));
        emitValue(ymdVal);
      }
    },
    [emitValue]
  );

  // Combine className with pr-9 so text never touches calendar icon
  const inputClass = `${className} pr-9`.trim();

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="numeric"
        id={id}
        data-field={dataField}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        autoComplete="off"
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={inputClass}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={handleCalendarClick}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        aria-label="Mở lịch chọn ngày"
        title="Mở lịch chọn ngày (dd/mm/yyyy)"
      >
        <Calendar className="w-4 h-4" />
      </button>
      {/* Hidden native date input for calendar picker */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        className="sr-only absolute opacity-0 pointer-events-none"
        value={isoToYmd(value)}
        min={min ? isoToYmd(min) : undefined}
        max={max ? isoToYmd(max) : undefined}
        onChange={handleNativePick}
        aria-hidden="true"
      />
    </div>
  );
};

// =============================================================================
// DateTimeInput — Always dd/mm/yyyy HH:mm format
// =============================================================================

export interface DateTimeInputProps {
  value?: string; // ISO string or datetime-local format (yyyy-mm-ddTHH:mm)
  onChange: (isoValue: string) => void;
  id?: string;
  'data-field'?: string;
  className?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/** Extract yyyy-mm-ddTHH:mm from ISO string */
function isoToDateTimeLocal(value?: string): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : '';
}

/** Convert yyyy-mm-ddTHH:mm to dd/mm/yyyy HH:mm */
function dtLocalToDisplay(dtLocal: string): string {
  if (!dtLocal) return '';
  const m = dtLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : dtLocal;
}

/** Convert dd/mm/yyyy HH:mm to ISO string */
function displayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00` : '';
}

/** Validate dd/mm/yyyy HH:mm */
function isValidDateTimeDisplay(display: string): boolean {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return false;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return false;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  id,
  'data-field': dataField,
  className = '',
  'aria-invalid': ariaInvalid,
  required,
  placeholder = 'dd/mm/yyyy HH:mm',
  disabled = false,
}) => {
  const dtLocal = isoToDateTimeLocal(value);
  const [displayValue, setDisplayValue] = useState(() => dtLocalToDisplay(dtLocal));
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newDtLocal = isoToDateTimeLocal(value);
    const newDisplay = dtLocalToDisplay(newDtLocal);
    setDisplayValue(prev => {
      if (displayToIso(prev) !== (newDtLocal ? `${newDtLocal}:00` : '')) return newDisplay;
      return prev;
    });
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Handle ISO paste like 2026-09-19T10:30
      const isoPasteMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
      if (isoPasteMatch) {
        const converted = `${isoPasteMatch[3]}/${isoPasteMatch[2]}/${isoPasteMatch[1]} ${isoPasteMatch[4]}:${isoPasteMatch[5]}`;
        setDisplayValue(converted);
        if (isValidDateTimeDisplay(converted)) {
          onChange(displayToIso(converted));
        }
        return;
      }

      // Allow digits, slashes, spaces, colons
      raw = raw.replace(/[^\d/:.\s]/g, '');
      const digits = raw.replace(/[\s/:.-]/g, '');

      // Allow user to clear
      if (digits.length === 0) {
        setDisplayValue('');
        onChange('');
        return;
      }

      // Auto-format: dd/mm/yyyy HH:mm
      const d = digits;
      let result = '';
      if (d.length <= 2) result = d;
      else if (d.length <= 4) result = `${d.slice(0, 2)}/${d.slice(2)}`;
      else if (d.length <= 8) result = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
      else if (d.length <= 10) result = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)} ${d.slice(8)}`;
      else result = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;

      setDisplayValue(result);
      if (isValidDateTimeDisplay(result)) {
        onChange(displayToIso(result));
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    if (displayValue && !isValidDateTimeDisplay(displayValue)) {
      const fallback = dtLocalToDisplay(isoToDateTimeLocal(value));
      setDisplayValue(fallback);
    }
  }, [displayValue, value]);

  const handleCalendarClick = useCallback(() => {
    if (disabled || !hiddenRef.current) return;
    const el = hiddenRef.current;
    try {
      if (typeof (el as any).showPicker === 'function') {
        (el as any).showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  }, [disabled]);

  const handleNativePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value; // yyyy-mm-ddTHH:mm
      if (v) {
        setDisplayValue(dtLocalToDisplay(v));
        const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
        if (m) onChange(`${m[1]}T${m[2]}:00`);
      }
    },
    [onChange]
  );

  const inputClass = `${className} pr-9`.trim();

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="numeric"
        id={id}
        data-field={dataField}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={16}
        autoComplete="off"
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className={inputClass}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={handleCalendarClick}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        aria-label="Mở lịch chọn ngày giờ"
        title="Mở lịch chọn ngày giờ (dd/mm/yyyy HH:mm)"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={hiddenRef}
        type="datetime-local"
        tabIndex={-1}
        className="sr-only absolute opacity-0 pointer-events-none"
        value={isoToDateTimeLocal(value)}
        onChange={handleNativePick}
        aria-hidden="true"
      />
    </div>
  );
};
