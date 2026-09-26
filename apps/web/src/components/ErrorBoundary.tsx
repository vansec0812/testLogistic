import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-rose-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl font-bold">
                ⚠️
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                  Đã xảy ra sự cố hiển thị giao diện
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Dữ liệu tạm thời hoặc phiên đăng nhập trước đó bị xung đột
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-60">
              <p className="font-bold text-rose-400 mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              <pre className="text-slate-400 whitespace-pre-wrap">
                {this.state.error?.stack}
              </pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all text-center"
              >
                🔄 Xóa bộ nhớ đệm (Reset Cache) & Tải lại
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
