const assert = require("node:assert/strict");
const test = require("node:test");

process.env.KITCHEN_STAFF_COUNT = "2";

const MenuItem = require("../src/models/MenuItem");
const Order = require("../src/models/Order");
const QueueEntry = require("../src/models/QueueEntry");
const AppError = require("../src/utils/AppError");
const queueService = require("../src/services/queueService");

const customerId = "507f1f77bcf86cd799439011";
const otherCustomerId = "507f1f77bcf86cd799439012";
const orderIds = [
  "507f1f77bcf86cd799439021",
  "507f1f77bcf86cd799439022",
  "507f1f77bcf86cd799439023",
];
const menuIds = [
  "507f1f77bcf86cd799439031",
  "507f1f77bcf86cd799439032",
];

const orders = [
  {
    _id: orderIds[0],
    user: customerId,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    items: [{ menuItem: menuIds[0], quantity: 1 }],
  },
  {
    _id: orderIds[1],
    user: customerId,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-01T10:01:00Z"),
    items: [{ menuItem: menuIds[1], quantity: 1 }],
  },
  {
    _id: orderIds[2],
    user: otherCustomerId,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-01T10:02:00Z"),
    items: [{ menuItem: menuIds[0], quantity: 1 }],
  },
];

const menuItems = [
  { _id: menuIds[0], preparationTime: 8 },
  { _id: menuIds[1], preparationTime: 6 },
];

const chain = (value) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  lean: async () => value,
});

const Canteen = require("../src/models/Canteen");

const withStubs = async (stubs, callback) => {
  const originals = {
    menuFind: MenuItem.find,
    orderFind: Order.find,
    orderFindById: Order.findById,
    orderFindOne: Order.findOne,
    orderFindByIdAndUpdate: Order.findByIdAndUpdate,
    queueFindOne: QueueEntry.findOne,
    queueFindOneAndUpdate: QueueEntry.findOneAndUpdate,
    canteenFindOne: Canteen.findOne,
  };

  MenuItem.find = stubs.menuFind || (() => chain(menuItems));
  Order.find = stubs.orderFind || (() => chain(orders));
  Order.findById = stubs.orderFindById || ((id) => chain(orders.find((order) => order._id === id)));
  Order.findOne = stubs.orderFindOne || ((filter) =>
    chain(orders.find((order) => order._id === filter._id && order.user === filter.user))
  );
  Order.findByIdAndUpdate = stubs.orderFindByIdAndUpdate || (async () => {});
  QueueEntry.findOne = stubs.queueFindOne || (() => chain({ status: "WAITING" }));
  QueueEntry.findOneAndUpdate =
    stubs.queueFindOneAndUpdate || (async (filter, update) => ({ ...filter, ...update }));
  Canteen.findOne = stubs.canteenFindOne || (() => chain({ _id: "507f1f77bcf86cd799439099", isActive: true }));

  try {
    await callback();
  } finally {
    MenuItem.find = originals.menuFind;
    Order.find = originals.orderFind;
    Order.findById = originals.orderFindById;
    Order.findOne = originals.orderFindOne;
    Order.findByIdAndUpdate = originals.orderFindByIdAndUpdate;
    QueueEntry.findOne = originals.queueFindOne;
    QueueEntry.findOneAndUpdate = originals.queueFindOneAndUpdate;
    Canteen.findOne = originals.canteenFindOne;
  }
};

const expectStatus = (statusCode) => (error) =>
  error instanceof AppError && error.statusCode === statusCode;

test("confirmed orders enter the queue idempotently", async () => {
  let upsertCount = 0;
  await withStubs(
    {
      orderFindById: () => chain(orders[0]),
      queueFindOneAndUpdate: async () => {
        upsertCount += 1;
        return {};
      },
    },
    async () => {
      await queueService.addOrderToQueue(orderIds[0]);
      assert.ok(upsertCount >= 1);
      await queueService.addOrderToQueue(orderIds[0]);
      assert.ok(upsertCount >= 2);
    }
  );
});

test("pending payment orders do not enter the queue", async () => {
  await withStubs(
    {
      orderFindById: () =>
        chain({ ...orders[0], status: "PENDING_PAYMENT", paymentStatus: "PENDING" }),
    },
    async () => {
      await assert.rejects(
        queueService.addOrderToQueue(orderIds[0]),
        expectStatus(409)
      );
    }
  );
});

test("recalculates FIFO positions and parallel wait estimates", async () => {
  const updates = [];
  await withStubs(
    {
      orderFind: () => chain(orders.slice(0, 3)),
      orderFindByIdAndUpdate: async (id, update) => {
        updates.push({ id, update });
      },
    },
    async () => {
      const schedule = await queueService.recalculateQueue();
      assert.deepEqual(
        schedule.map((entry) => entry.order._id),
        orderIds
      );
      assert.deepEqual(
        updates.map((item) => item.update.queuePosition),
        [1, 2, 3]
      );
      assert.equal(schedule[0].startAt, 0);
      assert.equal(schedule[1].startAt, 0);
      assert.equal(schedule[2].startAt, 6);
      assert.ok(schedule.every((entry) => entry.startAt >= 0));
    }
  );
});

test("current preparing orders are included in the active queue", async () => {
  const preparing = { ...orders[0], status: "PREPARING" };
  await withStubs(
    { orderFind: () => chain([preparing, orders[1]]) },
    async () => {
      const queue = await queueService.getCurrentQueue();
      assert.equal(queue.length, 2);
      assert.equal(queue[0].status, "PREPARING");
    }
  );
});

test("multiple items affect preparation duration using the maximum item workload", async () => {
  const multiItemOrder = {
    ...orders[0],
    items: [
      { menuItem: menuIds[0], quantity: 1 },
      { menuItem: menuIds[1], quantity: 2 },
    ],
  };
  await withStubs(
    { orderFind: () => chain([multiItemOrder]) },
    async () => {
      const schedule = await queueService.recalculateQueue();
      assert.equal(schedule[0].duration, 12);
    }
  );
});

test("customers can view only their own active queue status", async () => {
  await withStubs(
    {
      orderFindOne: (filter) =>
        chain(
          filter.user === customerId && filter._id === orderIds[0]
            ? orders[0]
            : null
        ),
      orderFind: () => chain([orders[0], orders[1]]),
    },
    async () => {
      const status = await queueService.getQueueStatus(
        { _id: customerId },
        orderIds[0]
      );
      assert.equal(status.orderId, orderIds[0]);
      assert.equal(status.ordersAhead, 0);
      assert.ok(status.estimatedWaitTime >= 0);

      await assert.rejects(
        queueService.getQueueStatus({ _id: otherCustomerId }, orderIds[0]),
        expectStatus(404)
      );
    }
  );
});

test("staff transitions follow the valid state machine", async () => {
  const saved = [];
  const order = {
    ...orders[0],
    async save() {
      saved.push(this.status);
      return this;
    },
  };
  await withStubs(
    {
      orderFindById: () => order,
      orderFind: () => chain([order]),
    },
    async () => {
      await queueService.acceptOrder(orderIds[0]);
      order.status = "ACCEPTED";
      await queueService.startPreparing(orderIds[0]);
      order.status = "PREPARING";
      await queueService.markReady(orderIds[0]);
      order.status = "READY";
      await queueService.completeOrder(orderIds[0]);
      assert.deepEqual(saved, ["ACCEPTED", "PREPARING", "READY", "COMPLETED"]);
    }
  );
});

test("invalid transitions, missing orders, and invalid IDs are rejected", async () => {
  await assert.rejects(
    queueService.acceptOrder("invalid-id"),
    expectStatus(400)
  );

  await withStubs(
    { orderFindById: () => null },
    async () => {
      await assert.rejects(
        queueService.acceptOrder(orderIds[0]),
        expectStatus(404)
      );
    }
  );

  const invalid = {
    ...orders[0],
    status: "PREPARING",
    async save() {},
  };
  await withStubs(
    { orderFindById: () => invalid },
    async () => {
      await assert.rejects(
        queueService.acceptOrder(orderIds[0]),
        expectStatus(409)
      );
    }
  );
});

test("completed and cancelled orders are excluded from the active queue", async () => {
  await withStubs(
    {
      orderFind: (filter) =>
        chain(
          filter.status.$in.includes("COMPLETED")
            ? [
                { ...orders[0], status: "COMPLETED" },
                { ...orders[1], status: "CANCELLED" },
              ]
            : []
        ),
    },
    async () => {
      const queue = await queueService.getCurrentQueue();
      assert.equal(queue.length, 0);
    }
  );
});

test("canteen-scoped queue recalculation only schedules orders from the specified canteen", async () => {
  const canteenA = "507f1f77bcf86cd799439091";
  const canteenB = "507f1f77bcf86cd799439092";
  const orderA = { ...orders[0], _id: orderIds[0], canteen: canteenA };
  const orderB = { ...orders[1], _id: orderIds[1], canteen: canteenB };

  let capturedFilter;
  await withStubs(
    {
      orderFind: (filter) => {
        capturedFilter = filter;
        if (filter.canteen === canteenA) return chain([orderA]);
        if (filter.canteen === canteenB) return chain([orderB]);
        return chain([orderA, orderB]);
      },
    },
    async () => {
      const scheduleA = await queueService.recalculateQueue(canteenA);
      assert.equal(scheduleA.length, 1);
      assert.equal(scheduleA[0].order._id, orderIds[0]);
      assert.equal(capturedFilter.canteen, canteenA);

      const queueA = await queueService.getCurrentQueue(canteenA);
      assert.equal(queueA.length, 1);
      assert.equal(queueA[0].orderId, orderIds[0]);
    }
  );
});
