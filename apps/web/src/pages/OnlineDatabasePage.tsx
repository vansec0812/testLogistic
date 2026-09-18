// ==============================================================================
// ECont Online Database Management Console & SQL Studio
// Cổng Quản trị CSDL Online (Supabase / PostgreSQL Cloud) kèm link truy cập trực tiếp
// ==============================================================================

import React, { useState } from 'react';
import { FieldErrors, FieldError, FormErrorSummary, RequiredMark, getFieldErrorClass, scrollToFirstFieldError } from '../components/FormValidation';
import { required, setError } from '../lib/formValidation';
import { useDatabase } from '../context/DatabaseContext';
import { onlineDb } from '../services/onlineDbClient';
import { 
  Database, 
  ExternalLink, 
  RefreshCw, 
  Play, 
  Table, 
  CheckCircle2, 
  Search, 
  Sliders, 
  Terminal,
  RotateCcw,
  ShieldCheck,
  Server
} from 'lucide-react';

export const OnlineDatabasePage: React.FC = () => {
  const { 
    companies, 
    assets, 
    offers, 
    requests, 
    transactions, 
    cases, 
    auditLogs,
    onlineConfig, 
    isSyncing, 
    lastSyncMessage, 
    syncAllToOnlineDb, 
    resetToDemoData,
    updateOnlineConfig 
  } = useDatabase();

  const [activeTable, setActiveTable] = useState<string>('container_assets');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM container_assets LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: unknown[][]; error?: string } | null>(null);
  const [isExecutingSql, setIsExecutingSql] = useState<boolean>(false);

  // Cấu hình URL chỉnh sửa
  const [customDashboardUrl, setCustomDashboardUrl] = useState(onlineConfig.adminDashboardUrl);
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState(onlineConfig.supabaseUrl);
  const [settingsErrors, setSettingsErrors] = useState<FieldErrors>({});

  // Bản đồ các bảng dữ liệu
  const tablesMap: Record<string, { label: string; count: number; data: unknown[] }> = {
    companies: { label: 'Doanh nghiệp', count: companies.length, data: companies },
    container_assets: { label: 'Vỏ Container', count: assets.length, data: assets },
    offers: { label: 'Nguồn cung', count: offers.length, data: offers },
    container_requests: { label: 'Nhu cầu', count: requests.length, data: requests },
    transactions: { label: 'Giao dịch', count: transactions.length, data: transactions },
    cases: { label: 'Khiếu nại', count: cases.length, data: cases },
    audit_events: { label: 'Nhật ký kiểm toán', count: auditLogs.length, data: auditLogs }
  };

  const handleRunSql = async () => {
    setIsExecutingSql(true);
    const dataSnapshot: Record<string, unknown[]> = {
      companies,
      container_assets: assets,
      offers,
      container_requests: requests,
      transactions,
      cases,
      audit_events: auditLogs
    };

    const res = await onlineDb.executeSql(sqlQuery, dataSnapshot);
    setSqlResult(res);
    setIsExecutingSql(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    setError(errors, 'adminDashboardUrl', required(customDashboardUrl, 'Vui lòng nhập link quản trị database.'));
    setError(errors, 'supabaseUrl', required(customSupabaseUrl, 'Vui lòng nhập Supabase Project Host / REST Endpoint.'));
    if (customDashboardUrl.trim()) {
      try { new URL(customDashboardUrl); } catch { errors.adminDashboardUrl = 'Link quản trị database không hợp lệ.'; }
    }
    if (customSupabaseUrl.trim()) {
      try { new URL(customSupabaseUrl); } catch { errors.supabaseUrl = 'Supabase endpoint không hợp lệ.'; }
    }
    setSettingsErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstFieldError(errors);
      return;
    }
    updateOnlineConfig({
      adminDashboardUrl: customDashboardUrl,
      supabaseUrl: customSupabaseUrl
    });
    setSettingsErrors({});
    alert('Đã cập nhật cấu hình kết nối CSDL Online!');
  };

  // Dữ liệu bảng đang xem
  const currentTableInfo = tablesMap[activeTable];
  const tableRows = currentTableInfo?.data || [];

  return (
    <div className="space-y-6">
      {/* 1. Direct Online Admin Dashboard Banner */}
      <div className="bg-gradient-to-br from-brand-950 via-slate-900 to-navy-950 border border-brand-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                CSDL ONLINE ĐANG KẾT NỐI (POSTGRESQL CLOUD)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Database className="w-6 h-6 text-brand-400" />
              <span>CỔNG QUẢN TRỊ DATABASE ONLINE</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Hệ thống ECont được kết nối trực tiếp với CSDL PostgreSQL trên đám mây (Supabase Cloud). Bạn có thể mở bảng điều khiển trực tuyến độc lập để duyệt bảng, chạy SQL query, phân quyền và kiểm toán dữ liệu.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <a
              href={onlineConfig.adminDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-900/60 transition-all group"
            >
              <span>MỞ LINK QUẢN TRỊ DATABASE ONLINE</span>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>

            <button
              onClick={syncAllToOnlineDb}
              disabled={isSyncing}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-400' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Ngay'}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-brand-400" />
            <span>Host: <strong className="font-mono text-slate-200">{onlineConfig.supabaseUrl}</strong></span>
          </div>
          <span className="text-emerald-400 font-mono text-[11px]">{lastSyncMessage}</span>
        </div>
      </div>

      {/* 2. Interactive SQL Studio Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              TRÌNH THỰC THI SQL TRỰC TIẾP (SQL QUERY RUNNER)
            </h3>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 mr-1">Mẫu nhanh:</span>
            <button
              onClick={() => setSqlQuery('SELECT * FROM container_assets;')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            >
              assets
            </button>
            <button
              onClick={() => setSqlQuery('SELECT * FROM transactions;')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            >
              transactions
            </button>
            <button
              onClick={() => setSqlQuery('SELECT * FROM companies;')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            >
              companies
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-brand-300 font-mono text-xs focus:border-brand-500 outline-none"
            placeholder="Nhập câu lệnh SQL (VD: SELECT * FROM container_assets WHERE container_type = '40HC')..."
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Hỗ trợ cú pháp SELECT, WHERE, LIMIT và các lệnh DDL chuẩn PostgreSQL 18
            </span>
            <button
              onClick={handleRunSql}
              disabled={isExecutingSql}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Thực thi Truy vấn SQL</span>
            </button>
          </div>
        </div>

        {/* Kết quả SQL */}
        {sqlResult && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            {sqlResult.error ? (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                Lỗi cú pháp: {sqlResult.error}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] sticky top-0">
                    <tr>
                      {sqlResult.columns.map((c, i) => (
                        <th key={i} className="p-2.5 border-b border-slate-800 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {sqlResult.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-850">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2.5 whitespace-nowrap">{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Table Browser (Trình duyệt bảng CSDL) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              TRÌNH DUYỆT BẢNG DỮ LIỆU (DATABASE TABLE EXPLORER)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToDemoData}
              className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục Dữ liệu mẫu (Reset Seed)</span>
            </button>
          </div>
        </div>

        {/* Danh sách tab bảng */}
        <div className="flex overflow-x-auto gap-1.5 pb-2">
          {Object.entries(tablesMap).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setActiveTable(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTable === key
                  ? 'bg-brand-600 text-white shadow font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{info.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeTable === key ? 'bg-brand-800 text-white' : 'bg-slate-850 text-slate-400'
              }`}>
                {info.count}
              </span>
            </button>
          ))}
        </div>

        {/* Bảng dữ liệu chi tiết */}
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          {tableRows.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Bảng này hiện chưa có bản ghi nào.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  {Object.keys(tableRows[0] as Record<string, unknown>).slice(0, 8).map((key) => (
                    <th key={key} className="p-3 whitespace-nowrap">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {tableRows.map((row, idx) => {
                  const r = row as Record<string, unknown>;
                  const keys = Object.keys(r).slice(0, 8);
                  return (
                    <tr key={idx} className="hover:bg-slate-850">
                      {keys.map((k) => {
                        const val = r[k];
                        const display = typeof val === 'object' && val !== null ? JSON.stringify(val).slice(0, 30) + '...' : String(val);
                        return (
                          <td key={k} className="p-3 whitespace-nowrap max-w-xs truncate" title={String(val)}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. Connection Configuration Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-slate-400" />
          <span>CẤU HÌNH THÔNG SỐ KẾT NỐI DATABASE ONLINE</span>
        </h3>

        <form noValidate onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <FormErrorSummary errors={settingsErrors} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="adminDashboardUrl" className="text-slate-300 font-semibold block mb-1">
                Link Quản trị Trực tiếp (Admin Dashboard URL) <RequiredMark />:
              </label>
              <input
                id="adminDashboardUrl"
                data-field="adminDashboardUrl"
                type="url"
                value={customDashboardUrl}
                onChange={(e) => { setCustomDashboardUrl(e.target.value); setSettingsErrors(p => ({ ...p, adminDashboardUrl: '' })); }}
                aria-invalid={Boolean(settingsErrors.adminDashboardUrl)}
                className={getFieldErrorClass(Boolean(settingsErrors.adminDashboardUrl), 'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono outline-none')}
              />
              <FieldError message={settingsErrors.adminDashboardUrl} />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Đường dẫn tới Supabase Table Editor hoặc Cloud Postgres Console
              </span>
            </div>

            <div>
              <label htmlFor="supabaseUrl" className="text-slate-300 font-semibold block mb-1">
                Supabase Project Host / REST Endpoint <RequiredMark />:
              </label>
              <input
                id="supabaseUrl"
                data-field="supabaseUrl"
                type="text"
                value={customSupabaseUrl}
                onChange={(e) => { setCustomSupabaseUrl(e.target.value); setSettingsErrors(p => ({ ...p, supabaseUrl: '' })); }}
                aria-invalid={Boolean(settingsErrors.supabaseUrl)}
                className={getFieldErrorClass(Boolean(settingsErrors.supabaseUrl), 'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono outline-none')}
              />
              <FieldError message={settingsErrors.supabaseUrl} />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold"
            >
              Lưu cấu hình Kết nối
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
