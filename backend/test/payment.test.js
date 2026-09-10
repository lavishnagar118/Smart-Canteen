const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test-key-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";

const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const AppError = require("../src/utils/AppError");
const paymentService = require("../src/services/paymentService");
const queueService = require("../src/services/queueService");
const { authenticate } = require("../src/middleware/authMiddleware");

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const orderId = "507f1f77bcf86cd799439021";
const razorpayOrderId = "order_test_123";
const razorpayPaymentId = "pay_test_123";

const pendingOrder = (overrides = {}) => ({
  _id: orderId,
  user: userId,
  totalAmount: 80,
  status: "PENDING_PAYMENT",
  paymentStatus: "PENDING",
  ...overrides,
  async save() {
    return this;
  },
});

const paymentRecord = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439031",
  order: orderId,
  user: userId,
  razorpayOrderId,
  amount: 8000,
  status: "CREATED",
  ...overrides,
});

const withStubs = async (stubs, callback) => {
  const originals = {
    orderFindOne: Order.findOne,
    orderFindByIdAndUpdate: Order.findByIdAndUpdate,
    paymentFindOne: Payment.findOne,
    paymentCreate: Payment.create,
    paymentFindOneAndUpdate: Payment.findOneAndUpdate,
    paymentFindById: Payment.findById,
    queueAddOrderToQueue: queueService.addOrderToQueue,
  };

  Object.assign(Order, {
    findOne: stubs.orderFindOne || originals.orderFindOne,
    findByIdAndUpdate: stubs.orderFindByIdAndUpdate || originals.orderFindByIdAndUpdate,
  });
  Object.assign(Payment, {
    findOne: stubs.paymentFindOne || originals.paymentFindOne,
    create: stubs.paymentCreate || originals.paymentCreate,
    findOneAndUpdate: stubs.paymentFindOneAndUpdate || originals.paymentFindOneAndUpdate,
    findById: stubs.paymentFindById || originals.paymentFindById,
  });
  queueService.addOrderToQueue = stubs.queueAddOrderToQueue || (async () => {});

  try {
    await callback();
  } finally {
    Object.assign(Order, {
      findOne: originals.orderFindOne,
      findByIdAndUpdate: originals.orderFindByIdAndUpdate,
    });
    Object.assign(Payment, {
      findOne: originals.paymentFindOne,
      create: originals.paymentCreate,
      findOneAndUpdate: originals.paymentFindOneAndUpdate,
      findById: originals.paymentFindById,
    });
    queueService.addOrderToQueue = originals.queueAddOrderToQueue;
  }
};

const expectStatus = (statusCode) => (error) =>
  error instanceof AppError && error.statusCode === statusCode;

const signatureFor = (order, payment, secret = process.env.RAZORPAY_KEY_SECRET) =>
  crypto
    .createHmac("sha256", secret)
    .update(`${order}|${payment}`)
    .digest("hex");

const webhookSignatureFor = (body) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

test("creates a Razorpay order from internal Order.totalAmount only", async () => {
  let razorpayRequest;
  let createdPayment;
  const client = {
    orders: {
      create: async (request) => {
        razorpayRequest = request;
        return { id: razorpayOrderId };
      },
    },
  };

  await withStubs(
    {
      orderFindOne: async () => pendingOrder(),
      paymentFindOne: async () => null,
      paymentCreate: async (data) => {
        createdPayment = paymentRecord(data);
        return createdPayment;
      },
    },
    async () => {
      const result = await paymentService.createRazorpayOrder(
        userId,
        orderId,
        client
      );
      assert.equal(razorpayRequest.amount, 8000);
      assert.equal(razorpayRequest.currency, "INR");
      assert.equal(razorpayRequest.receipt, `order_${orderId}`);
      assert.equal(createdPayment.status, "CREATED");
      assert.equal(result.amount, 8000);
      assert.equal(result.keyId, "rzp_test_key");
    }
  );
});

test("does not allow another customer or a non-pending order to create payment", async () => {
  await withStubs(
    { orderFindOne: async () => null },
    async () => {
      await assert.rejects(
        paymentService.createRazorpayOrder(otherUserId, orderId, {}),
        expectStatus(404)
      );
    }
  );

  await withStubs(
    { orderFindOne: async () => pendingOrder({ status: "CONFIRMED" }) },
    async () => {
      await assert.rejects(
        paymentService.createRazorpayOrder(userId, orderId, {}),
        expectStatus(409)
      );
    }
  );
});

test("reuses an existing active Razorpay order", async () => {
  let sdkCalled = false;
  const client = {
    orders: {
      create: async () => {
        sdkCalled = true;
        return { id: "new_order" };
      },
    },
  };
  await withStubs(
    {
      orderFindOne: async () =>
        pendingOrder({ razorpayOrderId }),
      paymentFindOne: async () => paymentRecord(),
    },
    async () => {
      const result = await paymentService.createRazorpayOrder(
        userId,
        orderId,
        client
      );
      assert.equal(result.razorpayOrderId, razorpayOrderId);
      assert.equal(sdkCalled, false);
    }
  );
});

test("failed payment orders can retry with a fresh Razorpay order", async () => {
  let savedOrder;
  let createdPayment;
  const failedOrder = pendingOrder({
    paymentStatus: "FAILED",
    razorpayOrderId: "order_failed_123",
  });
  failedOrder.save = function save() {
    savedOrder = {
      paymentStatus: this.paymentStatus,
      razorpayOrderId: this.razorpayOrderId,
    };
    return this;
  };
  const client = {
    orders: {
      create: async () => ({ id: "order_retry_456" }),
    },
  };

  await withStubs(
    {
      orderFindOne: async () => failedOrder,
      paymentFindOne: async () => null,
      paymentCreate: async (data) => {
        createdPayment = paymentRecord(data);
        return createdPayment;
      },
    },
    async () => {
      const result = await paymentService.createRazorpayOrder(
        userId,
        orderId,
        client
      );
      assert.equal(result.razorpayOrderId, "order_retry_456");
      assert.deepEqual(savedOrder, {
        paymentStatus: "PENDING",
        razorpayOrderId: "order_retry_456",
      });
      assert.equal(createdPayment.razorpayOrderId, "order_retry_456");
    }
  );
});

test("payment status is limited to the authenticated customer's order", async () => {
  const customerOrder = {
    _id: orderId,
    status: "CONFIRMED",
    paymentStatus: "PAID",
  };

  await withStubs(
    { orderFindOne: async () => customerOrder },
    async () => {
      assert.deepEqual(await paymentService.getPaymentStatus(userId, orderId), {
        orderId,
        orderStatus: "CONFIRMED",
        paymentStatus: "PAID",
      });
    }
  );

  await withStubs(
    { orderFindOne: async () => null },
    async () => {
      await assert.rejects(
        paymentService.getPaymentStatus(otherUserId, orderId),
        expectStatus(404)
      );
    }
  );
});

test("validates signatures and rejects mismatched Razorpay order IDs", async () => {
  await withStubs(
    {
      orderFindOne: async () => pendingOrder({ razorpayOrderId }),
      paymentFindOne: async () => paymentRecord(),
    },
    async () => {
      await assert.rejects(
        paymentService.verifyPayment(userId, {
          orderId,
          razorpay_order_id: "different_order",
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: "invalid",
        }),
        expectStatus(400)
      );

      await assert.rejects(
        paymentService.verifyPayment(userId, {
          orderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: "invalid",
        }),
        expectStatus(400)
      );
    }
  );
});

test("successful verification captures payment and confirms order", async () => {
  let paymentUpdate;
  let orderUpdate;
  await withStubs(
    {
      orderFindOne: async () => pendingOrder({ razorpayOrderId }),
      paymentFindOne: async () => paymentRecord(),
      paymentFindOneAndUpdate: async (filter, update) => {
        paymentUpdate = { filter, update };
        return paymentRecord({
          status: "CAPTURED",
          razorpayPaymentId,
          razorpaySignature: update.razorpaySignature,
        });
      },
      paymentFindById: async () => paymentRecord({ status: "CAPTURED" }),
      orderFindByIdAndUpdate: async (id, update) => {
        orderUpdate = { id, update };
      },
    },
    async () => {
      const result = await paymentService.verifyPayment(userId, {
        orderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signatureFor(razorpayOrderId, razorpayPaymentId),
      });
      assert.equal(result.payment.status, "CAPTURED");
      assert.equal(paymentUpdate.update.status, "CAPTURED");
      assert.equal(orderUpdate.update.paymentStatus, "PAID");
      assert.equal(orderUpdate.update.status, "CONFIRMED");
      assert.equal(orderUpdate.update.queuePosition, undefined);
      assert.equal(orderUpdate.update.estimatedWaitTime, undefined);
    }
  );
});

test("duplicate verification is idempotent", async () => {
  await withStubs(
    {
      orderFindOne: async () => pendingOrder({ razorpayOrderId }),
      paymentFindOne: async () =>
        paymentRecord({ status: "CAPTURED", razorpayPaymentId }),
    },
    async () => {
      const result = await paymentService.verifyPayment(userId, {
        orderId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: "not-needed",
      });
      assert.equal(result.payment.status, "CAPTURED");
    }
  );
});

test("failed payments do not mark orders paid", async () => {
  const body = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: razorpayOrderId,
        },
      },
    },
  });
  let paymentUpdate;
  let orderUpdate;

  await withStubs(
    {
      paymentFindOne: async () => paymentRecord(),
      paymentFindOneAndUpdate: async (filter, update) => {
        paymentUpdate = { filter, update };
        return paymentRecord({ status: "FAILED" });
      },
      orderFindByIdAndUpdate: async (id, update) => {
        orderUpdate = { id, update };
      },
    },
    async () => {
      await paymentService.processWebhook(
        Buffer.from(body),
        webhookSignatureFor(body)
      );
      assert.equal(paymentUpdate.update.status, "FAILED");
      assert.equal(orderUpdate.update.paymentStatus, "FAILED");
      assert.equal(orderUpdate.update.status, undefined);
    }
  );
});

test("processes captured and order.paid webhooks idempotently", async () => {
  let capturedCount = 0;
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: razorpayOrderId,
        },
      },
    },
  });

  await withStubs(
    {
      paymentFindOne: async () => paymentRecord(),
      paymentFindOneAndUpdate: async () => {
        capturedCount += 1;
        return paymentRecord({ status: "CAPTURED" });
      },
      paymentFindById: async () => paymentRecord({ status: "CAPTURED" }),
      orderFindByIdAndUpdate: async () => {},
    },
    async () => {
      await paymentService.processWebhook(
        Buffer.from(body),
        webhookSignatureFor(body)
      );
      assert.equal(capturedCount, 1);
    }
  );

  await withStubs(
    {
      paymentFindOne: async () => paymentRecord({ status: "CAPTURED" }),
    },
    async () => {
      const result = await paymentService.processWebhook(
        Buffer.from(body),
        webhookSignatureFor(body)
      );
      assert.equal(result.processed, true);
    }
  );
});

test("rejects invalid webhook signatures and unauthenticated requests", async () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  await assert.rejects(
    paymentService.processWebhook(body, "invalid"),
    expectStatus(400)
  );

  const error = await new Promise((resolve) => {
    authenticate({ headers: {} }, {}, (middlewareError) => resolve(middlewareError));
  });
  assert.equal(error.statusCode, 401);
});
