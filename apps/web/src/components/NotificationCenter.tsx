// ==============================================================================
// ECont NotificationCenter - Trung tâm Thông báo Hoạt động Thời gian thực
// ==============================================================================

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle,
  Package,
  Search,
  X,
} from "lucide-react";
import { useDatabase } from "../context/DatabaseContext";
import { useAuth } from "../context/AuthContext";
import { Notification } from "../types";
import { formatRelativeTime } from "../lib/utils";
import {
  getNotificationTab,
  resolveNotificationEntityType,
} from "../services/notificationRouting";

interface NotificationCenterProps {
  setCurrentTab: (tab: string) => void;
  setSelectedTxnId?: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  setCurrentTab,
  setSelectedTxnId,
}) => {
  const {
    myNotifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useDatabase();
  const { currentRole } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD">("ALL");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayedNotifications = myNotifications.filter((n) => {
    if (filterTab === "UNREAD") return !n.isRead;
    return true;
  });

  const handleNotificationClick = (n: Notification) => {
    markNotificationRead(n.id);

    const entityType = resolveNotificationEntityType(n);
    const targetTab = getNotificationTab(n, currentRole);
    if (entityType === "Transaction" && n.relatedEntityId) {
      setSelectedTxnId?.(n.relatedEntityId);
    }
    if (targetTab) {
      setCurrentTab(targetTab);
    }

    setIsOpen(false);
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "DEADLINE_ALERT":
        return (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        );
      case "PAYMENT_REQUIRED":
        return <Clock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case "OPS_ALERT":
        return (
          <ShieldAlert className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
        );
      case "TRANSACTION_UPDATE":
      default:
        return (
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative h-10 w-10 flex items-center justify-center rounded-xl transition-colors ${
          isOpen
            ? "bg-slate-200 text-slate-900"
            : "hover:bg-slate-100 text-slate-600"
        }`}
        title="Trung tâm thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center px-1 shadow-xs border-2 border-white leading-none">
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Thông Báo
              </h4>
              {unreadNotificationCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                  {unreadNotificationCount} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 px-1 py-0.5"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Đã đọc tất cả
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-slate-100 px-3 bg-white text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={`py-2 px-3 font-semibold border-b-2 transition-colors ${
                filterTab === "ALL"
                  ? "border-blue-600 text-blue-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Tất cả ({myNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("UNREAD")}
              className={`py-2 px-3 font-semibold border-b-2 transition-colors ${
                filterTab === "UNREAD"
                  ? "border-blue-600 text-blue-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Chưa đọc ({unreadNotificationCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs sm:text-sm">
                  {filterTab === "UNREAD"
                    ? "Bạn không có thông báo chưa đọc nào"
                    : "Chưa có thông báo nào"}
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex items-start gap-3 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                    !n.isRead ? "bg-blue-50/30" : "bg-white"
                  }`}
                >
                  {getNotificationIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs sm:text-sm leading-snug truncate ${
                          !n.isRead
                            ? "font-bold text-slate-900"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                      <span>{formatRelativeTime(n.createdAt)}</span>
                      {n.relatedEntityId && (
                        <span className="font-mono text-blue-600 font-medium flex items-center gap-0.5">
                          {n.relatedEntityId}
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded"
                    title="Xóa thông báo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
