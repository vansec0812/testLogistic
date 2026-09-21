import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import { AccountSnapshot, findAccountForRecovery, updateAccountPassword } from '../services/accountService';

interface PasswordRecoveryPanelProps {
  onBack: () => void;
  onSuccess: (username: string) => void;
}

type RecoveryStep = 'identifier' | 'channel' | 'otp' | 'password' | 'success';
type RecoveryChannel = 'phone' | 'email';

const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7) return value;
  return `${digits.slice(0, 3)}***${digits.slice(-3)}`;
};

const maskEmail = (value: string): string => {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
};

const makeOtp = (): string => String(Math.floor(100000 + Math.random() * 900000));

export const PasswordRecoveryPanel: React.FC<PasswordRecoveryPanelProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState<RecoveryStep>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [channel, setChannel] = useState<RecoveryChannel>('phone');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const contactLabel = useMemo(() => {
    if (!account) return '';
    return channel === 'phone' ? maskPhone(account.phone) : maskEmail(account.email);
  }, [account, channel]);

  const handleFindAccount = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const found = findAccountForRecovery(identifier);
    if (!found) {
      setError('Không tìm thấy tài khoản với tên đăng nhập, email hoặc số điện thoại này.');
      return;
    }
    setAccount(found);
    setChannel(found.phone ? 'phone' : 'email');
    setStep('channel');
  };

  const handleSendOtp = () => {
    if (!account) return;
    const destination = channel === 'phone' ? account.phone : account.email;
    if (!destination) {
      setError(`Tài khoản chưa có ${channel === 'phone' ? 'số điện thoại' : 'email'} đã đăng ký.`);
      return;
    }
    const code = makeOtp();
    setDemoOtp(code);
    setOtp('');
    setOtpExpiresAt(Date.now() + 5 * 60 * 1000);
    setCountdown(60);
    setNotice(`Chế độ demo: mã OTP là ${code}. Mã đã được gửi tới ${contactLabel}.`);
    setError('');
    setStep('otp');
  };

  const handleVerifyOtp = () => {
    if (!otp || otp !== demoOtp || Date.now() > otpExpiresAt) {
      setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
      return;
    }
    setError('');
    setNotice('Đã xác nhận OTP. Bạn có thể đặt mật khẩu mới.');
    setStep('password');
  };

  const handleResetPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!account) return;
    const result = updateAccountPassword(account.id, newPassword);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setError('');
    setNotice('Mật khẩu đã được cập nhật.');
    setStep('success');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Quên mật khẩu</h3>
          <p className="text-sm text-slate-500 mt-1">Xác nhận OTP bằng thông tin đã đăng ký rồi đặt mật khẩu mới.</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
      {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm border border-blue-200">{notice}</div>}

      {step === 'identifier' && (
        <form className="space-y-4" onSubmit={handleFindAccount}>
          <div>
            <label htmlFor="recoveryIdentifier" className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập, email hoặc số điện thoại</label>
            <input
              id="recoveryIdentifier"
              value={identifier}
              onChange={event => setIdentifier(event.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ví dụ: bena hoặc email đăng ký"
              autoComplete="username"
              required
            />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Tiếp tục
          </button>
        </form>
      )}

      {step === 'channel' && account && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            Tài khoản: <strong>{account.username}</strong>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">Nhận mã OTP bằng</legend>
            {account.phone && (
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" checked={channel === 'phone'} onChange={() => setChannel('phone')} />
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-sm">Số điện thoại {maskPhone(account.phone)}</span>
              </label>
            )}
            {account.email && (
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input type="radio" checked={channel === 'email'} onChange={() => setChannel('email')} />
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-sm">Email {maskEmail(account.email)}</span>
              </label>
            )}
          </fieldset>
          <button type="button" onClick={handleSendOtp} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Gửi mã OTP
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Mã OTP đã gửi tới {contactLabel}
          </div>
          <input
            value={otp}
            onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tracking-[0.35em] text-center focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập mã OTP 6 số"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <button type="button" onClick={handleVerifyOtp} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Xác nhận OTP
          </button>
          <button type="button" onClick={handleSendOtp} disabled={countdown > 0} className="w-full text-sm text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline">
            {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã OTP'}
          </button>
        </div>
      )}

      {step === 'password' && (
        <form className="space-y-4" onSubmit={handleResetPassword}>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
            <input id="newPassword" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoComplete="new-password" required />
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
            <input id="confirmNewPassword" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" autoComplete="new-password" required />
          </div>
          <button type="submit" className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Đặt lại mật khẩu
          </button>
        </form>
      )}

      {step === 'success' && account && (
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
          <p className="text-sm text-slate-700">Mật khẩu của tài khoản <strong>{account.username}</strong> đã được cập nhật.</p>
          <button type="button" onClick={() => onSuccess(account.username)} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Quay lại đăng nhập
          </button>
        </div>
      )}

      <button type="button" onClick={onBack} className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-blue-700">
        <ArrowLeft className="w-4 h-4" /> Quay lại màn đăng nhập
      </button>
    </div>
  );
};
