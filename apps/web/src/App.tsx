// ==============================================================================
// ECont App.tsx - Version 2.0
// Main routing, layout, and provider setup
// ==============================================================================

import React, { useState, useEffect, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DatabaseProvider } from "./context/DatabaseContext";
import { Sidebar } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";

// Eager imports (always needed)
import { DashboardPage } from "./pages/DashboardPage";
import { AssetsPage } from "./pages/AssetsPage";
import { OffersPage } from "./pages/OffersPage";
import { RequestsPage } from "./pages/RequestsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ChatPage } from "./pages/ChatPage";
import { OpsPortalPage } from "./pages/OpsPortalPage";
import { CasesPage } from "./pages/CasesPage";
import { OnlineDatabasePage } from "./pages/OnlineDatabasePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";

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
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [selectedTxnId, setSelectedTxnId] = useState<string | undefined>(
    undefined,
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { currentRole, isAuthenticated } = useAuth();

  // Strict role-based navigation guard
  useEffect(() => {
    if (currentRole === "ENTERPRISE_A") {
      if (["assets", "ops", "database"].includes(currentTab)) {
        setCurrentTab("dashboard");
      }
    } else if (currentRole === "ENTERPRISE_B") {
      if (["assets", "offers", "ops", "database"].includes(currentTab)) {
        setCurrentTab("dashboard");
      }
    } else if (currentRole === "ENTERPRISE_BOTH") {
      if (["assets", "ops", "database"].includes(currentTab)) {
        setCurrentTab("dashboard");
      }
    }
  }, [currentRole, currentTab]);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setCurrentTab("dashboard")} />;
  }

  const renderPage = () => {
    switch (currentTab) {
      case "dashboard":
        return <DashboardPage setCurrentTab={setCurrentTab} />;
      case "assets":
        return <AssetsPage />;
      case "offers":
        return (
          <OffersPage
            setCurrentTab={setCurrentTab}
            setSelectedTxnId={setSelectedTxnId}
          />
        );
      case "requests":
        return (
          <RequestsPage
            setCurrentTab={setCurrentTab}
            setSelectedTxnId={setSelectedTxnId}
          />
        );
      case "transactions":
        return (
          <TransactionsPage
            selectedTxnId={selectedTxnId}
            setSelectedTxnId={setSelectedTxnId}
            setCurrentTab={setCurrentTab}
          />
        );
      case "chat":
        return <ChatPage />;
      case "ops":
        return (
          <OpsPortalPage
            setCurrentTab={setCurrentTab}
            setSelectedTxnId={setSelectedTxnId}
          />
        );
      case "cases":
        return (
          <CasesPage
            setCurrentTab={setCurrentTab}
            setSelectedTxnId={setSelectedTxnId}
          />
        );
      case "database":
        return <OnlineDatabasePage />;
      case "profile":
        return <ProfilePage setCurrentTab={setCurrentTab} />;
      case "change-password":
        return <ChangePasswordPage setCurrentTab={setCurrentTab} />;
      default:
        return <DashboardPage setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Vertical Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 min-h-screen">
        <TopHeader
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          setSelectedTxnId={setSelectedTxnId}
          setIsMobileOpen={setIsMobileOpen}
        />
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Suspense fallback={<LoadingSpinner />}>{renderPage()}</Suspense>
        </main>
      </div>
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
