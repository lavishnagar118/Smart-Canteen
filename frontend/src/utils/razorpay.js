const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load payment checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("Unable to load payment checkout."));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export function openRazorpayCheckout({
  key,
  amount,
  currency,
  orderId,
  name,
  description,
  prefill,
  onSuccess,
  onFailure,
  onDismiss,
}) {
  if (!window.Razorpay) {
    throw new Error("Payment checkout is not available.");
  }

  const checkout = new window.Razorpay({
    key,
    amount,
    currency,
    name,
    description,
    order_id: orderId,
    handler: onSuccess,
    prefill,
    theme: { color: "#f97316" },
    modal: { ondismiss: onDismiss },
  });
  checkout.on("payment.failed", (response) => onFailure?.(response));
  checkout.open();
  return checkout;
}
