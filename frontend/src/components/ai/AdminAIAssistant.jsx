import {
  AlertCircle,
  BarChart3,
  Calendar,
  Clock3,
  LineChart,
  MapPin,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { askAdminAssistant } from "../../services/aiService";
import { getCanteens } from "../../services/canteenService";

const iso = (date) => date.toISOString().slice(0, 10);
const ranges = { today: 0, "7d": 6, "30d": 29 };

const QUICK_PROMPTS = [
  {
    label: "Today's Summary",
    query: "Aaj ka overall sales and demand summary batao",
  },
  {
    label: "Revenue",
    query: "Aaj aur last 7 days ka revenue kaisa raha?",
  },
  {
    label: "Peak Hour",
    query: "Peak hour kab hai aur orders kab peak par hote hain?",
  },
  {
    label: "Top Items",
    query: "Top selling items aur customer favourites kaunsi hain?",
  },
  {
    label: "Busy Canteen",
    query: "Kaunsi canteen sabse busy hai aur performance kaisa hai?",
  },
  {
    label: "Prep Time",
    query: "Average preparation time kya hai aur speed kaisa hai?",
  },
];

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    text: "Analytics Copilot online. I can analyze revenue trajectories, peak traffic windows, popular dishes, and kitchen pacing grounded in verified database metrics. What would you like to investigate?",
    highlights: [],
    verifiedMetrics: null,
    timestamp: new Date().toISOString(),
  },
];

export default function AdminAIAssistant({ isOpen, onClose, initialCanteenId = "", initialRange = "7d" }) {
  const { user } = useAuth();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [canteens, setCanteens] = useState([]);

  // Context filters
  const [selectedCanteenId, setSelectedCanteenId] = useState(initialCanteenId);
  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const inFlightRef = useRef(false);

  // 1. Role isolation: Strictly for ADMIN only
  const isAdmin = user && user.role === "ADMIN";

  // Fetch available canteens for filter
  useEffect(() => {
    let isMounted = true;
    if (isAdmin) {
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
  }, [isAdmin]);

  // Compute active date boundaries
  const dateParams = useMemo(() => {
    if (selectedRange === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (ranges[selectedRange] || 0));
    return { from: iso(from), to: iso(to) };
  }, [selectedRange, customFrom, customTo]);

  const activeCanteenName = useMemo(() => {
    if (!selectedCanteenId) return "All Canteens (Aggregated)";
    const found = canteens.find((c) => (c._id || c.id) === selectedCanteenId);
    return found ? found.name : "Selected Canteen";
  }, [selectedCanteenId, canteens]);

  const rangeLabel = useMemo(() => {
    if (selectedRange === "today") return "Today";
    if (selectedRange === "7d") return "Last 7 Days";
    if (selectedRange === "30d") return "Last 30 Days";
    if (selectedRange === "custom") {
      return customFrom && customTo ? `${customFrom} to ${customTo}` : "Custom Range";
    }
    return "Last 7 Days";
  }, [selectedRange, customFrom, customTo]);

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

  // Clear conversation
  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  // Send message
  const handleSend = async (queryText = null) => {
    const textToSend = (typeof queryText === "string" ? queryText : input).trim();
    if (!textToSend || isLoading || inFlightRef.current) return;
    inFlightRef.current = true;

    const userMsgId = `admin-user-${Date.now()}`;
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
      const response = await askAdminAssistant(
        textToSend,
        selectedCanteenId || undefined,
        dateParams.from,
        dateParams.to
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
              "Analytics Assistant is temporarily unavailable. Your dashboard analytics are still available.",
            highlights: [],
            verifiedMetrics: aiData?.verifiedMetrics || null,
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
            text: aiData?.reply || "Canteen analytics insight generated.",
            highlights: Array.isArray(aiData?.highlights) ? aiData.highlights : [],
            verifiedMetrics: aiData?.verifiedMetrics || null,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error("Admin AI error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: "Analytics Assistant is temporarily unavailable. Your dashboard analytics are still available.",
          highlights: [],
          verifiedMetrics: null,
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

  // Security and role check
  if (!isAdmin || !isOpen) {
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
        aria-labelledby="admin-ai-title"
        className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl transition-all md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[460px] md:border-l md:border-slate-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-400/30">
              <LineChart size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="admin-ai-title"
                  className="text-base font-black tracking-tight text-white"
                >
                  Analytics Assistant
                </h2>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">
                  Admin AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Natural-language business intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear conversation"
              aria-label="Clear chat history"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close analytics assistant"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Active Analytics Context Bar */}
        <div className="border-b border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 font-semibold truncate text-slate-700">
              <MapPin size={13} className="text-cyan-700 shrink-0" />
              <span className="truncate">{activeCanteenName}</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-slate-500">
              <Calendar size={13} className="text-cyan-700 shrink-0" />
              <span>{rangeLabel}</span>
            </div>
          </div>

          {/* Quick Context Switchers */}
          <div className="mt-2 flex flex-wrap gap-2 pt-1 border-t border-slate-200/60">
            <select
              aria-label="Select canteen for AI analytics"
              value={selectedCanteenId}
              onChange={(e) => setSelectedCanteenId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs"
            >
              <option value="">All Canteens (Aggregated)</option>
              {canteens.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Select date range for AI analytics"
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {selectedRange === "custom" && (
              <div className="flex items-center gap-1.5 w-full mt-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium"
                />
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40"
          tabIndex={0}
          aria-label="Analytics conversation"
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
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "rounded-tr-xs bg-slate-900 font-medium text-white"
                    : msg.isError || msg.isFallback
                      ? "rounded-tl-xs border border-red-200 bg-red-50/90 text-red-900"
                      : "rounded-tl-xs border border-slate-200/80 bg-white text-slate-900"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Highlights List */}
                {msg.highlights && msg.highlights.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Key Takeaways
                    </p>
                    <div className="space-y-1">
                      {msg.highlights.map((hl, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-800 border border-slate-100"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
                          <span>{hl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Authoritative Verified Metrics Cards */}
                {msg.verifiedMetrics && (
                  <div className="mt-3.5 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                        <BarChart3 size={13} className="text-cyan-700" />
                        Verified Database Metrics
                      </span>
                      <span className="rounded-md bg-white border border-slate-200/60 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500">
                        MongoDB Ground Truth
                      </span>
                    </div>

                    {/* KPI 4-block grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Revenue */}
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Total Revenue
                        </span>
                        <span className="mt-1 block text-base font-black text-slate-900">
                          ₹{Number(
                            msg.verifiedMetrics.revenue ??
                              msg.verifiedMetrics.totalRevenue ??
                              0
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Orders */}
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Orders
                        </span>
                        <span className="mt-1 block text-base font-black text-slate-900">
                          {msg.verifiedMetrics.totalOrders ?? 0}
                        </span>
                      </div>

                      {/* Average Prep Time */}
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Avg Preparation
                        </span>
                        <span className="mt-1 block text-sm font-black text-slate-900">
                          {msg.verifiedMetrics.averagePreparationTime ?? 0} min
                        </span>
                      </div>

                      {/* Velocity */}
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Avg Orders / Hr
                        </span>
                        <span className="mt-1 block text-sm font-black text-slate-900">
                          {msg.verifiedMetrics.averageOrdersPerHour ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Peak Hour Detail */}
                    {msg.verifiedMetrics.peakHours?.length > 0 && (
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold flex items-center gap-1">
                            <Clock3 size={12} className="text-amber-600" />
                            Busiest Window (Peak Hour):
                          </span>
                          <span className="font-extrabold text-cyan-800">
                            {msg.verifiedMetrics.peakHours[0].hour ||
                              `${msg.verifiedMetrics.peakHours[0].start} - ${msg.verifiedMetrics.peakHours[0].end}`}
                          </span>
                        </div>
                        {msg.verifiedMetrics.peakHours[0].orders !== undefined && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {msg.verifiedMetrics.peakHours[0].orders} orders during this window
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top Items */}
                    {msg.verifiedMetrics.topItems?.length > 0 && (
                      <div className="rounded-xl bg-white p-2.5 border border-slate-200/60 text-xs">
                        <span className="text-slate-500 font-bold flex items-center gap-1">
                          <TrendingUp size={12} className="text-emerald-600" />
                          Top Selling Items:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {msg.verifiedMetrics.topItems.map((item, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                            >
                              {item.name || item._id}: {item.quantitySold ?? item.count ?? 0} sold
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-600" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-600 [animation-delay:0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-600 [animation-delay:0.4s]" />
              </div>
              <span className="sr-only">Analytics Copilot is querying...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Strip */}
        <div className="border-t border-slate-100 bg-white px-4 pt-2.5 pb-1">
          <div
            className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar"
            aria-label="Quick analytics prompts"
          >
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(prompt.query)}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <footer className="border-t border-slate-100 bg-white p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <label htmlFor="admin-ai-input" className="sr-only">
                Ask Analytics Assistant
              </label>
              <textarea
                id="admin-ai-input"
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
                placeholder="Ask about revenue, peak hours, top dishes, or trends..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send query"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      </aside>
    </>
  );
}
