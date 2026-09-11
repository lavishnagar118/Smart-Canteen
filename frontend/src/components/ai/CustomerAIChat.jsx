import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Plus,
  RotateCcw,
  Send,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { askCustomerAssistant } from "../../services/aiService";
import { getCanteens } from "../../services/canteenService";
import { getMenuItem } from "../../services/menuService";

const QUICK_PROMPTS = [
  { label: "Under ₹50", query: "Mere paas ₹50 hain, kya options hain?" },
  {
    label: "Under ₹100",
    query: "Mere paas ₹100 hain aur vegetarian food chahiye",
  },
  {
    label: "Filling food",
    query: "Sabse filling aur pet bharne wala option kaunsa hai?",
  },
  { label: "Quick meals", query: "Jaldi ready hone wala food batao" },
  { label: "Vegetarian", query: "Vegetarian food options dikhao" },
  { label: "Spicy food", query: "Spicy food options kya hain?" },
];

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hi! I'm your Smart Canteen Assistant. Looking for something within a budget, a quick bite, or vegetarian meals? Ask me anything below!",
    recommendations: [],
    timestamp: new Date().toISOString(),
  },
];

export default function CustomerAIChat() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { addItem, items } = useCart();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [canteens, setCanteens] = useState([]);
  const [selectedCanteenId, setSelectedCanteenId] = useState(() => {
    return localStorage.getItem("smart_canteen_active_canteen_id") || "";
  });

  const [addingItemId, setAddingItemId] = useState(null);
  const [itemStatuses, setItemStatuses] = useState({}); // { [id]: 'added' | 'error' }
  const [itemErrorMsgs, setItemErrorMsgs] = useState({}); // { [id]: string }

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const inFlightRef = useRef(false);

  const pathname = location.pathname;
  const isAllowedPath =
    pathname === "/" ||
    pathname.startsWith("/canteen/") ||
    pathname === "/menu" ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname === "/profile";

  // 3. Detect canteen from URL, cart, or route
  useEffect(() => {
    let detectedId = "";

    if (pathname.startsWith("/canteen/")) {
      const parts = pathname.split("/canteen/")[1]?.split("/");
      if (parts && parts[0]) detectedId = parts[0];
    } else if (pathname === "/menu") {
      const searchParams = new URLSearchParams(location.search);
      const paramId = searchParams.get("canteenId");
      if (paramId) detectedId = paramId;
    }

    if (!detectedId && items.length > 0) {
      const cartCanteen = items[0]?.canteen?._id || items[0]?.canteen;
      if (cartCanteen) detectedId = String(cartCanteen);
    }

    if (detectedId) {
      setSelectedCanteenId(detectedId);
      localStorage.setItem("smart_canteen_active_canteen_id", detectedId);
    }
  }, [pathname, location.search, items]);

  // Load available canteens
  useEffect(() => {
    let isMounted = true;
    getCanteens()
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data?.canteens || [];
        setCanteens(list);

        // If no canteen was detected yet, but only one active canteen exists, auto-select it
        if (!selectedCanteenId && list.length === 1) {
          const onlyId = list[0]._id || list[0].id;
          setSelectedCanteenId(onlyId);
          localStorage.setItem("smart_canteen_active_canteen_id", onlyId);
        }
      })
      .catch(() => {
        // Soft fail
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCanteenId]);

  const activeCanteen = useMemo(() => {
    return (
      canteens.find(
        (c) => (c._id || c.id) === selectedCanteenId
      ) || null
    );
  }, [canteens, selectedCanteenId]);

  // Auto-scroll to newest message
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
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Select canteen handler
  const handleSelectCanteen = (canteen) => {
    const id = canteen._id || canteen.id;
    setSelectedCanteenId(id);
    localStorage.setItem("smart_canteen_active_canteen_id", id);
    setMessages((prev) => [
      ...prev,
      {
        id: `canteen-select-${Date.now()}`,
        role: "assistant",
        text: `Connected to **${canteen.name}**. I can now recommend dishes directly from their live menu! What are you craving?`,
        recommendations: [],
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Clear chat history
  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setItemStatuses({});
    setItemErrorMsgs({});
  };

  // Send message
  const handleSend = async (queryText = null) => {
    const textToSend = (typeof queryText === "string" ? queryText : input).trim();
    if (!textToSend || isLoading || inFlightRef.current) return;
    inFlightRef.current = true;

    if (!isAuthenticated) {
      inFlightRef.current = false;
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: textToSend,
          timestamp: new Date().toISOString(),
        },
        {
          id: `auth-error-${Date.now()}`,
          role: "assistant",
          text: "Please sign in to your Smart Canteen account to use the AI Assistant and get personalized recommendations.",
          isAuthPrompt: true,
          recommendations: [],
          timestamp: new Date().toISOString(),
        },
      ]);
      setInput("");
      return;
    }

    if (!selectedCanteenId) {
      inFlightRef.current = false;
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          text: textToSend,
          timestamp: new Date().toISOString(),
        },
        {
          id: `no-canteen-${Date.now()}`,
          role: "assistant",
          text: "Please choose a canteen first so I can find available food from its kitchen.",
          needsCanteen: true,
          recommendations: [],
          timestamp: new Date().toISOString(),
        },
      ]);
      setInput("");
      return;
    }

    const userMsgId = `user-${Date.now()}`;
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
      const response = await askCustomerAssistant(textToSend, selectedCanteenId);
      const aiData = response.data?.data;

      if (aiData?.intent === "FALLBACK") {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text:
              aiData.reply ||
              "Smart Assistant is temporarily unavailable. You can still browse the menu normally.",
            isFallback: true,
            recommendations: [],
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: aiData?.reply || "Here are some recommendations from today's menu:",
            recommendations: Array.isArray(aiData?.recommendations)
              ? aiData.recommendations
              : [],
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error("Customer AI error:", err);
      const status = err.status || err.response?.status;
      let errorReply =
        "Smart Assistant is temporarily unavailable. You can still browse the menu normally.";
      let isAuthPrompt = false;

      if (status === 401) {
        errorReply =
          "Your session has expired. Please sign in again to use the AI Assistant.";
        isAuthPrompt = true;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: errorReply,
          isError: true,
          isAuthPrompt,
          canRetry: !isAuthPrompt,
          failedQuery: textToSend,
          recommendations: [],
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  // Add recommendation to Cart
  const handleAddToCart = async (rec) => {
    const itemId = rec.menuItemId;
    setAddingItemId(itemId);
    setItemErrorMsgs((prev) => ({ ...prev, [itemId]: null }));

    try {
      // Re-verify against authoritative MongoDB database
      const response = await getMenuItem(itemId);
      const verifiedItem = response?.data?.data;

      if (!verifiedItem || verifiedItem.isAvailable === false) {
        setItemStatuses((prev) => ({ ...prev, [itemId]: "error" }));
        setItemErrorMsgs((prev) => ({
          ...prev,
          [itemId]: "That item is no longer available.",
        }));
        return;
      }

      // Add verified item to CartContext
      const qty = rec.quantity && rec.quantity > 0 ? rec.quantity : 1;
      for (let i = 0; i < qty; i++) {
        addItem(verifiedItem);
      }

      setItemStatuses((prev) => ({ ...prev, [itemId]: "added" }));
      setTimeout(() => {
        setItemStatuses((prev) => ({ ...prev, [itemId]: null }));
      }, 2500);
    } catch (err) {
      console.error("Failed to add AI item to cart:", err);
      setItemStatuses((prev) => ({ ...prev, [itemId]: "error" }));
      setItemErrorMsgs((prev) => ({
        ...prev,
        [itemId]: "That item is no longer available.",
      }));
    } finally {
      setAddingItemId(null);
    }
  };

  // 1. Role isolation: Never render for Staff or Admin accounts
  if (user && (user.role === "STAFF" || user.role === "ADMIN")) {
    return null;
  }

  // 2. Route placement: Only show on customer surfaces
  if (!isAllowedPath) {
    return null;
  }

  return (
    <>
      {/* 1. Floating Assistant Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Ask Smart Canteen Assistant"
          className={`fixed z-30 flex items-center gap-2.5 rounded-full bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-xl ring-1 ring-white/10 transition-all duration-200 hover:scale-102 hover:bg-slate-800 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-98 ${
            items.length > 0
              ? "bottom-36 right-4 md:bottom-8 md:right-8"
              : "bottom-20 right-4 md:bottom-8 md:right-8"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles size={18} className="text-teal-400" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
            </span>
          </div>
          <span className="tracking-tight">Ask Smart Canteen</span>
        </button>
      )}

      {/* 2. Chat Drawer / Conversational Panel */}
      {isOpen && (
        <>
          {/* Subtle Desktop & Mobile Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-drawer-title"
            className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl transition-all md:inset-auto md:top-0 md:right-0 md:bottom-0 md:w-[420px] md:border-l md:border-slate-200"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 ring-1 ring-teal-400/30">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2
                    id="ai-drawer-title"
                    className="text-base font-black tracking-tight text-white"
                  >
                    Smart Canteen Assistant
                  </h2>
                  <p className="text-xs text-slate-300">Ask me what to eat.</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Clear chat"
                  aria-label="Clear chat conversation"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close assistant"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {/* Canteen Context Bar */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={14} className="shrink-0 text-teal-700" />
                <span className="truncate">
                  {activeCanteen
                    ? activeCanteen.name
                    : "No canteen selected"}
                </span>
              </div>
              {canteens.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedCanteenId("")}
                  className="shrink-0 text-xs font-bold text-teal-700 hover:underline"
                >
                  Change
                </button>
              )}
            </div>

            {/* Messages Area */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40"
              tabIndex={0}
              aria-label="Chat messages"
            >
              {/* Unselected Canteen Banner */}
              {!selectedCanteenId && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 shadow-xs">
                  <p className="font-bold">Choose a canteen to get started:</p>
                  <p className="mt-1 text-amber-800/80">
                    Recommendations are generated from the live kitchen menu of your selected canteen.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canteens.map((c) => (
                      <button
                        key={c._id || c.id}
                        type="button"
                        onClick={() => handleSelectCanteen(c)}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs ring-1 ring-amber-300 transition hover:bg-amber-100"
                      >
                        {c.name}
                      </button>
                    ))}
                    {canteens.length === 0 && (
                      <span className="text-slate-500 italic">
                        Loading available canteens...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                      msg.role === "user"
                        ? "rounded-tr-xs bg-teal-700 font-medium text-white"
                        : msg.isError || msg.isFallback
                          ? "rounded-tl-xs border border-red-200 bg-red-50/90 text-red-900"
                          : "rounded-tl-xs border border-slate-200/70 bg-white text-slate-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Auth prompt action */}
                    {msg.isAuthPrompt && (
                      <div className="mt-3">
                        <Link
                          to="/login"
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-800"
                        >
                          Sign In <ArrowRight size={14} />
                        </Link>
                      </div>
                    )}

                    {/* Retry button */}
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

                    {/* Canteen prompt picker */}
                    {msg.needsCanteen && !selectedCanteenId && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canteens.map((c) => (
                          <button
                            key={c._id || c.id}
                            type="button"
                            onClick={() => handleSelectCanteen(c)}
                            className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommendation Cards */}
                  {msg.recommendations && msg.recommendations.length > 0 && (
                    <div className="mt-3 w-full space-y-2.5">
                      {msg.recommendations.map((rec) => {
                        const itemId = rec.menuItemId;
                        const isAdding = addingItemId === itemId;
                        const isAdded = itemStatuses[itemId] === "added";
                        const hasError = itemStatuses[itemId] === "error";
                        const errorMessage = itemErrorMsgs[itemId];

                        return (
                          <article
                            key={itemId}
                            className="overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs transition hover:border-teal-300 hover:shadow-md"
                          >
                            <div className="flex gap-3">
                              {/* Food Image / Placeholder */}
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                {rec.imageUrl ? (
                                  <img
                                    src={rec.imageUrl}
                                    alt={rec.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center font-black text-teal-700/40 text-lg">
                                    {rec.name?.charAt(0) || "F"}
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="truncate text-sm font-black text-slate-900">
                                    {rec.name}
                                  </h3>
                                  <span className="shrink-0 text-sm font-extrabold text-teal-700">
                                    ₹{rec.price}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  {rec.category && (
                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                                      {rec.category}
                                    </span>
                                  )}
                                  {rec.preparationTime && (
                                    <span className="flex items-center gap-1 font-medium">
                                      <Clock3 size={11} className="text-slate-400" />
                                      ~{rec.preparationTime} min
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Why / Reason */}
                            {rec.reason && (
                              <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
                                <span className="font-bold text-slate-700">Why: </span>
                                {rec.reason}
                              </div>
                            )}

                            {/* Error notification */}
                            {hasError && errorMessage && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                                <AlertCircle size={14} />
                                {errorMessage}
                              </div>
                            )}

                            {/* Add to Cart Button */}
                            <div className="mt-2.5 flex items-center justify-between gap-3">
                              {rec.quantity && rec.quantity > 1 ? (
                                <span className="text-xs text-slate-500 font-medium">
                                  Suggested qty: {rec.quantity}
                                </span>
                              ) : (
                                <span />
                              )}

                              <button
                                type="button"
                                onClick={() => handleAddToCart(rec)}
                                disabled={isAdding}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                                  isAdded
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
                                }`}
                              >
                                {isAdding ? (
                                  <>
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Adding...
                                  </>
                                ) : isAdded ? (
                                  <>
                                    <Check size={14} /> Added to Cart
                                  </>
                                ) : (
                                  <>
                                    <Plus size={14} /> Add to Cart
                                  </>
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing / Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white p-3.5 shadow-xs w-28">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-teal-600 [animation-delay:0.4s]" />
                  </div>
                  <span className="sr-only">Smart Assistant is thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Strip */}
            <div className="border-t border-slate-100 bg-white px-4 pt-2.5 pb-1">
              <div
                className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar"
                aria-label="Quick suggestion prompts"
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

            {/* Input Box Area */}
            <footer className="border-t border-slate-100 bg-white p-3 sm:p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2"
              >
                <div className="relative flex-1">
                  <label htmlFor="ai-chat-input" className="sr-only">
                    What are you looking for?
                  </label>
                  <textarea
                    id="ai-chat-input"
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
                    placeholder="What are you looking for?"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send size={16} />
                </button>
              </form>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}
