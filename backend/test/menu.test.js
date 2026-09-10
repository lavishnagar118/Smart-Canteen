const assert = require("node:assert/strict");
const test = require("node:test");

const MenuItem = require("../src/models/MenuItem");
const AppError = require("../src/utils/AppError");
const menuService = require("../src/services/menuService");
const { requireRole } = require("../src/middleware/authMiddleware");

const itemId = "507f1f77bcf86cd799439011";
const baseItem = {
  _id: itemId,
  name: "Paneer Thali",
  description: "Paneer with rice",
  price: 80,
  category: "THALI",
  imageUrl: "https://example.com/paneer.jpg",
  preparationTime: 8,
  isAvailable: true,
};

const withMenuStubs = async (stubs, callback) => {
  const originalMethods = {
    create: MenuItem.create,
    find: MenuItem.find,
    findById: MenuItem.findById,
    findByIdAndUpdate: MenuItem.findByIdAndUpdate,
    countDocuments: MenuItem.countDocuments,
  };

  Object.assign(MenuItem, stubs);
  try {
    await callback();
  } finally {
    Object.assign(MenuItem, originalMethods);
  }
};

const chain = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => value,
});

const expectStatus = (statusCode) => (error) =>
  error instanceof AppError && error.statusCode === statusCode;

test("gets available menu items with search, category, and pagination filters", async () => {
  let capturedFilter;
  await withMenuStubs(
    {
      find: (filter) => {
        capturedFilter = filter;
        return chain([baseItem]);
      },
      countDocuments: async () => 1,
    },
    async () => {
      const result = await menuService.getMenu({
        query: {
          category: "THALI",
          available: "true",
          search: "paneer",
          page: "2",
          limit: "20",
        },
        user: undefined,
      });

      assert.equal(result.items.length, 1);
      assert.deepEqual(result.pagination, {
        page: 2,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
      });
      assert.equal(capturedFilter.category, "THALI");
      assert.equal(capturedFilter.isAvailable, true);
      assert.equal(capturedFilter.name.$options, "i");
      assert.equal(capturedFilter.name.$regex, "paneer");
    }
  );
});

test("filters menu items by taste tag and handles taste queries", async () => {
  let capturedFilter;
  await withMenuStubs(
    {
      find: (filter) => {
        capturedFilter = filter;
        return chain([baseItem]);
      },
      countDocuments: async () => 1,
    },
    async () => {
      await menuService.getMenu({
        query: { taste: "Spicy" },
        user: undefined,
      });
      assert.equal(capturedFilter.tasteTags, "Spicy");

      await menuService.getMenu({
        query: { taste: "All" },
        user: undefined,
      });
      assert.equal("tasteTags" in capturedFilter, false);

      await assert.rejects(
        menuService.getMenu({
          query: { taste: "   " },
          user: undefined,
        }),
        expectStatus(400)
      );
    }
  );
});

test("customers cannot request unavailable items, while staff can view them", async () => {
  let capturedFilter;
  await withMenuStubs(
    {
      find: (filter) => {
        capturedFilter = filter;
        return chain([]);
      },
      countDocuments: async () => 0,
    },
    async () => {
      await menuService.getMenu({
        query: { available: "false" },
        user: { role: "CUSTOMER" },
      });
      assert.equal(capturedFilter.isAvailable, true);

      await menuService.getMenu({
        query: { available: "false" },
        user: { role: "STAFF" },
      });
      assert.equal(capturedFilter.isAvailable, false);

      await menuService.getMenu({
        query: {},
        user: { role: "ADMIN" },
      });
      assert.equal("isAvailable" in capturedFilter, false);
    }
  );
});

test("gets a menu item and hides unavailable items from customers", async () => {
  let lookupCount = 0;
  await withMenuStubs(
    {
      findById: () => {
        lookupCount += 1;
        return chain(lookupCount === 1 ? baseItem : { ...baseItem, isAvailable: false });
      },
    },
    async () => {
      const item = await menuService.getMenuItemById(itemId);
      assert.equal(item.name, "Paneer Thali");

      await assert.rejects(
        menuService.getMenuItemById(itemId, { role: "CUSTOMER" }),
        expectStatus(404)
      );
    }
  );
});

test("rejects invalid and nonexistent menu item IDs", async () => {
  await assert.rejects(
    menuService.getMenuItemById("not-an-id"),
    expectStatus(400)
  );

  await withMenuStubs(
    { findById: () => chain(null) },
    async () => {
      await assert.rejects(
        menuService.getMenuItemById(itemId, { role: "STAFF" }),
        expectStatus(404)
      );
    }
  );
});

test("creates menu items for staff and admin data", async () => {
  let createdData;
  await withMenuStubs(
    {
      create: async (data) => {
        createdData = data;
        return { ...baseItem, ...data };
      },
    },
    async () => {
      const item = await menuService.createMenuItem({
        name: " Paneer Thali ",
        description: "Paneer with dal",
        price: 80,
        category: "THALI",
        preparationTime: 8,
      });
      assert.equal(item.name, "Paneer Thali");
      assert.equal(createdData.isAvailable, true);
    }
  );
});

test("rejects invalid price, preparation time, and unexpected fields", async () => {
  const invalidBase = { ...baseItem };
  await assert.rejects(
    menuService.createMenuItem({ ...invalidBase, price: 0 }),
    expectStatus(400)
  );
  await assert.rejects(
    menuService.createMenuItem({ ...invalidBase, preparationTime: -1 }),
    expectStatus(400)
  );
  await assert.rejects(
    menuService.createMenuItem({ ...invalidBase, role: "ADMIN" }),
    expectStatus(400)
  );
});

test("updates only permitted fields and rejects protected fields", async () => {
  let update;
  await withMenuStubs(
    {
      findByIdAndUpdate: (id, data) => {
        update = { id, data };
        return chain({ ...baseItem, ...data });
      },
    },
    async () => {
      const item = await menuService.updateMenuItem(itemId, {
        name: "Paneer Roll",
        price: 60,
      });
      assert.equal(item.name, "Paneer Roll");
      assert.deepEqual(update.data, { name: "Paneer Roll", price: 60 });

      await assert.rejects(
        menuService.updateMenuItem(itemId, { isAvailable: false }),
        expectStatus(400)
      );
    }
  );
});

test("updates availability and archives instead of hard deleting", async () => {
  let update;
  await withMenuStubs(
    {
      findByIdAndUpdate: (id, data) => {
        update = { id, data };
        return chain({ ...baseItem, ...data });
      },
    },
    async () => {
      const unavailable = await menuService.updateAvailability(itemId, false);
      assert.equal(unavailable.isAvailable, false);

      const archived = await menuService.archiveMenuItem(itemId);
      assert.equal(archived.isAvailable, false);
      assert.deepEqual(update.data, { isAvailable: false });

      await assert.rejects(
        menuService.updateAvailability(itemId, "false"),
        expectStatus(400)
      );
    }
  );
});

test("enforces customer, staff, and admin mutation authorization", async () => {
  const runRole = (role, allowedRoles) =>
    new Promise((resolve, reject) => {
      requireRole(...allowedRoles)(
        { user: { role } },
        {},
        (error) => (error ? reject(error) : resolve())
      );
    });

  await assert.rejects(runRole("CUSTOMER", ["STAFF", "ADMIN"]), expectStatus(403));
  await runRole("STAFF", ["STAFF", "ADMIN"]);
  await runRole("ADMIN", ["STAFF", "ADMIN"]);
});
