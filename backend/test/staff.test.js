const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const User = require("../src/models/User");
const Canteen = require("../src/models/Canteen");
const AppError = require("../src/utils/AppError");
const { authenticate, requireRole } = require("../src/middleware/authMiddleware");
const { loginUser } = require("../src/services/authService");
const staffService = require("../src/services/staffService");

const canteenId = "507f1f77bcf86cd799439099";

const withStubs = async (model, stubs, callback) => {
  const originalMethods = {};
  for (const key of Object.keys(stubs)) {
    originalMethods[key] = model[key];
    model[key] = stubs[key];
  }

  try {
    await callback();
  } finally {
    for (const key of Object.keys(originalMethods)) {
      model[key] = originalMethods[key];
    }
  }
};

test("Admin creates a staff member with hashed password, unique staffId, and role STAFF", async () => {
  let createdUser = null;

  await withStubs(
    User,
    {
      find: () => ({
        select: () => ({
          lean: async () => [{ staffId: "STF-0001" }],
        }),
      }),
      exists: async ({ staffId }) => staffId === "STF-0001",
      findOne: async () => null,
      create: async (data) => {
        createdUser = {
          _id: "507f1f77bcf86cd799439001",
          ...data,
          toObject() {
            return { ...this };
          },
        };
        return createdUser;
      },
      findById: () => ({
        populate: () => ({
          select: async () => ({
            ...createdUser,
            toObject() {
              return { ...this };
            },
          }),
        }),
      }),
    },
    async () => {
      const result = await staffService.createStaff({
        name: "Chef Gordon",
        email: "gordon@smartcanteen.local",
        phone: "+919876543201",
        password: "SecretStaffPassword123!",
        confirmPassword: "SecretStaffPassword123!",
        role: "ADMIN", // Malicious / spoofed client attempt to elevate role
      });

      // Assertions
      assert.equal(result.name, "Chef Gordon");
      assert.equal(result.email, "gordon@smartcanteen.local");
      assert.equal(result.role, "STAFF", "Backend must enforce role is always STAFF");
      assert.equal(result.status, "ACTIVE");
      assert.equal(result.staffId, "STF-0002", "Must generate unique sequential STF-0002");
      assert.equal(result.password, undefined, "Password must never be returned");
      assert.equal(result.googleId, undefined);
      assert.equal(result.sessionVersion, undefined);

      // Password hashing check
      assert.ok(createdUser.password, "Password must be stored in document");
      assert.notEqual(createdUser.password, "SecretStaffPassword123!", "Password must not be plaintext");
      assert.ok(
        bcrypt.compareSync("SecretStaffPassword123!", createdUser.password),
        "Password must be properly hashed with bcrypt"
      );
    }
  );
});

test("Staff creation rejects duplicate email and invalid passwords", async () => {
  await withStubs(
    User,
    {
      findOne: async ({ email }) =>
        email === "existing@smartcanteen.local" ? { _id: "1" } : null,
    },
    async () => {
      // Duplicate email
      await assert.rejects(
        staffService.createStaff({
          name: "Duplicate User",
          email: "existing@smartcanteen.local",
          password: "ValidPassword123!",
        }),
        (err) => err instanceof AppError && err.statusCode === 409
      );

      // Short password
      await assert.rejects(
        staffService.createStaff({
          name: "Short Pass",
          email: "short@smartcanteen.local",
          password: "short",
        }),
        (err) => err instanceof AppError && err.statusCode === 400
      );

      // Mismatched passwords
      await assert.rejects(
        staffService.createStaff({
          name: "Mismatch",
          email: "mismatch@smartcanteen.local",
          password: "ValidPassword123!",
          confirmPassword: "DifferentPassword123!",
        }),
        (err) => err instanceof AppError && err.statusCode === 400
      );
    }
  );
});

test("Role authorization rejects STAFF and CUSTOMER from admin-only routes", async () => {
  const adminGuard = requireRole("ADMIN");

  // STAFF user
  let staffError = null;
  adminGuard({ user: { role: "STAFF" } }, {}, (err) => {
    staffError = err;
  });
  assert.ok(staffError instanceof AppError);
  assert.equal(staffError.statusCode, 403, "STAFF must be rejected from admin-only operations");

  // CUSTOMER user
  let customerError = null;
  adminGuard({ user: { role: "CUSTOMER" } }, {}, (err) => {
    customerError = err;
  });
  assert.ok(customerError instanceof AppError);
  assert.equal(customerError.statusCode, 403, "CUSTOMER must be rejected from admin-only operations");

  // ADMIN user
  let adminPassed = false;
  adminGuard({ user: { role: "ADMIN" } }, {}, (err) => {
    if (!err) adminPassed = true;
  });
  assert.equal(adminPassed, true, "ADMIN must pass authorization");
});

test("Inactive staff login is rejected, while active staff logs in normally", async () => {
  const hashedPassword = bcrypt.hashSync("StaffPass123!", 4);

  const activeStaffDoc = {
    _id: "507f1f77bcf86cd799439001",
    name: "Active Staff",
    email: "active@smartcanteen.local",
    password: hashedPassword,
    role: "STAFF",
    status: "ACTIVE",
    sessionVersion: 0,
    toObject() {
      return { ...this };
    },
  };

  const inactiveStaffDoc = {
    _id: "507f1f77bcf86cd799439002",
    name: "Inactive Staff",
    email: "inactive@smartcanteen.local",
    password: hashedPassword,
    role: "STAFF",
    status: "INACTIVE",
    sessionVersion: 0,
    toObject() {
      return { ...this };
    },
  };

  await withStubs(
    User,
    {
      findOne: (filter) => ({
        select: async () => {
          if (filter.email === "active@smartcanteen.local") return activeStaffDoc;
          if (filter.email === "inactive@smartcanteen.local") return inactiveStaffDoc;
          return null;
        },
      }),
    },
    async () => {
      // Inactive staff login must be rejected with 403
      await assert.rejects(
        loginUser({
          email: "inactive@smartcanteen.local",
          password: "StaffPass123!",
        }),
        (err) => err instanceof AppError && err.statusCode === 403
      );

      // Active staff login succeeds
      const result = await loginUser({
        email: "active@smartcanteen.local",
        password: "StaffPass123!",
      });
      assert.equal(result.user.role, "STAFF");
      assert.equal(result.user.status, "ACTIVE");
      assert.ok(result.token);
    }
  );
});

test("Existing session of deactivated staff is revoked by authenticate middleware", async () => {
  const token = jwt.sign(
    { userId: "507f1f77bcf86cd799439002", sessionVersion: 0 },
    process.env.JWT_SECRET
  );

  await withStubs(
    User,
    {
      findById: async () => ({
        _id: "507f1f77bcf86cd799439002",
        role: "STAFF",
        status: "INACTIVE",
        sessionVersion: 0,
        toObject() {
          return { ...this };
        },
      }),
    },
    async () => {
      let authError = null;
      await authenticate(
        { headers: { authorization: `Bearer ${token}` } },
        {},
        (err) => {
          authError = err;
        }
      );

      assert.ok(authError instanceof AppError);
      assert.equal(authError.statusCode, 403, "Inactive staff session must be rejected");
    }
  );
});

test("Customer and Admin accounts are unaffected by status checks", async () => {
  const customerDoc = {
    _id: "507f1f77bcf86cd799439003",
    name: "Normal Customer",
    email: "customer@example.com",
    password: bcrypt.hashSync("CustomerPass123!", 4),
    role: "CUSTOMER",
    sessionVersion: 0,
    toObject() {
      return { ...this };
    },
  };

  await withStubs(
    User,
    {
      findOne: () => ({
        select: async () => customerDoc,
      }),
    },
    async () => {
      const result = await loginUser({
        email: "customer@example.com",
        password: "CustomerPass123!",
      });
      assert.equal(result.user.role, "CUSTOMER");
      assert.ok(result.token);
    }
  );
});

test("Safe password reset updates hash, bumps sessionVersion, and never returns password", async () => {
  let savedUser = null;
  const staffDoc = {
    _id: "507f1f77bcf86cd799439001",
    name: "Chef Gordon",
    role: "STAFF",
    password: bcrypt.hashSync("OldPass123!", 4),
    sessionVersion: 1,
    async save() {
      savedUser = this;
    },
    toObject() {
      return { ...this };
    },
  };

  await withStubs(
    User,
    {
      findOne: async () => staffDoc,
      findById: () => ({
        populate: () => ({
          select: async () => ({
            ...staffDoc,
            toObject() {
              return { ...this };
            },
          }),
        }),
      }),
    },
    async () => {
      const result = await staffService.resetStaffPassword(
        "507f1f77bcf86cd799439001",
        "BrandNewPassword123!",
        "BrandNewPassword123!"
      );

      assert.equal(result.password, undefined, "Password must not be returned");
      assert.equal(savedUser.sessionVersion, 2, "Session version must be incremented");
      assert.ok(
        bcrypt.compareSync("BrandNewPassword123!", savedUser.password),
        "Password must be updated with new hash"
      );
    }
  );
});

test("Staff listing returns metrics, safe staff objects, and populates staffId for legacy staff", async () => {
  const legacyStaff = {
    _id: "507f1f77bcf86cd799439001",
    name: "Legacy Staff",
    email: "legacy@smartcanteen.local",
    role: "STAFF",
    status: "ACTIVE",
    staffId: undefined, // Legacy staff without staffId
    toObject() {
      return { ...this };
    },
  };

  let updatedLegacyStaffId = null;

  await withStubs(
    User,
    {
      find: (filter) => {
        if (filter.staffId) {
          return {
            select: () => ({
              lean: async () => [],
            }),
          };
        }
        return {
          populate: () => ({
            select: () => ({
              sort: () => ({
                lean: async () => [{ ...legacyStaff }],
              }),
            }),
          }),
        };
      },
      exists: async () => false,
      countDocuments: async (filter) => {
        if (filter.status === "ACTIVE") return 1;
        if (filter.status === "INACTIVE") return 0;
        return 1;
      },
      updateOne: async (query, update) => {
        updatedLegacyStaffId = update.staffId;
      },
    },
    async () => {
      const result = await staffService.listStaff();

      assert.equal(result.metrics.totalStaff, 1);
      assert.equal(result.metrics.activeStaff, 1);
      assert.equal(result.metrics.inactiveStaff, 0);
      assert.equal(result.staff.length, 1);
      assert.equal(result.staff[0].staffId, "STF-0001", "Legacy staff must be assigned STF-0001");
      assert.equal(updatedLegacyStaffId, "STF-0001");
      assert.equal(result.staff[0].password, undefined, "Password must not be returned in list");
    }
  );
});

test("Staff status toggle to INACTIVE bumps sessionVersion to revoke active sessions", async () => {
  let savedUser = null;
  const staffDoc = {
    _id: "507f1f77bcf86cd799439001",
    name: "Staff Member",
    role: "STAFF",
    status: "ACTIVE",
    sessionVersion: 3,
    async save() {
      savedUser = this;
    },
    toObject() {
      return { ...this };
    },
  };

  await withStubs(
    User,
    {
      findOne: async () => staffDoc,
      findById: () => ({
        populate: () => ({
          select: async () => ({
            ...staffDoc,
            toObject() {
              return { ...this };
            },
          }),
        }),
      }),
    },
    async () => {
      const result = await staffService.updateStaffStatus("507f1f77bcf86cd799439001", "INACTIVE");

      assert.equal(result.status, "INACTIVE");
      assert.equal(savedUser.status, "INACTIVE");
      assert.equal(savedUser.sessionVersion, 4, "Session version must increment upon deactivation");
    }
  );
});

