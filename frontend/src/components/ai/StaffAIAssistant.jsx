import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  Clock,
  CookingPot,
  ExternalLink,
  Flame,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { askStaffAssistant } from "../../services/aiService";
import { getCanteens } from "../../services/canteenService";

const QUICK_PROMPTS = [
  {
    label: "Summarize Queue",
    query: "Current queue load aur summary batao",
  },
  {
    label: "Most Urgent Order",
    query: "Kaunsa order pehle prepare karna chahiye aur sabse zyada wait kar raha hai?",
  },
  {
    label: "Kitchen Bottleneck",
    query: "Kitchen workload mein bottleneck kya hai aur kaunsa dish pending hai?",
  },
  {
    label: "Delayed Orders",
    query: "Kaunse orders delayed hain aur estimated wait time kya hai?",
  },
  {
    label: "Current Load",
    query: "Current queue load aur kitchen stations ka status kya hai?",
  },
];

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    text: "Kitchen Assistant online. I can analyze queue congestion, detect bottleneck dishes, flag delayed tickets, and recommend FIFO prep priorities. How can I assist this shift?",
    highlights: [],
    trustedContextSummary: null,
    timestamp: new Date().toISOString(),
  },
];

export default function StaffAIAssistant({ isOpen, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [canteens, setCanteens] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const inFlightRef = useRef(false);

  // 1. Role isolation: Strictly for STAFF and ADMIN only
  const isAuthorized = user && (user.role === "STAFF" || user.role === "ADMIN");

  // Fetch canteen list to resolve assigned canteen name
  useEffect(() => {
    let isMounted = true;
    if (isAuthorized) {
      getCanteens()
        .then((res) => {
          if (!isMounted) return;
          setCanteens(res.data?.data?.canteens || []);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthorized]);

  const assignedCanteenId = useMemo(() => {
    return user?.canteen?._id || user?.canteen || "";
  }, [user]);

  const canteenName = useMemo(() => {
    if (!assignedCanteenId && canteens.length > 0) {
      return canteens[0].name;
    }
    const found = canteens.find(
      (c) => (c._id || c.id) === String(assignedCanteenId)
    );
    return found ? found.name : "Assigned Canteen";
  }, [assignedCanteenId, canteens]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isLoading, scrollToBottom]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear chat
  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  // Send message
  const handleSend = async (queryText = null) => {
    const textToSend = (typeof queryText === "string" ? queryText : input).trim();
    if (!textToSend || isLoading || inFlightRef.current) return;
    inFlightRef.current = true;

    const userMsgId = `staff-user-${Date.now()}`;
    const newMessages = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        text: textToSend,
        timestamp: new Date().toISOString(),
      },
    ];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await askStaffAssistant(
        textToSend,
        assignedCanteenId || undefined
      );
      const aiData = response.data?.data;

      if (aiData?.intent === "FALLBACK" || aiData?.fallback) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text:
              aiData.reply ||
              "Kitchen Assistant is temporarily unavailable. You can still manage orders normally.",
            highlights: [],
            trustedContextSummary: aiData?.trustedContextSummary || null,
            isFallback: true,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: aiData?.reply || "Kitchen operations insight generated.",
            highlights: Array.isArray(aiData?.highlights)
              ? aiData.highlights
              : [],
            trustedContextSummary: aiData?.trustedContextSummary || null,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error("Staff AI error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: "Kitchen Assistant is temporarily unavailable. You can still manage orders normally.",
          highlights: [],
          isError: true,
          canRetry: true,
          failedQuery: textToSend,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleNavigateToQueue = () => {
    onClose?.();
    navigate("/admin/queue");
  };

  // Role isolation check before rendering
  if (!isAuthorized || !isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="kitchen-ai-title"
        className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl transition-all md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[440px] md:border-l md:border-slate-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 ring-1 ring-teal-400/30">
              <CookingPot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="kitchen-ai-title"
                  className="text-base font-black tracking-tight text-white"
                >
                  Kitchen Assistant
                </h2>
                <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-300 ring-1 ring-teal-400/30">
                  Advisory
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live queue intelligence • {canteenName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear chat"
              aria-label="Clear chat history"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close kitchen assistant"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Advisory Mode Notice */}
        <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-xs font-semibold text-amber-900">
          <ShieldAlert size={15} className="shrink-0 text-amber-700" />
          <span>
            Read-only advisory mode. Ticket state transitions must be performed on the KDS board.
          </span>
        </div>

        {/* Messages Container */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
          tabIndex={0}
          aria-label="Kitchen Assistant conversation"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "rounded-tr-xs bg-slate-800 font-medium text-white"
                    : msg.isError || msg.isFallback
                      ? "rounded-tl-xs border border-red-200 bg-red-50/90 text-red-900"
                      : "rounded-tl-xs border border-slate-200/80 bg-white text-slate-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Highlights List */}
                {msg.highlights && msg.highlights.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Operational Highlights
                    </p>
                    <div className="space-y-1.5">
                      {msg.highlights.map((hl, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-800 border border-slate-100"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                          <span>{hl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trusted Live Workload Context */}
                {msg.trustedContextSummary && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                        <BarChart2 size={13} className="text-teal-700" />
                        Live Kitchen Load
                      </span>
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">
                        {msg.trustedContextSummary.activeQueueCount} in queue
                      </span>
                    </div>

                    {/* Status Breakdown Pills */}
                    {msg.trustedContextSummary.statusCounts && (
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                        <div className="rounded-lg bg-white p-1.5 border border-slate-200/60 flex justify-between">
                          <span className="text-slate-500">Confirmed:</span>
                          <span className="text-slate-900">
                            {msg.trustedContextSummary.statusCounts.CONFIRMED || 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 border border-slate-200/60 flex justify-between">
                          <span className="text-slate-500">Accepted:</span>
                          <span className="text-cyan-700">
                            {msg.trustedContextSummary.statusCounts.ACCEPTED || 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 border border-slate-200/60 flex justify-between">
                          <span className="text-slate-500">Preparing:</span>
                          <span className="text-amber-700">
                            {msg.trustedContextSummary.statusCounts.PREPARING || 0}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 border border-slate-200/60 flex justify-between">
                          <span className="text-slate-500">Ready:</span>
                          <span className="text-emerald-700">
                            {msg.trustedContextSummary.statusCounts.READY || 0}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bottleneck Items */}
                    {msg.trustedContextSummary.topItemsInKitchen?.length > 0 && (
                      <div className="mt-2 border-t border-slate-200/50 pt-2">
                        <span className="flex items-center gap-1 text-[11px] font-black text-slate-600">
                          <Flame size={12} className="text-amber-600" />
                          Top Dish Demand in Pipeline:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {msg.trustedContextSummary.topItemsInKitchen.map(
                            (it, idx) => (
                              <span
                                key={idx}
                                className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200"
                              >
                                {it.count}x {it.name}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Oldest Waiting Order */}
                    {msg.trustedContextSummary.oldestPendingOrderId && (
                      <div className="mt-2 flex items-center justify-between border-t border-slate-200/50 pt-2 text-xs">
                        <span className="text-slate-500 font-medium">
                          Oldest waiting ticket:
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          #{msg.trustedContextSummary.oldestPendingOrderId}
                        </span>
                      </div>
                    )}

                    {/* View in Queue link (Advisory navigation only, no mutations) */}
                    <div className="mt-2 pt-1">
                      <button
                        type="button"
                        onClick={handleNavigateToQueue}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white transition hover:bg-slate-800"
                      >
                        <ExternalLink size={13} /> View Live Queue Board
                      </button>
                    </div>
                  </div>
                )}

                {/* Retry action if errored */}
                {msg.canRetry && msg.failedQuery && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => handleSend(msg.failedQuery)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-800 shadow-xs hover:bg-red-50"
                    >
                      <RotateCcw size={13} /> Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white p-3.5 shadow-xs w-28">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600 [animation-delay:0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600 [animation-delay:0.4s]" />
              </div>
              <span className="sr-only">Kitchen Assistant is analyzing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Strip */}
        <div className="border-t border-slate-100 bg-white px-4 pt-2.5 pb-1">
          <div
            className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar"
            aria-label="Quick kitchen prompts"
          >
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(prompt.query)}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Footer */}
        <footer className="border-t border-slate-100 bg-white p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <label htmlFor="staff-ai-input" className="sr-only">
                Ask Kitchen Assistant
              </label>
              <textarea
                id="staff-ai-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
                rows={1}
                maxLength={500}
                placeholder="Ask about queue load, bottleneck, or prep order..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send query"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      </aside>
    </>
  );
}
