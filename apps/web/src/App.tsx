// ==============================================================================
// ECont Main Application Component
// Tuân thủ nghiêm ngặt SRS v1.0, agent.md và plan.md
// ==============================================================================

import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { OffersPage } from './pages/OffersPage';
import { RequestsPage } from './pages/RequestsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { OpsPortalPage } from './pages/OpsPortalPage';
import { FinancePortalPage } from './pages/FinancePortalPage';
import { OnlineDatabasePage } from './pages/OnlineDatabasePage';
import { Box, Shield, Clock3 } from 'lucide-react';

export const MainContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedTxnId, setSelectedTxnId] = useState<string>('TXN-2026-0042');

  return (
    <div className="econt-app min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {currentTab === 'dashboard' && <DashboardPage setCurrentTab={setCurrentTab} />}
        {currentTab === 'assets' && <AssetsPage />}
        {currentTab === 'offers' && <OffersPage />}
        {currentTab === 'requests' && (
          <RequestsPage
            setCurrentTab={setCurrentTab}
            setSelectedTxnId={setSelectedTxnId}
          />
        )}
        {currentTab === 'transactions' && (
          <TransactionsPage
            selectedTxnId={selectedTxnId}
            setSelectedTxnId={setSelectedTxnId}
          />
        )}
        {currentTab === 'ops' && <OpsPortalPage />}
        {currentTab === 'finance' && <FinancePortalPage />}
        {currentTab === 'database' && <OnlineDatabasePage />}
      </main>

      {/* Professional Logistics Platform Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-xs text-slate-500">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </span>
            <span>
              <span className="font-bold text-slate-800">ECONT LOGISTICS</span>
              <span className="hidden sm:inline"> — Kết nối và tái sử dụng container rỗng</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tiêu chuẩn SRS v1.0 & ISO 6346</span>
            </span>
            <span className="hidden sm:block w-px h-3 bg-slate-200"></span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5 text-brand-600" />
              Asia/Ho_Chi_Minh (UTC+7)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <MainContent />
      </DatabaseProvider>
    </AuthProvider>
  );
}
