// ============================================================================
// ECont Chat Page - Trao đổi đối tác và Giám sát Điều phối (Version 2.0)
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  User,
  Building,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDatabase } from "../context/DatabaseContext";
import { formatDateTime, formatRelativeTime } from "../lib/utils";

interface ChatPageProps {
  selectedThreadId?: string | null;
  setSelectedThreadId?: (id: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  selectedThreadId: propSelectedThreadId,
  setSelectedThreadId: propSetSelectedThreadId,
}) => {
  const { currentRole, currentCompany } = useAuth();
  const {
    chatThreads,
    chatMessages,
    sendChatMessage,
    markChatThreadRead,
    companies,
    transactions,
    offers,
    requests,
  } = useDatabase();

  // Local state if props not passed
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedThreadId =
    propSelectedThreadId !== undefined ? propSelectedThreadId : localSelectedId;
  const setSelectedThreadId = propSetSelectedThreadId || setLocalSelectedId;

  const [draft, setDraft] = useState("");

  const isOps = currentRole === "OPS";
  const roleLabel = (role: string) => {
    if (role === "ENTERPRISE_A" || role === "A")
      return "Nhà cung cấp Container";
    if (role === "ENTERPRISE_B" || role === "B") return "Cần vỏ Container";
    if (role === "OPS") return "Ops";
    return role;
  };

  // Mỗi đối tác chỉ thấy thread của mình; Ops thấy toàn bộ thread.
  const visibleThreads = useMemo(() => {
    return chatThreads
      .filter(
        (thread) =>
          isOps ||
          thread.companyAId === currentCompany.id ||
          thread.companyBId === currentCompany.id,
      )
      .map((thread) => {
        const transaction = thread.transactionId
          ? transactions.find((item) => item.id === thread.transactionId)
          : undefined;
        const offer = thread.offerId
          ? offers.find((item) => item.id === thread.offerId)
          : undefined;
        const request = thread.requestId
          ? requests.find((item) => item.id === thread.requestId)
          : undefined;
        const resolveName = (
          id: string,
          provided?: string,
          relatedName?: string,
        ) =>
          provided?.trim() ||
          relatedName?.trim() ||
          companies.find((company) => company.id === id)?.shortName ||
          id;
        return {
          ...thread,
          companyAName: resolveName(
            thread.companyAId,
            thread.companyAName,
            transaction?.companyAName || offer?.companyName,
          ),
          companyBName: resolveName(
            thread.companyBId,
            thread.companyBName,
            transaction?.companyBName || request?.companyName,
          ),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [
    chatThreads,
    currentCompany.id,
    isOps,
    companies,
    transactions,
    offers,
    requests,
  ]);

  useEffect(() => {
    if (
      visibleThreads.length > 0 &&
      !visibleThreads.some((thread) => thread.id === selectedThreadId)
    ) {
      setSelectedThreadId(visibleThreads[0].id);
    }
  }, [selectedThreadId, setSelectedThreadId, visibleThreads]);

  useEffect(() => {
    if (selectedThreadId) markChatThreadRead(selectedThreadId);
  }, [selectedThreadId, markChatThreadRead]);

  const selectedThread =
    visibleThreads.find((thread) => thread.id === selectedThreadId) || null;
  const selectedMessages = selectedThread
    ? chatMessages
        .filter((message) => message.threadId === selectedThread.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedThread || !draft.trim()) return;
    const result = sendChatMessage(selectedThread.id, draft.trim());
    if (!result.success) {
      alert(result.message);
      return;
    }
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <span>TRAO ĐỔI & ĐÀM PHÁN GIAO DỊCH</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kênh trao đổi trực tiếp giữa Nhà cung cấp Container và đơn vị Cần vỏ
            Container trước và trong suốt quá trình tái sử dụng vỏ container.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          {isOps ? "Ops giám sát trao đổi" : "Bảo mật giữa các đối tác"}
        </span>
      </div>

      <div className="h-[calc(100vh-12rem)] min-h-[500px] flex border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Sidebar: Threads list */}
        <aside className="w-1/3 min-w-[300px] max-w-[400px] border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Cuộc trao đổi ({visibleThreads.length})
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Theo container hoặc giao dịch
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {visibleThreads.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 leading-relaxed text-center">
                Chưa có cuộc trao đổi nào. Cuộc trò chuyện sẽ tự động tạo khi
                giữ chỗ hoặc bắt đầu thương lượng.
              </div>
            ) : (
              visibleThreads.map((thread) => {
                const isA = thread.companyAId === currentCompany.id;
                const partnerLabel = isA
                  ? "Cần vỏ Container"
                  : "Nhà cung cấp Container";
                const lastMessage = chatMessages
                  .filter((message) => message.threadId === thread.id)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                const isSelected = thread.id === selectedThreadId;

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-l-blue-600"
                        : "hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {thread.containerNumber || thread.contextLabel}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {lastMessage
                          ? formatRelativeTime(lastMessage.createdAt)
                          : ""}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1 truncate">
                      {isOps
                        ? `${thread.companyAName} · ${thread.companyBName}`
                        : "Nhà cung cấp Container · Cần vỏ Container"}
                    </div>
                    {!isOps && (
                      <div className="text-[11px] text-blue-700 mt-0.5 truncate">
                        Đối tác: {partnerLabel}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {lastMessage ? lastMessage.body : "Chưa có tin nhắn..."}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Main chat window */}
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="border-b border-slate-200 p-4 shrink-0 bg-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {selectedThread.containerNumber ||
                        selectedThread.contextLabel}
                    </span>
                    {selectedThread.carrierCode && (
                      <span className="text-xs text-slate-600 font-medium">
                        · Hãng {selectedThread.carrierCode} (
                        {selectedThread.containerType || ""})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-700 mt-1">
                    {isOps ? (
                      <>
                        <span className="font-semibold">
                          {selectedThread.companyAName}
                        </span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span className="font-semibold">
                          {selectedThread.companyBName}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">
                          Nhà cung cấp Container
                        </span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span className="font-semibold">Cần vỏ Container</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-blue-700 mt-0.5">
                    {isOps
                      ? "Ops đang giám sát cuộc trao đổi"
                      : `Bạn đang chat với ${selectedThread.companyAId === currentCompany.id ? "Cần vỏ Container" : "Nhà cung cấp Container"}`}
                    {selectedThread.pickupLocationName
                      ? ` · Điểm lấy: ${selectedThread.pickupLocationName}`
                      : ""}
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {selectedMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Hãy gửi tin nhắn đầu tiên để bắt đầu trao đổi.
                  </div>
                ) : (
                  selectedMessages.map((msg) => {
                    const isMine = msg.senderCompanyId === currentCompany.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div className="text-xs text-slate-500 mb-1 px-1 font-medium">
                          {isOps
                            ? `${msg.senderCompanyName} · ${roleLabel(msg.senderRole)}`
                            : roleLabel(msg.senderRole)}{" "}
                          · {formatDateTime(msg.createdAt)}
                        </div>
                        <div
                          className={`max-w-[80%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                            isMine
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message input */}
              <form
                onSubmit={handleSubmit}
                className="p-4 border-t border-slate-200 shrink-0 bg-white flex items-center gap-3"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Nhập nội dung trao đổi..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
              Chọn một cuộc trao đổi để xem nội dung
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
