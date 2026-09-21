import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAccountById, updateAccountPassword } from '../services/accountService';

interface ChangePasswordPageProps {
  setCurrentTab: (tab: string) => void;
}

type OtpChannel = 'phone' | 'email';

const makeOtp = (): string => String(Math.floor(100000 + Math.random() * 900000));

const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 ? `${digits.slice(0, 3)}***${digits.slice(-3)}` : value;
};

const maskEmail = (value: string): string => {
  const [name, domain] = value.split('@');
  return name && domain ? `${name.slice(0, 2)}***@${domain}` : value;
};

export const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({ setCurrentTab }) => {
  const { currentUserId, currentUserName } = useAuth();
  const account = useMemo(() => getAccountById(currentUserId), [currentUserId]);
  const [channel, setChannel] = useState<OtpChannel>('phone');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const destination = channel === 'phone' ? account?.phone || '' : account?.email || '';

  const handleSendOtp = () => {
    if (!account || !destination) {
      setError(`Tài khoản chưa có ${channel === 'phone' ? 'số điện thoại' : 'email'} đã đăng ký.`);
      return;
    }
    const code = makeOtp();
    setDemoOtp(code);
    setOtpValue('');
    setOtpSent(true);
    setOtpVerified(false);
    setOtpExpiresAt(Date.now() + 5 * 60 * 1000);
    setCountdown(60);
    setError('');
    setNotice(`Chế độ demo: mã OTP là ${code}, gửi tới ${channel === 'phone' ? maskPhone(destination) : maskEmail(destination)}.`);
  };

  const handleVerifyOtp = () => {
    if (!otpValue || otpValue !== demoOtp || Date.now() > otpExpiresAt) {
      setOtpVerified(false);
      setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
      return;
    }
    setOtpVerified(true);
    setError('');
    setNotice('OTP hợp lệ. Bạn có thể đặt mật khẩu mới.');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpVerified) {
      setError('Vui lòng xác nhận OTP trước khi đổi mật khẩu.');
      return;
    }
    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!account || account.password !== currentPassword) {
      setError('Mật khẩu hiện tại không chính xác.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!account) {
      setError('Không tìm thấy tài khoản đang đăng nhập.');
      return;
    }
    const result = updateAccountPassword(account.id, newPassword, currentPassword);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setError('');
    setNotice('Đổi mật khẩu thành công.');
    setSaved(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h2>
            <p className="text-sm text-slate-500 mt-1">Tài khoản: {account?.username || currentUserName}</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
      {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm border border-blue-200">{notice}</div>}

      {!saved ? (
        <form noValidate onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
          <section>
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900">Xác nhận OTP</h3>
                <p className="text-sm text-slate-600 mt-1">Mã được gửi tới thông tin đã đăng ký với tài khoản.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${channel === 'phone' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>
                <input type="radio" checked={channel === 'phone'} onChange={() => { setChannel('phone'); setOtpVerified(false); }} disabled={!account?.phone} />
                <Phone className="w-4 h-4" /> {account?.phone ? maskPhone(account.phone) : 'Chưa có số điện thoại'}
              </label>
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${channel === 'email' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>
                <input type="radio" checked={channel === 'email'} onChange={() => { setChannel('email'); setOtpVerified(false); }} disabled={!account?.email} />
                <Mail className="w-4 h-4" /> {account?.email ? maskEmail(account.email) : 'Chưa có email'}
              </label>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={handleSendOtp} disabled={countdown > 0 || !destination} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">
                {countdown > 0 ? `Gửi lại sau ${countdown}s` : otpSent ? 'Gửi lại OTP' : 'Gửi mã OTP'}
              </button>
              {otpSent && !otpVerified && (
                <>
                  <input value={otpValue} onChange={event => setOtpValue(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập mã OTP 6 số" inputMode="numeric" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm tracking-[0.25em]" />
                  <button type="button" onClick={handleVerifyOtp} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Xác nhận</button>
                </>
              )}
            </div>
            {otpVerified && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> OTP hợp lệ.</p>}
          </section>

          <section className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="font-bold text-slate-900">Mật khẩu mới</h3>
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu hiện tại</label>
              <input id="currentPassword" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoComplete="current-password" required />
            </div>
            <div>
              <label htmlFor="changePassword" className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
              <input id="changePassword" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoComplete="new-password" required />
            </div>
            <div>
              <label htmlFor="changePasswordConfirm" className="block text-sm font-medium text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
              <input id="changePasswordConfirm" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoComplete="new-password" required />
            </div>
          </section>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={() => setCurrentTab('profile')} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"><ArrowLeft className="inline w-4 h-4 mr-1" /> Hồ sơ</button>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Lưu mật khẩu mới</button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
          <p className="text-slate-700">Mật khẩu đã được cập nhật thành công.</p>
          <button type="button" onClick={() => setCurrentTab('profile')} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Quay lại hồ sơ</button>
        </div>
      )}
    </div>
  );
};
