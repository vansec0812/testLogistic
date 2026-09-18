import React, { useState, useEffect } from 'react';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, setError, validEmail, validPhone } from '../lib/formValidation';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { Company, UserRole } from '../types';
import { isApiConfigured, postApi } from '../services/apiClient';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const { submitCompanyRegistration } = useDatabase();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  // Company Info State
  const [compName, setCompName] = useState('');
  const [compTaxCode, setCompTaxCode] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compBusinessType, setCompBusinessType] = useState('FORWARDER');
  const [compRole, setCompRole] = useState<UserRole>('ENTERPRISE_A');

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [demoOtpCode, setDemoOtpCode] = useState('');
  const [otpSessionId, setOtpSessionId] = useState<string | undefined>();
  const [otpNotice, setOtpNotice] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState('');
  const [registrationErrors, setRegistrationErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const errors: FieldErrors = {};
    setError(errors, 'username', required(username, 'Vui lòng nhập tên đăng nhập.'));
    setError(errors, 'password', required(password, 'Vui lòng nhập mật khẩu.'));
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = login(username, password);
    if (result.success) {
      onLoginSuccess();
      setLoginErrors({});
    } else {
      setLoginError(result.message);
    }
  };

  const handleSendOTP = async () => {
    if (!regPhone) return;
    setOtpNotice('');
    try {
      if (isApiConfigured) {
        const response = await postApi<{ sessionId?: string }>('/api/auth/otp/request', { phone: regPhone });
        setOtpSessionId(response?.sessionId);
        setOtpNotice('Mã OTP đã được gửi qua SMS.');
      } else {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setDemoOtpCode(code);
        setOtpNotice(`Chế độ demo: mã OTP là ${code}. Khi vận hành thật, mã sẽ được gửi qua SMS.`);
      }
    } catch (error: any) {
      setRegError(error?.message || 'Không thể gửi OTP.');
      return;
    }
    setOtpSent(true);
    setOtpCountdown(60);
  };

  const handleVerifyOTP = async () => {
    try {
      const verified = isApiConfigured
        ? (await postApi<{ verified?: boolean }>('/api/auth/otp/verify', { phone: regPhone, code: otpCode, sessionId: otpSessionId })).verified !== false
        : otpCode === demoOtpCode;
      if (verified) {
        setOtpVerified(true);
        setOtpNotice('Số điện thoại đã được xác thực.');
        setRegError('');
      } else {
        setRegError('Mã OTP không hợp lệ hoặc đã hết hạn.');
      }
    } catch (error: any) {
      setRegError(error?.message || 'Không thể xác thực OTP.');
    }
  };

  const validateRegistrationForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(errors, 'regFullName', required(regFullName, 'Vui lòng nhập họ tên.'));
    setError(errors, 'regPhone', required(regPhone, 'Vui lòng nhập số điện thoại.'));
    if (regPhone.trim()) setError(errors, 'regPhone', validPhone(regPhone));
    setError(errors, 'regEmail', required(regEmail, 'Vui lòng nhập email/Gmail.'));
    if (regEmail.trim()) setError(errors, 'regEmail', validEmail(regEmail));
    setError(errors, 'regUsername', required(regUsername, 'Vui lòng nhập tên đăng nhập.'));
    setError(errors, 'regPassword', required(regPassword, 'Vui lòng nhập mật khẩu.'));
    if (regPassword && regPassword.length < 8) errors.regPassword = 'Mật khẩu phải có ít nhất 8 ký tự.';
    setError(errors, 'regConfirmPassword', required(regConfirmPassword, 'Vui lòng xác nhận mật khẩu.'));
    if (regConfirmPassword && regPassword !== regConfirmPassword) errors.regConfirmPassword = 'Mật khẩu xác nhận không khớp.';
    if (!otpVerified) {
      errors.otp = 'Vui lòng xác thực số điện thoại bằng OTP trước khi đăng ký.';
      if (!otpSent) errors.regPhone = 'Vui lòng gửi và xác thực mã OTP cho số điện thoại.';
    }
    setError(errors, 'compName', required(compName, 'Vui lòng nhập tên công ty.'));
    setError(errors, 'compTaxCode', required(compTaxCode, 'Vui lòng nhập mã số thuế công ty.'));
    if (compTaxCode.trim() && !/^\d{8,14}$/.test(compTaxCode.trim())) errors.compTaxCode = 'Mã số thuế phải gồm 8–14 chữ số.';
    setError(errors, 'compAddress', required(compAddress, 'Vui lòng nhập địa chỉ công ty.'));
    setError(errors, 'compPhone', required(compPhone, 'Vui lòng nhập số điện thoại công ty.'));
    if (compPhone.trim()) setError(errors, 'compPhone', validPhone(compPhone, 'Số điện thoại công ty không hợp lệ.'));
    setError(errors, 'compEmail', required(compEmail, 'Vui lòng nhập email công ty.'));
    if (compEmail.trim()) setError(errors, 'compEmail', validEmail(compEmail, 'Email công ty không hợp lệ.'));
    return errors;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    const errors = validateRegistrationForm();
    setRegistrationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setRegError('Vui lòng kiểm tra các trường được đánh dấu và hoàn tất xác thực OTP.');
      scrollToFirstFieldError(errors);
      return;
    }
    const registeredUsers = JSON.parse(localStorage.getItem('econt_registered_users') || '[]');
    if (registeredUsers.some((user: any) => user.username === regUsername || user.email === regEmail || user.phone === regPhone)) {
      setRegError('Tên đăng nhập, email hoặc số điện thoại đã được sử dụng. V1 chỉ cấp một tài khoản cho mỗi doanh nghiệp.');
      return;
    }

    const companyResult = submitCompanyRegistration({
      taxCode: compTaxCode,
      companyName: compName,
      shortName: compName,
      businessType: compBusinessType as Company['businessType'],
      address: compAddress,
      representativeName: regFullName,
      representativePhone: compPhone,
      representativeEmail: compEmail,
      verificationStatus: 'PENDING_VERIFICATION',
    });
    if (!companyResult.success || !companyResult.data) {
      setRegError(companyResult.message);
      return;
    }

    if (isApiConfigured) {
      try {
        await postApi('/api/auth/register', {
          fullName: regFullName,
          phone: regPhone,
          email: regEmail,
          username: regUsername,
          password: regPassword,
          companyId: (companyResult.data as Company).id,
          company: companyResult.data,
        });
      } catch (error: any) {
        setRegError(error?.message || 'Không thể tạo tài khoản trên ECont API.');
        return;
      }
    }

    const newUser = {
      id: `USR-${Date.now()}`,
      username: regUsername,
      password: regPassword,
      fullName: regFullName,
      phone: regPhone,
      email: regEmail,
      role: compRole,
      company: companyResult.data,
    };

    registeredUsers.push(newUser);
    localStorage.setItem('econt_registered_users', JSON.stringify(registeredUsers));

    setRegSuccess(true);
    setTimeout(() => {
      setRegSuccess(false);
      setActiveTab('login');
      setUsername(regUsername);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-blue-600/20">
          E
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          ECont Logistics
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Nền tảng chia sẻ & điều phối vỏ container rỗng
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              className={`flex-1 pb-3 text-sm font-medium border-b-2 ${activeTab === 'login' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('login')}
            >
              Đăng nhập
            </button>
            <button
              className={`flex-1 pb-3 text-sm font-medium border-b-2 ${activeTab === 'register' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('register')}
            >
              Đăng ký
            </button>
          </div>

          {activeTab === 'login' ? (
            <form noValidate className="space-y-6" onSubmit={handleLogin}>
              <FormErrorSummary errors={loginErrors} />
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                  {loginError}
                </div>
              )}
              
              <div>
                <label htmlFor="loginUsername" className="block text-sm font-medium text-slate-700">Tên đăng nhập <RequiredMark /></label>
                <div className="mt-1">
                  <input
                    id="loginUsername"
                    data-field="username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setLoginErrors(p => ({ ...p, username: '' })); }}
                    aria-invalid={Boolean(loginErrors.username)}
                    className={getFieldErrorClass(Boolean(loginErrors.username), 'appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm')}
                  />
                  <FieldError message={loginErrors.username} />
                </div>
              </div>

              <div>
                <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-700">Mật khẩu <RequiredMark /></label>
                <div className="mt-1">
                  <input
                    id="loginPassword"
                    data-field="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginErrors(p => ({ ...p, password: '' })); }}
                    aria-invalid={Boolean(loginErrors.password)}
                    className={getFieldErrorClass(Boolean(loginErrors.password), 'appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm')}
                  />
                  <FieldError message={loginErrors.password} />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Đăng nhập
                </button>
              </div>
              
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500 font-semibold mb-2">Demo: bạn có thể dùng tài khoản mẫu</p>
                <ul className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded border border-slate-100">
                  <li><code className="font-bold">bena / bena123</code> → Hưng Thịnh Logistics (Bên A)</li>
                  <li><code className="font-bold">benb / benb123</code> → Toàn Cầu Export (Bên B)</li>
                  <li><code className="font-bold">ops / ops123</code> → ECont Ops (Vận hành)</li>
                </ul>
              </div>
            </form>
          ) : (
            <form noValidate className="space-y-4" onSubmit={handleRegister}>
              {regSuccess && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-md text-sm border border-emerald-200 mb-4">
                  Đăng ký thành công! Tài khoản của bạn đang chờ Ops xác minh. Sẽ tự động chuyển sang đăng nhập...
                </div>
              )}
              {regError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200 mb-4">
                  {regError}
                </div>
              )}
              <FormErrorSummary errors={registrationErrors} />
              
              <div className="pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Thông tin cá nhân</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="regFullName" className="block text-xs font-medium text-slate-700 mb-1">Họ tên <RequiredMark /></label>
                    <input id="regFullName" data-field="regFullName" type="text" value={regFullName} onChange={e => { setRegFullName(e.target.value); setRegistrationErrors(p => ({ ...p, regFullName: '' })); }} aria-invalid={Boolean(registrationErrors.regFullName)} className={getFieldErrorClass(Boolean(registrationErrors.regFullName), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                    <FieldError message={registrationErrors.regFullName} />
                  </div>
                  <div>
                    <label htmlFor="regEmail" className="block text-xs font-medium text-slate-700 mb-1">Email/Gmail <RequiredMark /></label>
                    <input id="regEmail" data-field="regEmail" type="email" value={regEmail} onChange={e => { setRegEmail(e.target.value); setRegistrationErrors(p => ({ ...p, regEmail: '' })); }} aria-invalid={Boolean(registrationErrors.regEmail)} className={getFieldErrorClass(Boolean(registrationErrors.regEmail), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                    <FieldError message={registrationErrors.regEmail} />
                  </div>
                  <div>
                    <label htmlFor="regPhone" className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại <RequiredMark /></label>
                    <div className="flex gap-2">
                      <input id="regPhone" data-field="regPhone" type="text" disabled={otpVerified} value={regPhone} onChange={e => { setRegPhone(e.target.value); setRegistrationErrors(p => ({ ...p, regPhone: '', otp: '' })); }} aria-invalid={Boolean(registrationErrors.regPhone)} className={getFieldErrorClass(Boolean(registrationErrors.regPhone || registrationErrors.otp), 'flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50')} />
                      {!otpVerified && (
                        <button type="button" onClick={handleSendOTP} disabled={!regPhone || otpCountdown > 0} className="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-medium hover:bg-slate-200 disabled:opacity-50">
                          {otpCountdown > 0 ? `Chờ ${otpCountdown}s` : 'Gửi mã OTP'}
                        </button>
                      )}
                      {otpVerified && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Đã xác thực</span>}
                    </div>
                    <FieldError message={registrationErrors.regPhone || registrationErrors.otp} />
                  </div>
                  {otpSent && !otpVerified && (
                    <div className="flex gap-2 bg-slate-50 p-2 rounded-md border border-slate-200">
                      <input id="otp" data-field="otp" type="text" inputMode="numeric" placeholder="Nhập mã OTP 6 số" value={otpCode} onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setRegistrationErrors(p => ({ ...p, otp: '' })); }} className={getFieldErrorClass(Boolean(registrationErrors.otp), 'flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} aria-invalid={Boolean(registrationErrors.otp)} />
                      <button type="button" onClick={handleVerifyOTP} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700">
                        Xác nhận
                      </button>
                    </div>
                  )}
                  {otpNotice && <p className="text-xs text-blue-700 mt-2">{otpNotice}</p>}
                </div>
              </div>

              <div className="pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Tài khoản đăng nhập</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="regUsername" className="block text-xs font-medium text-slate-700 mb-1">Tên đăng nhập <RequiredMark /></label>
                    <input id="regUsername" data-field="regUsername" type="text" value={regUsername} onChange={e => { setRegUsername(e.target.value); setRegistrationErrors(p => ({ ...p, regUsername: '' })); }} aria-invalid={Boolean(registrationErrors.regUsername)} className={getFieldErrorClass(Boolean(registrationErrors.regUsername), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                    <FieldError message={registrationErrors.regUsername} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="regPassword" className="block text-xs font-medium text-slate-700 mb-1">Mật khẩu <RequiredMark /></label>
                      <input id="regPassword" data-field="regPassword" type="password" value={regPassword} onChange={e => { setRegPassword(e.target.value); setRegistrationErrors(p => ({ ...p, regPassword: '' })); }} aria-invalid={Boolean(registrationErrors.regPassword)} className={getFieldErrorClass(Boolean(registrationErrors.regPassword), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.regPassword} />
                    </div>
                    <div>
                      <label htmlFor="regConfirmPassword" className="block text-xs font-medium text-slate-700 mb-1">Xác nhận mật khẩu <RequiredMark /></label>
                      <input id="regConfirmPassword" data-field="regConfirmPassword" type="password" value={regConfirmPassword} onChange={e => { setRegConfirmPassword(e.target.value); setRegistrationErrors(p => ({ ...p, regConfirmPassword: '' })); }} aria-invalid={Boolean(registrationErrors.regConfirmPassword)} className={getFieldErrorClass(Boolean(registrationErrors.regConfirmPassword), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.regConfirmPassword} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-3">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Thông tin Công ty</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label htmlFor="compName" className="block text-xs font-medium text-slate-700 mb-1">Tên công ty <RequiredMark /></label>
                      <input id="compName" data-field="compName" type="text" value={compName} onChange={e => { setCompName(e.target.value); setRegistrationErrors(p => ({ ...p, compName: '' })); }} aria-invalid={Boolean(registrationErrors.compName)} className={getFieldErrorClass(Boolean(registrationErrors.compName), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.compName} />
                    </div>
                    <div>
                      <label htmlFor="compTaxCode" className="block text-xs font-medium text-slate-700 mb-1">Mã số thuế <RequiredMark /></label>
                      <input id="compTaxCode" data-field="compTaxCode" type="text" value={compTaxCode} onChange={e => { setCompTaxCode(e.target.value); setRegistrationErrors(p => ({ ...p, compTaxCode: '' })); }} aria-invalid={Boolean(registrationErrors.compTaxCode)} className={getFieldErrorClass(Boolean(registrationErrors.compTaxCode), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.compTaxCode} />
                    </div>
                    <div>
                      <label htmlFor="compPhone" className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại công ty <RequiredMark /></label>
                      <input id="compPhone" data-field="compPhone" type="text" value={compPhone} onChange={e => { setCompPhone(e.target.value); setRegistrationErrors(p => ({ ...p, compPhone: '' })); }} aria-invalid={Boolean(registrationErrors.compPhone)} className={getFieldErrorClass(Boolean(registrationErrors.compPhone), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.compPhone} />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="compAddress" className="block text-xs font-medium text-slate-700 mb-1">Địa chỉ <RequiredMark /></label>
                      <input id="compAddress" data-field="compAddress" type="text" value={compAddress} onChange={e => { setCompAddress(e.target.value); setRegistrationErrors(p => ({ ...p, compAddress: '' })); }} aria-invalid={Boolean(registrationErrors.compAddress)} className={getFieldErrorClass(Boolean(registrationErrors.compAddress), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.compAddress} />
                    </div>
                    <div>
                      <label htmlFor="compEmail" className="block text-xs font-medium text-slate-700 mb-1">Email công ty <RequiredMark /></label>
                      <input id="compEmail" data-field="compEmail" type="email" value={compEmail} onChange={e => { setCompEmail(e.target.value); setRegistrationErrors(p => ({ ...p, compEmail: '' })); }} aria-invalid={Boolean(registrationErrors.compEmail)} className={getFieldErrorClass(Boolean(registrationErrors.compEmail), 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500')} />
                      <FieldError message={registrationErrors.compEmail} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Loại hình kinh doanh</label>
                      <select value={compBusinessType} onChange={e => setCompBusinessType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="FORWARDER">FORWARDER</option>
                        <option value="FACTORY">FACTORY</option>
                        <option value="TRUCKER">TRUCKER</option>
                        <option value="SHIPPING_LINE">SHIPPING_LINE</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Vai trò tham gia ECont</label>
                      <select value={compRole} onChange={e => setCompRole(e.target.value as UserRole)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="ENTERPRISE_A">Bên A (Có nguồn vỏ / Đơn vị trả rỗng)</option>
                        <option value="ENTERPRISE_B">Bên B (Cần vỏ / Đơn vị đóng hàng)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
                >
                  Đăng ký tài khoản
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
