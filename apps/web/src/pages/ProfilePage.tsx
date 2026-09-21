import React, { useMemo, useState } from 'react';
import { Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';
import {
  FieldError,
  FieldErrors,
  FormErrorSummary,
  RequiredMark,
  getFieldErrorClass,
  scrollToFirstFieldError,
} from '../components/FormValidation';
import { required, setError, validEmail, validPhone } from '../lib/formValidation';
import { useAuth } from '../context/AuthContext';
import { getAccountById } from '../services/accountService';
import type { Company, UserRole } from '../types';

interface ProfilePageProps {
  setCurrentTab: (tab: string) => void;
}

type OtpChannel = 'phone' | 'email';

interface ProfileForm {
  username: string;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  companyName: string;
  taxCode: string;
  address: string;
  representativePhone: string;
  representativeEmail: string;
  businessType: Company['businessType'];
}

const makeOtp = (): string => String(Math.floor(100000 + Math.random() * 900000));

const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 ? `${digits.slice(0, 3)}***${digits.slice(-3)}` : value;
};

const maskEmail = (value: string): string => {
  const [name, domain] = value.split('@');
  return name && domain ? `${name.slice(0, 2)}***@${domain}` : value;
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ setCurrentTab }) => {
  const {
    currentRole,
    currentCompany,
    currentUserId,
    currentUserEmail,
    currentUserName,
    updateProfile,
    roleBadge,
  } = useAuth();
  const account = useMemo(() => getAccountById(currentUserId), [currentUserId]);
  const initialCompany = account?.company || currentCompany;
  const [form, setForm] = useState<ProfileForm>({
    username: account?.username || '',
    fullName: account?.fullName || currentUserName,
    phone: account?.phone || '',
    email: account?.email || currentUserEmail,
    role: account?.role || currentRole,
    companyName: initialCompany.companyName,
    taxCode: initialCompany.taxCode,
    address: initialCompany.address,
    representativePhone: initialCompany.representativePhone,
    representativeEmail: initialCompany.representativeEmail,
    businessType: initialCompany.businessType,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('phone');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const setField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: '' }));
    setFormError('');
    setSuccessMessage('');
    setOtpVerified(false);
  };

  React.useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const registeredPhone = account?.phone || '';
  const registeredEmail = account?.email || '';
  const otpDestination = otpChannel === 'phone' ? registeredPhone : registeredEmail;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    setError(next, 'fullName', required(form.fullName, 'Vui lòng nhập họ tên.'));
    setError(next, 'phone', required(form.phone, 'Vui lòng nhập số điện thoại.'));
    if (form.phone.trim()) setError(next, 'phone', validPhone(form.phone));
    setError(next, 'email', required(form.email, 'Vui lòng nhập email/Gmail.'));
    if (form.email.trim()) setError(next, 'email', validEmail(form.email));
    setError(next, 'companyName', required(form.companyName, 'Vui lòng nhập tên công ty.'));
    setError(next, 'taxCode', required(form.taxCode, 'Vui lòng nhập mã số thuế.'));
    if (form.taxCode.trim() && !/^\d{8,14}$/.test(form.taxCode.trim())) next.taxCode = 'Mã số thuế phải gồm 8–14 chữ số.';
    setError(next, 'address', required(form.address, 'Vui lòng nhập địa chỉ công ty.'));
    setError(next, 'representativePhone', required(form.representativePhone, 'Vui lòng nhập số điện thoại công ty.'));
    if (form.representativePhone.trim()) setError(next, 'representativePhone', validPhone(form.representativePhone, 'Số điện thoại công ty không hợp lệ.'));
    setError(next, 'representativeEmail', required(form.representativeEmail, 'Vui lòng nhập email công ty.'));
    if (form.representativeEmail.trim()) setError(next, 'representativeEmail', validEmail(form.representativeEmail, 'Email công ty không hợp lệ.'));
    if (!otpVerified) next.otp = 'Vui lòng xác nhận OTP bằng số điện thoại hoặc email đã đăng ký trước khi lưu.';
    return next;
  };

  const handleSendOtp = () => {
    if (!otpDestination) {
      setFormError(`Tài khoản chưa có ${otpChannel === 'phone' ? 'số điện thoại' : 'email'} để xác nhận OTP.`);
      return;
    }
    const code = makeOtp();
    setDemoOtp(code);
    setOtpValue('');
    setOtpSent(true);
    setOtpVerified(false);
    setOtpExpiresAt(Date.now() + 5 * 60 * 1000);
    setCountdown(60);
    setFormError('');
    setSuccessMessage(`Chế độ demo: mã OTP là ${code}, gửi tới ${otpChannel === 'phone' ? maskPhone(otpDestination) : maskEmail(otpDestination)}.`);
  };

  const handleVerifyOtp = () => {
    if (!otpValue || otpValue !== demoOtp || Date.now() > otpExpiresAt) {
      setOtpVerified(false);
      setFormError('Mã OTP không hợp lệ hoặc đã hết hạn.');
      return;
    }
    setOtpVerified(true);
    setFormError('');
    setErrors(current => ({ ...current, otp: '' }));
    setSuccessMessage('Đã xác nhận OTP. Bạn có thể lưu thay đổi hồ sơ.');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Vui lòng kiểm tra các trường bắt buộc và xác nhận OTP.');
      scrollToFirstFieldError(nextErrors);
      return;
    }

    const company: Company = {
      ...initialCompany,
      companyName: form.companyName.trim(),
      shortName: form.companyName.trim(),
      taxCode: form.taxCode.trim(),
      address: form.address.trim(),
      representativeName: form.fullName.trim(),
      representativePhone: form.representativePhone.trim(),
      representativeEmail: form.representativeEmail.trim(),
      businessType: form.businessType,
    };
    const result = updateProfile({
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      role: form.role,
      company,
    });
    if (!result.success) {
      setFormError(result.message);
      return;
    }
    setSuccessMessage('Đã cập nhật hồ sơ thành công.');
  };

  const inputClass = (field: string) => getFieldErrorClass(Boolean(errors[field]), 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500');

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <UserRound className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Hồ sơ tài khoản</h2>
            <p className="text-sm text-slate-500 mt-1">Cập nhật thông tin cá nhân và doanh nghiệp đang tham gia ECont.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${roleBadge.bgColor} ${roleBadge.color}`}>
          {roleBadge.icon} {roleBadge.label}
        </span>
      </div>

      {formError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{formError}</div>}
      {successMessage && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm border border-emerald-200">{successMessage}</div>}
      <FormErrorSummary errors={errors} />

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Thông tin tài khoản</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profileUsername" className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
            <input id="profileUsername" value={form.username} readOnly disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed" autoComplete="username" />
            <p className="text-xs text-slate-500 mt-1">Tên đăng nhập không thể thay đổi.</p>
          </div>
          <div>
            <label htmlFor="profileFullName" className="block text-sm font-medium text-slate-700 mb-1">Họ và tên <RequiredMark /></label>
            <input id="profileFullName" data-field="fullName" value={form.fullName} onChange={event => setField('fullName', event.target.value)} className={inputClass('fullName')} />
            <FieldError message={errors.fullName} />
          </div>
          <div>
            <label htmlFor="profilePhone" className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại <RequiredMark /></label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input id="profilePhone" data-field="phone" value={form.phone} onChange={event => setField('phone', event.target.value)} className={`${inputClass('phone')} pl-9`} />
            </div>
            <FieldError message={errors.phone} />
          </div>
          <div>
            <label htmlFor="profileEmail" className="block text-sm font-medium text-slate-700 mb-1">Email/Gmail <RequiredMark /></label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input id="profileEmail" data-field="email" type="email" value={form.email} onChange={event => setField('email', event.target.value)} className={`${inputClass('email')} pl-9`} />
            </div>
            <FieldError message={errors.email} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="profileRole" className="block text-sm font-medium text-slate-700 mb-1">Vai trò tham gia ECont <RequiredMark /></label>
            {currentRole === 'OPS' ? (
              <input id="profileRole" value="Vận hành Ops" readOnly disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
            ) : (
              <select id="profileRole" data-field="role" value={form.role} onChange={event => setField('role', event.target.value as UserRole)} className={inputClass('role')}>
                <option value="ENTERPRISE_A">Nhà cung cấp Container</option>
                <option value="ENTERPRISE_B">Cần vỏ Container</option>
                <option value="ENTERPRISE_BOTH">Cả hai: Nhà cung cấp và Cần vỏ Container</option>
              </select>
            )}
            <p className="text-xs text-slate-500 mt-1">Chọn “Cả hai” để mở đồng thời chức năng đăng Offer và tạo Booking/Nhu cầu tìm vỏ.</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Thông tin doanh nghiệp</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="profileCompanyName" className="block text-sm font-medium text-slate-700 mb-1">Tên công ty <RequiredMark /></label>
            <input id="profileCompanyName" data-field="companyName" value={form.companyName} onChange={event => setField('companyName', event.target.value)} className={inputClass('companyName')} />
            <FieldError message={errors.companyName} />
          </div>
          <div>
            <label htmlFor="profileTaxCode" className="block text-sm font-medium text-slate-700 mb-1">Mã số thuế <RequiredMark /></label>
            <input id="profileTaxCode" data-field="taxCode" value={form.taxCode} onChange={event => setField('taxCode', event.target.value)} className={inputClass('taxCode')} />
            <FieldError message={errors.taxCode} />
          </div>
          <div>
            <label htmlFor="profileBusinessType" className="block text-sm font-medium text-slate-700 mb-1">Loại hình kinh doanh</label>
            <select id="profileBusinessType" value={form.businessType} onChange={event => setField('businessType', event.target.value as Company['businessType'])} className={inputClass('businessType')}>
              <option value="FORWARDER">FORWARDER</option>
              <option value="FACTORY">FACTORY</option>
              <option value="TRUCKER">TRUCKER</option>
              <option value="SHIPPING_LINE">SHIPPING_LINE</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="profileAddress" className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ <RequiredMark /></label>
            <input id="profileAddress" data-field="address" value={form.address} onChange={event => setField('address', event.target.value)} className={inputClass('address')} />
            <FieldError message={errors.address} />
          </div>
          <div>
            <label htmlFor="profileCompanyPhone" className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại công ty <RequiredMark /></label>
            <input id="profileCompanyPhone" data-field="representativePhone" value={form.representativePhone} onChange={event => setField('representativePhone', event.target.value)} className={inputClass('representativePhone')} />
            <FieldError message={errors.representativePhone} />
          </div>
          <div>
            <label htmlFor="profileCompanyEmail" className="block text-sm font-medium text-slate-700 mb-1">Email công ty <RequiredMark /></label>
            <input id="profileCompanyEmail" data-field="representativeEmail" type="email" value={form.representativeEmail} onChange={event => setField('representativeEmail', event.target.value)} className={inputClass('representativeEmail')} />
            <FieldError message={errors.representativeEmail} />
          </div>
        </div>
      </section>

      <section className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Xác nhận OTP trước khi lưu</h3>
            <p className="text-sm text-slate-600 mt-1">OTP luôn được gửi tới thông tin đã đăng ký trước đó, không phải giá trị mới đang chỉnh sửa.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kênh nhận OTP</label>
            <div className="flex flex-wrap gap-2">
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${otpChannel === 'phone' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>
                <input type="radio" checked={otpChannel === 'phone'} onChange={() => { setOtpChannel('phone'); setOtpVerified(false); }} disabled={!registeredPhone} />
                <Phone className="w-4 h-4" /> {registeredPhone ? maskPhone(registeredPhone) : 'Chưa có số điện thoại'}
              </label>
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${otpChannel === 'email' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>
                <input type="radio" checked={otpChannel === 'email'} onChange={() => { setOtpChannel('email'); setOtpVerified(false); }} disabled={!registeredEmail} />
                <Mail className="w-4 h-4" /> {registeredEmail ? maskEmail(registeredEmail) : 'Chưa có email'}
              </label>
            </div>
          </div>
          <button type="button" onClick={handleSendOtp} disabled={countdown > 0 || !otpDestination} className="px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">
            {countdown > 0 ? `Gửi lại sau ${countdown}s` : otpSent ? 'Gửi lại OTP' : 'Gửi mã OTP'}
          </button>
        </div>
        {otpSent && !otpVerified && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input data-field="otp" value={otpValue} onChange={event => setOtpValue(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập mã OTP 6 số" inputMode="numeric" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm tracking-[0.25em]" />
            <button type="button" onClick={handleVerifyOtp} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Xác nhận OTP</button>
          </div>
        )}
        {otpVerified && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> OTP hợp lệ, có thể submit hồ sơ.</p>}
        <FieldError message={errors.otp} />
      </section>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button type="button" onClick={() => setCurrentTab('dashboard')} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Hủy</button>
        <button type="button" onClick={() => setCurrentTab('change-password')} className="px-5 py-2.5 rounded-lg border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50">Đổi mật khẩu</button>
        <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"><Save className="w-4 h-4" /> Lưu thay đổi</button>
      </div>
    </form>
  );
};
