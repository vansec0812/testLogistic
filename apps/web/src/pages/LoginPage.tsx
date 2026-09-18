import React, { useState, useEffect } from 'react';
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
    const result = login(username, password);
    if (result.success) {
      onLoginSuccess();
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!otpVerified) {
      alert('Vui lòng xác thực số điện thoại trước!');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      alert('Mật khẩu không khớp!');
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
            <form className="space-y-6" onSubmit={handleLogin}>
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                  {loginError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên đăng nhập</label>
                <div className="mt-1">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
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
            <form className="space-y-4" onSubmit={handleRegister}>
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
              
              <div className="pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Thông tin cá nhân</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Họ tên</label>
                    <input type="text" required value={regFullName} onChange={e => setRegFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email/Gmail</label>
                    <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại</label>
                    <div className="flex gap-2">
                      <input type="text" required disabled={otpVerified} value={regPhone} onChange={e => setRegPhone(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50" />
                      {!otpVerified && (
                        <button type="button" onClick={handleSendOTP} disabled={!regPhone || otpCountdown > 0} className="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-medium hover:bg-slate-200 disabled:opacity-50">
                          {otpCountdown > 0 ? `Chờ ${otpCountdown}s` : 'Gửi mã OTP'}
                        </button>
                      )}
                      {otpVerified && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Đã xác thực</span>}
                    </div>
                  </div>
                  {otpSent && !otpVerified && (
                    <div className="flex gap-2 bg-slate-50 p-2 rounded-md border border-slate-200">
                      <input type="text" inputMode="numeric" placeholder="Nhập mã OTP 6 số" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                    <input type="text" required value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mật khẩu</label>
                      <input type="password" required value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Xác nhận mật khẩu</label>
                      <input type="password" required value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-3">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Thông tin Công ty</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Tên công ty</label>
                      <input type="text" required value={compName} onChange={e => setCompName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mã số thuế</label>
                      <input type="text" required value={compTaxCode} onChange={e => setCompTaxCode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại công ty</label>
                      <input type="text" required value={compPhone} onChange={e => setCompPhone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Địa chỉ</label>
                      <input type="text" required value={compAddress} onChange={e => setCompAddress(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Email công ty</label>
                      <input type="email" required value={compEmail} onChange={e => setCompEmail(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
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
                  disabled={!otpVerified}
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
