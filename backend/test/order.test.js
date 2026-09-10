const assert = require("node:assert/strict");
const test = require("node:test");

const MenuItem = require("../src/models/MenuItem");
const Order = require("../src/models/Order");
const AppError = require("../src/utils/AppError");
const orderService = require("../src/services/orderService");
const { authenticate, requireRole } = require("../src/middleware/authMiddleware");

const customerId = "507f1f77bcf86cd799439011";
const otherCustomerId = "507f1f77bcf86cd799439012";
const itemId = "507f1f77bcf86cd799439021";
const secondItemId = "507f1f77bcf86cd799439022";
const orderId = "507f1f77bcf86cd799439031";

const menuItems = [
  {
    _id: itemId,
    name: "Paneer Thali",
    price: 80,
    category: "THALI",
    isAvailable: true,
  },
  {
    _id: secondItemId,
    name: "Paneer Roll",
    price: 50,
    category: "SNACKS",
    isAvailable: true,
  },
];

const withStubs = async (stubs, callback) => {
  const originals = {
    menuFind: MenuItem.find,
    orderCreate: Order.create,
    orderFind: Order.find,
    orderCountDocuments: Order.countDocuments,
    orderFindOne: Order.findOne,
    orderFindOneAndUpdate: Order.findOneAndUpdate,
  };

  if (stubs.menuFind) MenuItem.find = stubs.menuFind;
  if (stubs.orderCreate) Order.create = stubs.orderCreate;
  if (stubs.orderFind) Order.find = stubs.orderFind;
  if (stubs.orderCountDocuments) Order.countDocuments = stubs.orderCountDocuments;
  if (stubs.orderFindOne) Order.findOne = stubs.orderFindOne;
  if (stubs.orderFindOneAndUpdate) {
    Order.findOneAndUpdate = stubs.orderFindOneAndUpdate;
  }

  try {
    await callback();
  } finally {
    MenuItem.find = originals.menuFind;
    Order.create = originals.orderCreate;
    Order.find = originals.orderFind;
    Order.countDocuments = originals.orderCountDocuments;
    Order.findOne = originals.orderFindOne;
    Order.findOneAndUpdate = originals.orderFindOneAndUpdate;
  }
};

const queryChain = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  select() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => value,
});

const expectStatus = (statusCode) => (error) =>
  error instanceof AppError && error.statusCode === statusCode;

const createStub = async (data) => ({
  _id: orderId,
  ...data,
});

test("creates an order with multiple items and backend-calculated totals", async () => {
  let createdOrder;
  let capturedMenuFilter;

  await withStubs(
    {
      menuFind: (filter) => {
        capturedMenuFilter = filter;
        return queryChain(menuItems);
      },
      orderCreate: async (data) => {
        createdOrder = await createStub(data);
        return createdOrder;
      },
    },
    async () => {
      const order = await orderService.createOrder(customerId, {
        items: [
          { menuItem: itemId, quantity: 2 },
          { menuItem: secondItemId, quantity: 1 },
        ],
      });

      assert.equal(order.totalAmount, 210);
      assert.deepEqual(
        order.items.map(({ name, price, quantity, subtotal }) => ({
          name,
          price,
          quantity,
          subtotal,
        })),
        [
          { name: "Paneer Thali", price: 80, quantity: 2, subtotal: 160 },
          { name: "Paneer Roll", price: 50, quantity: 1, subtotal: 50 },
        ]
      );
      assert.equal(order.status, "PENDING_PAYMENT");
      assert.equal(order.paymentStatus, "PENDING");
      assert.equal(order.queuePosition, undefined);
      assert.equal(order.estimatedWaitTime, undefined);
      assert.deepEqual(capturedMenuFilter.isAvailable, true);
      assert.equal(createdOrder.user, customerId);
    }
  );
});

test("combines duplicate menu items", async () => {
  await withStubs(
    {
      menuFind: () => queryChain([menuItems[0]]),
      orderCreate: createStub,
    },
    async () => {
      const order = await orderService.createOrder(customerId, {
        items: [
          { menuItem: itemId, quantity: 2 },
          { menuItem: itemId, quantity: 3 },
        ],
      });
      assert.equal(order.items.length, 1);
      assert.equal(order.items[0].quantity, 5);
      assert.equal(order.items[0].subtotal, 400);
      assert.equal(order.totalAmount, 400);
    }
  );
});

test("rejects invalid quantities, item IDs, fields, and client-controlled totals", async () => {
  const invalidRequests = [
    { items: [{ menuItem: itemId, quantity: 0 }] },
    { items: [{ menuItem: itemId, quantity: -1 }] },
    { items: [{ menuItem: itemId, quantity: 1.5 }] },
    { items: [{ menuItem: itemId, quantity: 101 }] },
    { items: [{ menuItem: "invalid-id", quantity: 1 }] },
    { items: [{ menuItem: itemId, quantity: 1, price: 1 }] },
    { items: [{ menuItem: itemId, quantity: 1, subtotal: 1 }] },
    { items: [{ menuItem: itemId, quantity: 1 }], totalAmount: 1 },
    { items: [{ menuItem: itemId, quantity: 1 }], status: "CONFIRMED" },
  ];

  for (const request of invalidRequests) {
    await assert.rejects(
      orderService.createOrder(customerId, request),
      expectStatus(400)
    );
  }
});

test("rejects missing, unavailable, or nonexistent menu items without creating an order", async () => {
  let createCalled = false;
  await withStubs(
    {
      menuFind: () => queryChain([menuItems[0]]),
      orderCreate: async () => {
        createCalled = true;
        return {};
      },
    },
    async () => {
      await assert.rejects(
        orderService.createOrder(customerId, {
          items: [
            { menuItem: itemId, quantity: 1 },
            { menuItem: secondItemId, quantity: 1 },
          ],
        }),
        expectStatus(400)
      );
      assert.equal(createCalled, false);
    }
  );
});

test("retrieves a customer's orders with pagination and status filtering", async () => {
  let capturedFilter;
  await withStubs(
    {
      orderFind: (filter) => {
        capturedFilter = filter;
        return queryChain([{ _id: orderId, user: customerId }]);
      },
      orderCountDocuments: async () => 11,
    },
    async () => {
      const result = await orderService.getUserOrders(customerId, {
        page: "2",
        limit: "10",
        status: "CONFIRMED",
      });
      assert.equal(result.orders.length, 1);
      assert.deepEqual(result.pagination, {
        page: 2,
        limit: 10,
        totalItems: 11,
        totalPages: 2,
      });
      assert.equal(capturedFilter.user, customerId);
      assert.equal(capturedFilter.status, "CONFIRMED");
    }
  );
});

test("rejects invalid order status and pagination", async () => {
  await assert.rejects(
    orderService.getUserOrders(customerId, { status: "PAID" }),
    expectStatus(400)
  );
  await assert.rejects(
    orderService.getUserOrders(customerId, { page: "0" }),
    expectStatus(400)
  );
  await assert.rejects(
    orderService.getUserOrders(customerId, { limit: "101" }),
    expectStatus(400)
  );
});

test("retrieves only the authenticated customer's order", async () => {
  let capturedFilter;
  await withStubs(
    {
      orderFindOne: (filter) => {
        capturedFilter = filter;
        return queryChain({ _id: orderId, user: customerId });
      },
    },
    async () => {
      const order = await orderService.getOrderById(customerId, orderId);
      assert.equal(order._id, orderId);
      assert.equal(capturedFilter.user, customerId);

      await withStubs(
        { orderFindOne: () => queryChain(null) },
        async () => {
          await assert.rejects(
            orderService.getOrderById(otherCustomerId, orderId),
            expectStatus(404)
          );
        }
      );
    }
  );
});

test("cancels a customer's pending payment order", async () => {
  let updateFilter;
  await withStubs(
    {
      orderFindOneAndUpdate: (filter) => {
        updateFilter = filter;
        return queryChain({ _id: orderId, status: "CANCELLED" });
      },
    },
    async () => {
      const order = await orderService.cancelOrder(customerId, orderId);
      assert.equal(order.status, "CANCELLED");
      assert.equal(updateFilter.user, customerId);
      assert.equal(updateFilter.status, "PENDING_PAYMENT");
    }
  );
});

test("does not cancel confirmed or another customer's order", async () => {
  await withStubs(
    {
      orderFindOneAndUpdate: () => queryChain(null),
      orderFindOne: () => queryChain({ status: "CONFIRMED" }),
    },
    async () => {
      await assert.rejects(
        orderService.cancelOrder(customerId, orderId),
        expectStatus(409)
      );
    }
  );

  await withStubs(
    {
      orderFindOneAndUpdate: () => queryChain(null),
      orderFindOne: () => queryChain(null),
    },
    async () => {
      await assert.rejects(
        orderService.cancelOrder(otherCustomerId, orderId),
        expectStatus(404)
      );
    }
  );
});

test("requires authentication and CUSTOMER role for order routes", async () => {
  const unauthenticated = await new Promise((resolve) => {
    authenticate({ headers: {} }, {}, (error) => resolve(error));
  });
  assert.equal(unauthenticated.statusCode, 401);

  const unauthorized = await new Promise((resolve) => {
    requireRole("CUSTOMER")(
      { user: { role: "STAFF" } },
      {},
      (error) => resolve(error)
    );
  });
  assert.equal(unauthorized.statusCode, 403);
});

test("retrieves operational orders filtered by canteenId and status", async () => {
  let capturedFilter;
  const canteenId = "507f1f77bcf86cd799439099";
  await withStubs(
    {
      orderFind: (filter) => {
        capturedFilter = filter;
        return queryChain([{ _id: orderId, canteen: canteenId, status: "CONFIRMED" }]);
      },
      orderCountDocuments: async () => 1,
    },
    async () => {
      const result = await orderService.getOperationalOrders({
        canteenId,
        status: "CONFIRMED",
        page: "1",
        limit: "10",
      });
      assert.equal(result.orders.length, 1);
      assert.equal(capturedFilter.canteen, canteenId);
      assert.equal(capturedFilter.status, "CONFIRMED");
    }
  );
});
