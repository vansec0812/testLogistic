import React, { useState, useEffect } from "react";
import {
  FieldErrors,
  FieldError,
  FormErrorSummary,
  RequiredMark,
  getFieldErrorClass,
  scrollToFirstFieldError,
} from "../components/FormValidation";
import {
  required,
  setError,
  validEmail,
  validPhone,
} from "../lib/formValidation";
import { useAuth } from "../context/AuthContext";
import { useDatabase } from "../context/DatabaseContext";
import { Company, UserRole } from "../types";
import { isApiConfigured, postApi } from "../services/apiClient";
import { DEMO_LOGIN_ACCOUNTS } from "../data/demoAccounts";
import { PasswordRecoveryPanel } from "../components/PasswordRecoveryPanel";
import { getAccountById } from "../services/accountService";
import {
  LogIn,
  UserPlus,
  X,
  Boxes,
  Building2,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  KeyRound,
  FileCheck2,
  Lock,
  User,
  Radio,
  Clock,
  Phone,
  Mail,
  Shield,
} from "lucide-react";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

interface RoleCardOption {
  role: UserRole;
  name: string;
  badge: string;
  badgeColor: string;
  desc: string;
  icon: React.ReactNode;
  defaultUsername: string;
  defaultPassword: string;
  sampleCompany: string;
}

const ROLE_OPTIONS: RoleCardOption[] = [
  {
    role: "ENTERPRISE_A",
    name: "Nhà cung cấp Container",
    badge: "Bên A · Nguồn vỏ",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    desc: "Đơn vị Forwarder/vận tải có vỏ cont rỗng nhập khẩu cần giao/tái sử dụng",
    icon: <Boxes className="w-5 h-5 text-emerald-400" />,
    defaultUsername: "bena",
    defaultPassword: "bena123",
    sampleCompany: "Hưng Thịnh Logistics",
  },
  {
    role: "ENTERPRISE_B",
    name: "Cần vỏ Container",
    badge: "Bên B · Đóng hàng",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/40",
    desc: "Nhà máy, doanh nghiệp xuất nhập khẩu cần vỏ cont đóng hàng theo Booking",
    icon: <Truck className="w-5 h-5 text-blue-400" />,
    defaultUsername: "benb",
    defaultPassword: "benb123",
    sampleCompany: "Toàn Cầu Export Corp",
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const { submitCompanyRegistration } = useDatabase();

  // Modal toggle state (default false to show full background and landing content)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [selectedRole, setSelectedRole] = useState<UserRole>("ENTERPRISE_A");

  // Login State
  const [username, setUsername] = useState("bena");
  const [password, setPassword] = useState("bena123");
  const [loginError, setLoginError] = useState("");
  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const [showRecovery, setShowRecovery] = useState(false);

  // Register State
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Company Info State
  const [compName, setCompName] = useState("");
  const [compTaxCode, setCompTaxCode] = useState("");
  const [compAddress, setCompAddress] = useState("");
  const [compPhone, setCompPhone] = useState("");
  const [compEmail, setCompEmail] = useState("");
  const [compBusinessType, setCompBusinessType] = useState("FORWARDER");
  const [compRole, setCompRole] = useState<UserRole>("ENTERPRISE_A");

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [otpSessionId, setOtpSessionId] = useState<string | undefined>();
  const [otpNotice, setOtpNotice] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState("");
  const [registrationErrors, setRegistrationErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleOpenAuth = (tab: "login" | "register", role?: UserRole) => {
    setActiveTab(tab);
    if (role) {
      handleSelectRole(role);
    }
    setIsAuthModalOpen(true);
    setShowRecovery(false);
  };

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setCompRole(role);
    const option = ROLE_OPTIONS.find((r) => r.role === role);
    if (option) {
      const activeAccount = getAccountById(
        role === "ENTERPRISE_A" ? "USR-A01" : "USR-B01",
      );
      setUsername(activeAccount?.username || option.defaultUsername);
      setPassword(activeAccount?.password || option.defaultPassword);
      setLoginError("");
      setLoginErrors({});
    } else if (role === "OPS") {
      const activeAccount = getAccountById("USR-OPS01");
      setUsername(activeAccount?.username || "ops");
      setPassword(activeAccount?.password || "ops123");
      setLoginError("");
      setLoginErrors({});
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const errors: FieldErrors = {};
    setError(
      errors,
      "username",
      required(username, "Vui lòng nhập tên đăng nhập."),
    );
    setError(errors, "password", required(password, "Vui lòng nhập mật khẩu."));
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    const result = login(username, password);
    if (result.success) {
      setIsAuthModalOpen(false);
      onLoginSuccess();
      setLoginErrors({});
    } else {
      setLoginError(result.message);
    }
  };

  const handleSendOTP = async () => {
    if (!regPhone) return;
    setOtpNotice("");
    try {
      if (isApiConfigured) {
        const response = await postApi<{ sessionId?: string }>(
          "/api/auth/otp/request",
          { phone: regPhone },
        );
        setOtpSessionId(response?.sessionId);
        setOtpNotice("Mã OTP đã được gửi qua SMS.");
      } else {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        setDemoOtpCode(code);
        setOtpNotice(
          `Chế độ demo: mã OTP là ${code}. Khi vận hành thật, mã sẽ được gửi qua SMS.`,
        );
      }
    } catch (error: any) {
      setRegError(error?.message || "Không thể gửi OTP.");
      return;
    }
    setOtpSent(true);
    setOtpCountdown(60);
  };

  const handleVerifyOTP = async () => {
    try {
      const verified = isApiConfigured
        ? (
            await postApi<{ verified?: boolean }>("/api/auth/otp/verify", {
              phone: regPhone,
              code: otpCode,
              sessionId: otpSessionId,
            })
          ).verified !== false
        : otpCode === demoOtpCode;
      if (verified) {
        setOtpVerified(true);
        setOtpNotice("Số điện thoại đã được xác thực.");
        setRegError("");
      } else {
        setRegError("Mã OTP không hợp lệ hoặc đã hết hạn.");
      }
    } catch (error: any) {
      setRegError(error?.message || "Không thể xác thực OTP.");
    }
  };

  const validateRegistrationForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    setError(
      errors,
      "regFullName",
      required(regFullName, "Vui lòng nhập họ tên."),
    );
    setError(
      errors,
      "regPhone",
      required(regPhone, "Vui lòng nhập số điện thoại."),
    );
    if (regPhone.trim()) setError(errors, "regPhone", validPhone(regPhone));
    setError(
      errors,
      "regEmail",
      required(regEmail, "Vui lòng nhập email/Gmail."),
    );
    if (regEmail.trim()) setError(errors, "regEmail", validEmail(regEmail));
    setError(
      errors,
      "regUsername",
      required(regUsername, "Vui lòng nhập tên đăng nhập."),
    );
    setError(
      errors,
      "regPassword",
      required(regPassword, "Vui lòng nhập mật khẩu."),
    );
    if (regPassword && regPassword.length < 8)
      errors.regPassword = "Mật khẩu phải có ít nhất 8 ký tự.";
    setError(
      errors,
      "regConfirmPassword",
      required(regConfirmPassword, "Vui lòng xác nhận mật khẩu."),
    );
    if (regConfirmPassword && regPassword !== regConfirmPassword)
      errors.regConfirmPassword = "Mật khẩu xác nhận không khớp.";
    if (!otpVerified) {
      errors.otp =
        "Vui lòng xác thực số điện thoại bằng OTP trước khi đăng ký.";
      if (!otpSent)
        errors.regPhone = "Vui lòng gửi và xác thực mã OTP cho số điện thoại.";
    }
    setError(
      errors,
      "compName",
      required(compName, "Vui lòng nhập tên công ty."),
    );
    setError(
      errors,
      "compTaxCode",
      required(compTaxCode, "Vui lòng nhập mã số thuế công ty."),
    );
    if (compTaxCode.trim() && !/^\d{8,14}$/.test(compTaxCode.trim()))
      errors.compTaxCode = "Mã số thuế phải gồm 8–14 chữ số.";
    setError(
      errors,
      "compAddress",
      required(compAddress, "Vui lòng nhập địa chỉ công ty."),
    );
    setError(
      errors,
      "compPhone",
      required(compPhone, "Vui lòng nhập số điện thoại công ty."),
    );
    if (compPhone.trim())
      setError(
        errors,
        "compPhone",
        validPhone(compPhone, "Số điện thoại công ty không hợp lệ."),
      );
    setError(
      errors,
      "compEmail",
      required(compEmail, "Vui lòng nhập email công ty."),
    );
    if (compEmail.trim())
      setError(
        errors,
        "compEmail",
        validEmail(compEmail, "Email công ty không hợp lệ."),
      );
    return errors;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    const errors = validateRegistrationForm();
    setRegistrationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setRegError(
        "Vui lòng kiểm tra các trường được đánh dấu và hoàn tất xác thực OTP.",
      );
      scrollToFirstFieldError(errors);
      return;
    }
    const registeredUsers = JSON.parse(
      localStorage.getItem("econt_registered_users") || "[]",
    );
    if (
      registeredUsers.some(
        (user: any) =>
          user.username === regUsername ||
          user.email === regEmail ||
          user.phone === regPhone,
      )
    ) {
      setRegError(
        "Tên đăng nhập, email hoặc số điện thoại đã được sử dụng. V1 chỉ cấp một tài khoản cho mỗi doanh nghiệp.",
      );
      return;
    }

    const companyResult = submitCompanyRegistration({
      taxCode: compTaxCode,
      companyName: compName,
      shortName: compName,
      businessType: compBusinessType as Company["businessType"],
      address: compAddress,
      representativeName: regFullName,
      representativePhone: compPhone,
      representativeEmail: compEmail,
      verificationStatus: "PENDING_VERIFICATION",
    });
    if (!companyResult.success || !companyResult.data) {
      setRegError(companyResult.message);
      return;
    }

    if (isApiConfigured) {
      try {
        await postApi("/api/auth/register", {
          fullName: regFullName,
          phone: regPhone,
          email: regEmail,
          username: regUsername,
          password: regPassword,
          companyId: (companyResult.data as Company).id,
          company: companyResult.data,
        });
      } catch (error: any) {
        setRegError(
          error?.message || "Không thể tạo tài khoản trên ECont API.",
        );
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
    localStorage.setItem(
      "econt_registered_users",
      JSON.stringify(registeredUsers),
    );

    setRegSuccess(true);
    setTimeout(() => {
      setRegSuccess(false);
      setActiveTab("login");
      setUsername(regUsername);
    }, 2500);
  };

  return (
    <div
      className="min-h-screen overflow-hidden flex flex-col justify-between bg-cover bg-center bg-no-repeat bg-fixed text-slate-100 font-sans selection:bg-blue-600 selection:text-white relative"
      style={{ backgroundImage: `url('/login-bg.jpg')` }}
    >
      {/* Soft gradient overlay: allows vibrant container colors & port brightness to shine through while text on left remains crisp */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-900/40 to-transparent backdrop-blur-[0.5px] pointer-events-none" />

      {/* TOP NAVBAR */}
      <header className="relative z-20 w-full px-6 lg:px-12 py-3 sm:py-3.5 flex items-center justify-between border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg shadow-blue-500/30 border border-white/20">
            E
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow">
                ECont Logistics
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Street-Turn 2.0
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 hidden sm:block">
              Nền tảng Tái sử dụng & Điều phối Vỏ Container Rỗng
            </p>
          </div>
        </div>

        {/* Top-Right Action Button: simplified to just 'Đăng nhập' to avoid redundancy with Hero CTA */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenAuth("login")}
            className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-sm transition-all duration-200 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="w-4 h-4 text-cyan-300" />
            <span>Đăng nhập</span>
          </button>
        </div>
      </header>

      {/* MAIN HERO CONTENT (Left / Middle Screen) */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-3 sm:py-4 max-w-4xl">
        {/* Category Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] sm:text-xs font-semibold uppercase tracking-wider backdrop-blur-md mb-2 sm:mb-2.5 w-fit animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <span>Giải pháp Logistics</span>
        </div>

        {/* Main Headline (H1): font text-3xl md:text-5xl lg:text-5xl leading-tight, balanced wrapping */}
        <h1 className="text-3xl md:text-5xl lg:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-lg max-w-3xl">
          Tối ưu hóa vòng quay{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-300">
            Container rỗng
          </span>
          <span className="block text-2xl md:text-4xl lg:text-4xl font-extrabold text-slate-100 mt-1 sm:mt-1.5">
            Kết nối trực tiếp Chủ hàng &amp;{" "}
            <span className="whitespace-nowrap">Vận tải</span>
          </span>
        </h1>

        {/* Subtitle: concise 2-3 lines */}
        <p className="mt-2 sm:mt-2.5 text-sm sm:text-base text-slate-200/90 leading-relaxed font-normal max-w-2xl drop-shadow">
          Mô hình điều phối <strong>Street-turn</strong> tiên phong: Tái sử dụng
          vỏ container rỗng nhập khẩu cho hàng xuất khẩu trực tiếp, cắt giảm 50%
          chi phí xe rỗng và đối soát tự động với Hãng tàu.
        </p>

        {/* CTA Launch Buttons — positioned immediately below the Street-turn description */}
        <div className="my-3 sm:my-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenAuth("login")}
            className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 border border-white/20 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
          >
            <span>Vào hệ thống trải nghiệm</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenAuth("register")}
            className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm border border-white/25 backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/40 active:scale-95"
          >
            <span>Đăng ký Doanh nghiệp</span>
          </button>
        </div>

        {/* 3 Core Value Cards — positioned immediately below CTA with refined glassmorphism and compact padding */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-3xl w-full">
          <div className="rounded-xl p-3 sm:p-3.5 bg-slate-900/75 hover:bg-slate-900/85 border border-white/15 backdrop-blur-md shadow-md shadow-black/20 hover:border-cyan-400/40 transition-all">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-cyan-300 mb-1.5">
              <Boxes className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Khớp lệnh tự động
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 leading-snug">
              Ghép cont theo Hãng tàu, cự ly Dmax và hạn Cut-off booking.
            </p>
          </div>

          <div className="rounded-xl p-3 sm:p-3.5 bg-slate-900/75 hover:bg-slate-900/85 border border-white/15 backdrop-blur-md shadow-md shadow-black/20 hover:border-emerald-400/40 transition-all">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-1.5">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Duyệt RU Hãng tàu
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 leading-snug">
              Quản lý công văn RU điện tử, phân bổ phí chia sẻ minh bạch.
            </p>
          </div>

          <div className="rounded-xl p-3 sm:p-3.5 bg-slate-900/75 hover:bg-slate-900/85 border border-white/15 backdrop-blur-md shadow-md shadow-black/20 hover:border-amber-400/40 transition-all">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 mb-1.5">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Giám định IICL 7 góc ảnh
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 leading-snug">
              Checklist hiện trường, biên bản bàn giao kép mã băm SHA-256.
            </p>
          </div>
        </div>
      </main>

      {/* FOOTER BAR / TRUST BAR: enhanced contrast and legibility */}
      <footer className="relative z-10 w-full px-6 lg:px-12 py-2.5 sm:py-3 border-t border-white/15 bg-slate-950/85 backdrop-blur-lg flex flex-wrap items-center justify-between text-xs sm:text-[13px] text-slate-200 gap-3">
        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap font-medium">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-100 shadow-sm">
            <span>📍</span>
            <span>Cụm cảng:</span>
            <strong className="text-white">
              Tân Cảng Cát Lái · ICD Phước Long · Cái Mép · Đình Vũ
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-100 shadow-sm">
            <span>🚢</span>
            <span>Hãng tàu:</span>
            <strong className="text-cyan-300">
              Maersk, CMA CGM, ONE, Evergreen, COSCO
            </strong>
          </span>
        </div>
        <div className="text-slate-300 text-xs font-normal">
          <span>© 2026 ECont Logistics. Toàn quyền bảo lưu.</span>
        </div>
      </footer>

      {/* AUTHENTICATION MODAL (Toggled by Top-Right Buttons or Hero CTA) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsAuthModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-2xl bg-white text-slate-800 rounded-3xl shadow-2xl border border-white/50 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    E
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {activeTab === "login"
                      ? "Đăng nhập hệ thống ECont"
                      : "Đăng ký thành viên mới"}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {activeTab === "login"
                    ? "Chọn vai trò và đăng nhập để bắt đầu điều phối hoặc tìm vỏ container."
                    : "Đăng ký hồ sơ doanh nghiệp để tham gia mạng lưới Street-turn."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
              {/* Tab Switcher */}
              <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    setShowRecovery(false);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === "login"
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    activeTab === "register"
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng ký</span>
                </button>
              </div>

              {/* GROUPBOX: PHÂN QUYỀN TRUY CẬP (ROLE SELECTOR) - CHỈ HIỂN THỊ KHI ĐĂNG NHẬP */}
              {activeTab === "login" && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <span>Phân quyền · Chọn vai trò của bạn</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (Bấm để tự động điền tài khoản mẫu)
                    </span>
                  </div>

                  {/* 2 Role Selection Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROLE_OPTIONS.map((opt) => {
                      const isSelected = selectedRole === opt.role;
                      return (
                        <div
                          key={opt.role}
                          onClick={() => handleSelectRole(opt.role)}
                          className={`cursor-pointer rounded-2xl p-3.5 border transition-all text-left flex flex-col justify-between ${
                            isSelected
                              ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20"
                              : "bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="p-2 rounded-xl bg-slate-100">
                                {opt.icon}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {isSelected
                                  ? "Đang chọn ✓"
                                  : opt.role === "ENTERPRISE_A"
                                    ? "Bên A · Cung cấp"
                                    : "Bên B · Cần vỏ"}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-900 leading-tight">
                              {opt.name}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              {opt.desc}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-700 font-semibold text-[11px]">
                              {opt.sampleCompany}
                            </span>
                            <span className="text-blue-600 font-bold hover:underline text-[11px]">
                              {isSelected ? "Đã chọn" : "Chọn vai trò →"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Discreet Ops Access for internal operations */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Dành riêng cho Ban Điều phối & Vận hành ECont:
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole("OPS");
                        const activeAccount = getAccountById("USR-OPS01");
                        setUsername(activeAccount?.username || "ops");
                        setPassword(activeAccount?.password || "ops123");
                        setLoginErrors({});
                        setLoginError("");
                      }}
                      className={`font-semibold transition-all flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                        selectedRole === "OPS"
                          ? "text-amber-800 bg-amber-100 border border-amber-300 font-bold shadow-sm"
                          : "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                      }`}
                    >
                      <span>
                        Cổng Ops Nội bộ {selectedRole === "OPS" && "✓"}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* LOGIN FORM */}
              {activeTab === "login" ? (
                showRecovery ? (
                  <PasswordRecoveryPanel
                    onBack={() => setShowRecovery(false)}
                    onSuccess={(recoveredUsername) => {
                      setShowRecovery(false);
                      setUsername(recoveredUsername);
                      setPassword("");
                      setLoginError("");
                    }}
                  />
                ) : (
                  <form noValidate className="space-y-4" onSubmit={handleLogin}>
                    <FormErrorSummary errors={loginErrors} />
                    {loginError && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold border border-red-200 flex items-center gap-2">
                        <span>⚠️ {loginError}</span>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="loginUsername"
                        className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1"
                      >
                        Tên đăng nhập <RequiredMark />
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          id="loginUsername"
                          data-field="username"
                          type="text"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setLoginErrors((p) => ({ ...p, username: "" }));
                          }}
                          placeholder="Nhập tên đăng nhập hoặc chọn vai trò ở trên"
                          aria-invalid={Boolean(loginErrors.username)}
                          className={getFieldErrorClass(
                            Boolean(loginErrors.username),
                            "w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm",
                          )}
                        />
                      </div>
                      <FieldError message={loginErrors.username} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="loginPassword"
                          className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
                        >
                          Mật khẩu <RequiredMark />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginError("");
                            setShowRecovery(true);
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Quên mật khẩu?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="loginPassword"
                          data-field="password"
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setLoginErrors((p) => ({ ...p, password: "" }));
                          }}
                          placeholder="Nhập mật khẩu"
                          aria-invalid={Boolean(loginErrors.password)}
                          className={getFieldErrorClass(
                            Boolean(loginErrors.password),
                            "w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm",
                          )}
                        />
                      </div>
                      <FieldError message={loginErrors.password} />
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Đăng nhập vào ECont</span>
                    </button>

                    {/* Quick helper list */}
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[11px] text-slate-500 font-semibold mb-1.5">
                        Tài khoản mẫu doanh nghiệp (bấm để tự động điền nhanh):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DEMO_LOGIN_ACCOUNTS.filter((acc) => acc.role !== "OPS")
                          .slice(0, 2)
                          .map((acc) => {
                            const active = getAccountById(acc.userId);
                            const u = active?.username || acc.username;
                            const p = active?.password || acc.password;
                            return (
                              <button
                                key={acc.username}
                                type="button"
                                onClick={() => {
                                  setUsername(u);
                                  setPassword(p);
                                  setSelectedRole(acc.role);
                                  setLoginErrors({});
                                  setLoginError("");
                                }}
                                className="text-left p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                              >
                                <div className="text-[11px] font-bold text-blue-700 font-mono">
                                  {u} / {p}
                                </div>
                                <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                  {acc.role === "ENTERPRISE_A"
                                    ? "Hưng Thịnh · Nhà cung cấp vỏ"
                                    : "Toàn Cầu · Cần vỏ đóng hàng"}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </form>
                )
              ) : (
                /* REGISTER FORM */
                <form
                  noValidate
                  className="space-y-4 text-xs"
                  onSubmit={handleRegister}
                >
                  {regSuccess && (
                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs font-semibold border border-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>
                        Đăng ký thành công! Hồ sơ của bạn đã được chuyển tới Ops
                        để xác minh.
                      </span>
                    </div>
                  )}
                  {regError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs font-semibold border border-red-200">
                      {regError}
                    </div>
                  )}
                  <FormErrorSummary errors={registrationErrors} />

                  {/* Section 1: Thông tin cá nhân */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Thông tin người đại diện</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Họ và tên <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={regFullName}
                          onChange={(e) => {
                            setRegFullName(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              regFullName: "",
                            }));
                          }}
                          placeholder="VD: Nguyễn Văn Hưng"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.regFullName),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.regFullName} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Email liên hệ <RequiredMark />
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => {
                            setRegEmail(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              regEmail: "",
                            }));
                          }}
                          placeholder="VD: hung.nguyen@logistics.vn"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.regEmail),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.regEmail} />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-700 font-medium block mb-1">
                          Số điện thoại & Xác thực OTP <RequiredMark />
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={otpVerified}
                            value={regPhone}
                            onChange={(e) => {
                              setRegPhone(e.target.value);
                              setRegistrationErrors((p) => ({
                                ...p,
                                regPhone: "",
                                otp: "",
                              }));
                            }}
                            placeholder="VD: 0901234567"
                            className={getFieldErrorClass(
                              Boolean(
                                registrationErrors.regPhone ||
                                registrationErrors.otp,
                              ),
                              "flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100",
                            )}
                          />
                          {!otpVerified && (
                            <button
                              type="button"
                              onClick={handleSendOTP}
                              disabled={!regPhone || otpCountdown > 0}
                              className="px-3.5 py-2 bg-blue-600 text-white font-semibold rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 shrink-0"
                            >
                              {otpCountdown > 0
                                ? `Chờ ${otpCountdown}s`
                                : "Gửi OTP"}
                            </button>
                          )}
                          {otpVerified && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                              Đã xác thực ✓
                            </span>
                          )}
                        </div>
                        <FieldError
                          message={
                            registrationErrors.regPhone ||
                            registrationErrors.otp
                          }
                        />

                        {otpSent && !otpVerified && (
                          <div className="flex gap-2 mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Nhập mã OTP 6 số"
                              value={otpCode}
                              onChange={(e) => {
                                setOtpCode(
                                  e.target.value.replace(/\D/g, "").slice(0, 6),
                                );
                                setRegistrationErrors((p) => ({
                                  ...p,
                                  otp: "",
                                }));
                              }}
                              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOTP}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700"
                            >
                              Xác nhận mã
                            </button>
                          </div>
                        )}
                        {otpNotice && (
                          <p className="text-[11px] text-blue-700 font-medium mt-1">
                            {otpNotice}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Tài khoản đăng nhập */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. Khởi tạo thông tin đăng nhập</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Tên đăng nhập <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={regUsername}
                          onChange={(e) => {
                            setRegUsername(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              regUsername: "",
                            }));
                          }}
                          placeholder="VD: hungthinh_admin"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.regUsername),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.regUsername} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Mật khẩu <RequiredMark />
                        </label>
                        <input
                          type="password"
                          value={regPassword}
                          onChange={(e) => {
                            setRegPassword(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              regPassword: "",
                            }));
                          }}
                          placeholder="Tối thiểu 8 ký tự"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.regPassword),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.regPassword} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Xác nhận mật khẩu <RequiredMark />
                        </label>
                        <input
                          type="password"
                          value={regConfirmPassword}
                          onChange={(e) => {
                            setRegConfirmPassword(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              regConfirmPassword: "",
                            }));
                          }}
                          placeholder="Nhập lại mật khẩu"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.regConfirmPassword),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError
                          message={registrationErrors.regConfirmPassword}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Doanh nghiệp */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>3. Thông tin Công ty & Doanh nghiệp</span>
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-slate-700 font-medium block mb-1">
                          Tên công ty đầy đủ <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={compName}
                          onChange={(e) => {
                            setCompName(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              compName: "",
                            }));
                          }}
                          placeholder="VD: Công ty TNHH Tiếp Vận Hưng Thịnh"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.compName),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.compName} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Mã số thuế <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={compTaxCode}
                          onChange={(e) => {
                            setCompTaxCode(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              compTaxCode: "",
                            }));
                          }}
                          placeholder="VD: 0314589234"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.compTaxCode),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.compTaxCode} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Số điện thoại công ty <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={compPhone}
                          onChange={(e) => {
                            setCompPhone(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              compPhone: "",
                            }));
                          }}
                          placeholder="VD: 02839998888"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.compPhone),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.compPhone} />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-700 font-medium block mb-1">
                          Địa chỉ trụ sở <RequiredMark />
                        </label>
                        <input
                          type="text"
                          value={compAddress}
                          onChange={(e) => {
                            setCompAddress(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              compAddress: "",
                            }));
                          }}
                          placeholder="VD: KCN Cát Lái 2, TP. Thủ Đức, TP.HCM"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.compAddress),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.compAddress} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Email công ty <RequiredMark />
                        </label>
                        <input
                          type="email"
                          value={compEmail}
                          onChange={(e) => {
                            setCompEmail(e.target.value);
                            setRegistrationErrors((p) => ({
                              ...p,
                              compEmail: "",
                            }));
                          }}
                          placeholder="contact@hungthinhlog.vn"
                          className={getFieldErrorClass(
                            Boolean(registrationErrors.compEmail),
                            "w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none",
                          )}
                        />
                        <FieldError message={registrationErrors.compEmail} />
                      </div>

                      <div>
                        <label className="text-slate-700 font-medium block mb-1">
                          Loại hình kinh doanh
                        </label>
                        <select
                          value={compBusinessType}
                          onChange={(e) => setCompBusinessType(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="FORWARDER">
                            FORWARDER / Logistics
                          </option>
                          <option value="FACTORY">
                            FACTORY / Nhà máy xuất khẩu
                          </option>
                          <option value="TRUCKER">
                            TRUCKER / Đơn vị vận tải
                          </option>
                          <option value="SHIPPING_LINE">
                            SHIPPING_LINE / Hãng tàu
                          </option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-700 font-medium block mb-1">
                          Vai trò tham gia ECont (Chỉ áp dụng Doanh nghiệp)
                        </label>
                        <select
                          value={compRole}
                          onChange={(e) =>
                            setCompRole(e.target.value as UserRole)
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="ENTERPRISE_A">
                            Nhà cung cấp Container (Bên A - Có nguồn vỏ nhập
                            khẩu)
                          </option>
                          <option value="ENTERPRISE_B">
                            Cần vỏ Container (Bên B - Đơn vị đóng hàng xuất
                            khẩu)
                          </option>
                        </select>
                        <p className="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Lưu ý bảo mật: Tài khoản Ban Vận hành (Ops) là tài
                            khoản quản trị nội bộ do ECont cấp riêng, không cho
                            phép đăng ký công khai.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Gửi hồ sơ đăng ký doanh nghiệp</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
