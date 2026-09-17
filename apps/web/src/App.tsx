// ==============================================================================
// ECont App.tsx - Version 2.0
// Main routing, layout, and provider setup
// ==============================================================================

import React, { useState, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { Navbar } from './components/Navbar';

// Eager imports (always needed)
import { DashboardPage } from './pages/DashboardPage';
import { AssetsPage } from './pages/AssetsPage';
import { OffersPage } from './pages/OffersPage';
import { RequestsPage } from './pages/RequestsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ChatPage } from './pages/ChatPage';
import { OpsPortalPage } from './pages/OpsPortalPage';
import { FinancePortalPage } from './pages/FinancePortalPage';
import { CasesPage } from './pages/CasesPage';
import { OnlineDatabasePage } from './pages/OnlineDatabasePage';

function LoadingSpinner() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Đang tải...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTxnId, setSelectedTxnId] = useState<string | undefined>(undefined);

  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage setCurrentTab={setCurrentTab} />;
      case 'assets':
        return <AssetsPage />;
      case 'offers':
        return <OffersPage setCurrentTab={setCurrentTab} setSelectedTxnId={setSelectedTxnId} />;
      case 'requests':
        return <RequestsPage setCurrentTab={setCurrentTab} setSelectedTxnId={setSelectedTxnId} />;
      case 'transactions':
        return <TransactionsPage selectedTxnId={selectedTxnId} setSelectedTxnId={setSelectedTxnId} setCurrentTab={setCurrentTab} />;
      case 'chat':
        return <ChatPage />;
      case 'ops':
        return <OpsPortalPage setCurrentTab={setCurrentTab} setSelectedTxnId={setSelectedTxnId} />;
      case 'finance':
        return <FinancePortalPage setCurrentTab={setCurrentTab} setSelectedTxnId={setSelectedTxnId} />;
      case 'cases':
        return <CasesPage setCurrentTab={setCurrentTab} setSelectedTxnId={setSelectedTxnId} />;
      case 'database':
        return <OnlineDatabasePage />;
      default:
        return <DashboardPage setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<LoadingSpinner />}>
          {renderPage()}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <AppContent />
      </DatabaseProvider>
    </AuthProvider>
  );
}
