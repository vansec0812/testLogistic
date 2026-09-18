import React from 'react';

export type FieldErrors = Record<string, string>;

export function getFieldErrorClass(hasError: boolean, baseClassName: string): string {
  return `${baseClassName} ${hasError
    ? 'border-red-500 bg-red-50/40 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-500'
    : ''}`;
}

export function scrollToFirstFieldError(errors: FieldErrors): void {
  const firstField = Object.keys(errors).find(field => Boolean(errors[field]));
  if (!firstField || typeof document === 'undefined') return;

  window.setTimeout(() => {
    const element = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`)
      || document.getElementById(firstField);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof element.focus === 'function') element.focus({ preventScroll: true });
  }, 0);
}

export function firstErrorMessage(errors: FieldErrors): string {
  const firstField = Object.keys(errors).find(field => Boolean(errors[field]));
  return firstField ? errors[firstField] : '';
}

export const RequiredMark: React.FC = () => (
  <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>
);

export const FormLabel: React.FC<{
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ htmlFor, required = false, children, className = 'text-xs sm:text-sm font-semibold text-slate-700' }) => (
  <label htmlFor={htmlFor} className={`${className} block mb-1`}>
    {children}{required && <RequiredMark />}
  </label>
);

export const FieldError: React.FC<{ message?: string }> = ({ message }) => (
  message ? <p className="mt-1 text-xs font-semibold text-red-600" role="alert">{message}</p> : null
);

export const FormErrorSummary: React.FC<{ errors: FieldErrors; title?: string }> = ({ errors, title = 'Vui lòng kiểm tra lại các trường sau:' }) => {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message));
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="assertive">
      <p className="font-bold">{title}</p>
      <ul className="mt-1 list-disc pl-5 space-y-0.5 text-xs">
        {entries.map(([field, message]) => <li key={field}>{message}</li>)}
      </ul>
    </div>
  );
};
