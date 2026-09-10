import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  RefreshCw,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../context/AuthContext";
import { getOrder } from "../services/orderService";
import {
  createPaymentOrder,
  getPaymentStatus,
  verifyPayment,
} from "../services/paymentService";
import { loadRazorpayCheckout, openRazorpayCheckout } from "../utils/razorpay";

const PAYMENT_MESSAGES = {
  idle: "Your order is saved and waiting for payment confirmation.",
  creating: "Preparing your secure payment...",
  opening: "Opening Razorpay Checkout...",
  verifying: "Confirming your payment...",
  failed: "Payment was not completed. Your order is still safe. Try again.",
  cancelled: "Payment was cancelled. Your order is still safe. You can try again.",
  unknown: "We're checking your payment status...",
};

const methodCards = [
  { label: "UPI", detail: "Open Razorpay Checkout for UPI", icon: Smartphone },
  { label: "Cards", detail: "Debit and credit cards", icon: CreditCard },
  { label: "Netbanking", detail: "Participating banks", icon: WalletCards },
  { label: "Scan QR", detail: "When enabled by Razorpay", icon: QrCode },
];

export default function PaymentPreparation() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentStage, setPaymentStage] = useState("idle");
  const [selectedMethod, setSelectedMethod] = useState("");
  const paymentFailureRef = useRef(false);

  const refreshOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getOrder(orderId);
      setOrder(response.data.data?.order);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    refreshOrder();
  }, [refreshOrder]);

  const alreadyPaid =
    order?.paymentStatus === "PAID" || order?.status === "CONFIRMED";

  const checkPaymentStatus = useCallback(async () => {
    const response = await getPaymentStatus(orderId);
    const status = response.data.data;
    setOrder((current) =>
      current
        ? {
            ...current,
            paymentStatus: status.paymentStatus,
            status: status.orderStatus,
          }
        : current
    );
    return status.paymentStatus === "PAID" || status.orderStatus === "CONFIRMED";
  }, [orderId]);

  const waitForPaymentStatus = async () => {
    setPaymentStage("unknown");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (await checkPaymentStatus()) {
          navigate(`/orders/${orderId}`, { state: { paymentSuccess: true } });
          return true;
        }
      } catch {
        // The order page remains the source of truth if status polling is unavailable.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  };

  const handlePaymentSuccess = async (response, internalOrderId) => {
    setPaymentStage("verifying");
    setPaymentError("");
    try {
      await verifyPayment({
        orderId: internalOrderId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
      navigate(`/orders/${internalOrderId}`, {
        state: { paymentSuccess: true },
      });
    } catch (requestError) {
      setPaymentStage("unknown");
      setPaymentError(
        requestError.message ||
          "We're checking your payment status. Please try again shortly."
      );
      const confirmed = await waitForPaymentStatus();
      if (!confirmed) setPaymentStage("failed");
    }
  };

  const payNow = async (method = "") => {
    if (!order || alreadyPaid || !["idle", "failed", "cancelled"].includes(paymentStage)) {
      return;
    }
    setPaymentError("");
    setSelectedMethod(method);
    try {
      setPaymentStage("creating");
      paymentFailureRef.current = false;
      const response = await createPaymentOrder(order._id);
      const paymentData = response.data.data;
      setPaymentStage("opening");
      await loadRazorpayCheckout();
      openRazorpayCheckout({
        key: paymentData.keyId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        orderId: paymentData.razorpayOrderId,
        name: "Smart Canteen",
        description: `Canteen order ${order._id}`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        onSuccess: (checkoutResponse) =>
          handlePaymentSuccess(checkoutResponse, paymentData.internalOrderId),
        onFailure: () => {
          paymentFailureRef.current = true;
          setPaymentStage("failed");
          setPaymentError(PAYMENT_MESSAGES.failed);
        },
        onDismiss: async () => {
          if (paymentFailureRef.current) return;
          const confirmed = await waitForPaymentStatus();
          if (!confirmed) {
            setPaymentStage("cancelled");
            setPaymentError(PAYMENT_MESSAGES.cancelled);
          }
        },
      });
    } catch (requestError) {
      setPaymentStage("failed");
      setPaymentError(requestError.message || "Unable to start payment.");
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingSpinner label="Loading your order..." />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorMessage message={error} onRetry={refreshOrder} />
      </PageContainer>
    );
  }
  if (!order) {
    return (
      <PageContainer>
        <ErrorMessage message="Order details are unavailable." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm font-bold text-teal-700"
      >
        <ArrowLeft size={16} /> My orders
      </Link>

      <div className="mt-6 rounded-3xl bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-center gap-2 text-sm font-bold text-teal-300">
          <LockKeyhole size={16} aria-hidden="true" />
          {alreadyPaid ? "Payment successful" : "Secure checkout"}
        </div>
        <h1 className="mt-2 text-3xl font-black">
          {alreadyPaid ? "Order confirmed" : "Complete your payment"}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          {alreadyPaid
            ? "Your payment is confirmed and your order is in the canteen queue."
            : PAYMENT_MESSAGES[paymentStage] || PAYMENT_MESSAGES.idle}
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Order summary
              </p>
              <p className="mt-1 break-all text-sm font-bold text-slate-900">
                #{order._id}
              </p>
            </div>
            <CreditCard className="text-teal-700" aria-hidden="true" />
          </div>
          <div className="space-y-3 py-4">
            {(order.items || []).map((item) => (
              <div
                key={`${item.menuItem}-${item.quantity}`}
                className="flex justify-between gap-4 text-sm"
              >
                <span className="text-slate-600">
                  {item.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-bold text-slate-900">
                  ₹{item.subtotal}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-2xl font-black text-teal-700">
              ₹{order.totalAmount}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This total is calculated and confirmed by the server.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Payment methods
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {methodCards.map(({ label, detail, icon: Icon }) => {
              const unavailable = label === "Scan QR";
              return (
                <button
                  key={label}
                  type="button"
                  disabled={unavailable || !["idle", "failed", "cancelled"].includes(paymentStage)}
                  onClick={() => payNow(label)}
                  className={`rounded-xl border p-3 text-left transition ${
                    unavailable
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-75"
                      : selectedMethod === label
                        ? "border-teal-600 bg-teal-50 ring-2 ring-teal-100"
                        : "border-slate-200 bg-[#e8f1ed]/60 hover:border-teal-400 hover:bg-teal-50"
                  } disabled:cursor-not-allowed`}
                >
                  <Icon size={18} className={unavailable ? "text-slate-400" : "text-teal-700"} aria-hidden="true" />
                  <span className="mt-2 block text-sm font-bold text-slate-900">{label}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {unavailable ? "Not enabled for this account" : detail}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            UPI, cards, and netbanking open Razorpay Checkout. Choose the
            method there; availability can vary by device, bank, and provider.
            Scan &amp; Pay QR is not enabled for this Razorpay account.
          </p>
          {paymentError && (
            <div className="mt-4">
              <ErrorMessage message={paymentError} />
            </div>
          )}
          {alreadyPaid ? (
            <Link
              to={`/orders/${order._id}`}
              className="button-primary mt-5 w-full"
            >
              <CheckCircle2 size={18} /> View order
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={payNow}
                disabled={!["idle", "failed", "cancelled"].includes(paymentStage)}
                className="button-primary mt-5 w-full"
              >
                {!["idle", "failed", "cancelled"].includes(paymentStage) && (
                  <LoaderCircle size={18} className="animate-spin" />
                )}
                {paymentStage === "creating"
                  ? "Preparing payment..."
                  : paymentStage === "opening"
                    ? "Opening Checkout..."
                    : paymentStage === "verifying"
                      ? "Confirming payment..."
                      : `Pay ₹${order.totalAmount}`}
              </button>
              <button
                type="button"
                onClick={refreshOrder}
                disabled={loading || !["idle", "failed", "cancelled"].includes(paymentStage)}
                className="button-secondary mt-3 w-full"
              >
                <RefreshCw size={16} /> Refresh order status
              </button>
            </>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
