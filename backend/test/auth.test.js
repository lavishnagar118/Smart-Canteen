const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const User = require("../src/models/User");
const {
  createToken,
  loginWithFirebase,
  loginUser,
  logoutUser,
  registerUser,
  verifyFirebaseCredential,
} = require("../src/services/authService");
const { authenticate, requireRole } = require("../src/middleware/authMiddleware");

const userId = "507f1f77bcf86cd799439011";
const safeUser = {
  _id: userId,
  name: "John Doe",
  email: "john@example.com",
  role: "CUSTOMER",
};

const withUserStubs = async (stubs, callback) => {
  const originalMethods = {
    findOne: User.findOne,
    create: User.create,
    findById: User.findById,
    findByIdAndUpdate: User.findByIdAndUpdate,
  };

  Object.assign(User, stubs);

  try {
    await callback();
  } finally {
    Object.assign(User, originalMethods);
  }
};

const userDocument = (extra = {}) => ({
  ...safeUser,
  password: bcrypt.hashSync("password123", 4),
  ...extra,
  toObject() {
    return { ...this };
  },
});

test("registers a customer with a hashed password and token", async () => {
  let createdData;

  await withUserStubs(
    {
      findOne: async () => null,
      create: async (data) => {
        createdData = data;
        return userDocument(data);
      },
    },
    async () => {
      const result = await registerUser({
        name: " John Doe ",
        email: "JOHN@EXAMPLE.COM",
        password: "password123",
      });

      assert.equal(result.user.email, "john@example.com");
      assert.equal(result.user.role, "CUSTOMER");
      assert.equal(result.user.password, undefined);
      assert.notEqual(createdData.password, "password123");
      assert.equal(await bcrypt.compare("password123", createdData.password), true);
      assert.equal(typeof result.token, "string");
    }
  );
});

test("rejects duplicate registration", async () => {
  await withUserStubs(
    { findOne: async () => userDocument() },
    async () => {
      await assert.rejects(
        registerUser({
          name: "John Doe",
          email: "john@example.com",
          password: "password123",
        }),
        (error) => error.statusCode === 409
      );
    }
  );
});

test("logs in with valid credentials and rejects invalid passwords", async () => {
  await withUserStubs(
    {
      findOne: () => ({
        select: async () => userDocument(),
      }),
    },
    async () => {
      const result = await loginUser({
        email: "JOHN@EXAMPLE.COM",
        password: "password123",
      });

      assert.equal(result.user.email, "john@example.com");
      assert.equal(result.user.password, undefined);

      await assert.rejects(
        loginUser({
          email: "john@example.com",
          password: "wrong-password",
        }),
        (error) => error.statusCode === 401 && error.message === "Invalid email or password"
      );
    }
  );
});

test("rejects invalid email input", async () => {
  await assert.rejects(
    loginUser({ email: "not-an-email", password: "password123" }),
    (error) => error.statusCode === 401
  );
});

test("authenticates valid, invalid, expired, and missing JWTs", async () => {
  await withUserStubs(
    { findById: async () => userDocument() },
    async () => {
      const runMiddleware = (authorization) =>
        new Promise((resolve, reject) => {
          authenticate(
            { headers: { authorization } },
            {},
            (error) => (error ? reject(error) : resolve())
          );
        });

      await runMiddleware(`Bearer ${createToken(userId)}`);
      await assert.rejects(runMiddleware("Bearer invalid-token"), (error) => error.statusCode === 401);
      await assert.rejects(
        runMiddleware(`Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "-1s" })}`),
        (error) => error.statusCode === 401 && error.message.includes("expired")
      );
      await assert.rejects(runMiddleware(undefined), (error) => error.statusCode === 401);
    }
  );
});

test("enforces customer, staff, and admin roles", async () => {
  const runRole = (role, allowedRoles) =>
    new Promise((resolve, reject) => {
      requireRole(...allowedRoles)(
        { user: { role } },
        {},
        (error) => (error ? reject(error) : resolve())
      );
    });

    test("creates one customer for a verified Firebase identity and reuses it", async () => {
      let created;
      const verifier = async () => ({
        uid: "firebase-uid-1",
        email: "john@example.com",
        email_verified: true,
        name: "John Doe",
      });

      await withUserStubs(
        {
          findOne: (filter) => ({
            select: async () => (filter.firebaseUid ? null : created),
          }),
          create: async (data) => {
            created = userDocument({
              ...data,
              _id: userId,
              password: undefined,
              save: async function save() {},
            });
            return created;
          },
        },
        async () => {
          const first = await loginWithFirebase({ idToken: "valid" }, verifier);
          const second = await loginWithFirebase({ idToken: "valid" }, verifier);
          assert.equal(first.user._id, userId);
          assert.equal(second.user._id, userId);
          assert.equal(created.authProvider, "FIREBASE");
          assert.equal(created.role, "CUSTOMER");
        }
      );
    });

    test("links Firebase to an existing email without changing the user identity or role", async () => {
      const existing = userDocument({
        _id: userId,
        role: "ADMIN",
        firebaseUid: undefined,
        password: bcrypt.hashSync("password123", 4),
        save: async function save() {
          this.saved = true;
        },
      });

      await withUserStubs(
        {
          findOne: (filter) => ({
            select: async () => (filter.firebaseUid ? null : existing),
          }),
        },
        async () => {
          const result = await loginWithFirebase(
            { idToken: "valid" },
            async () => ({
              uid: "firebase-admin",
              email: existing.email,
              email_verified: true,
              name: "Different Google Name",
            })
          );
          assert.equal(result.user._id, userId);
          assert.equal(result.user.role, "ADMIN");
          assert.equal(existing.firebaseUid, "firebase-admin");
          assert.equal(existing.saved, true);
          assert.equal(existing.name, "John Doe");
        }
      );
    });

    test("revokes application JWTs on logout", async () => {
      let update;
      await withUserStubs(
        {
          findByIdAndUpdate: async (id, changes) => {
            update = { id, changes };
            return userDocument({ _id: id });
          },
        },
        async () => {
          await logoutUser(userId);
          assert.equal(update.id, userId);
          assert.deepEqual(update.changes, { $inc: { sessionVersion: 1 } });
        }
      );
    });

    test("rejects missing and invalid Firebase credentials", async () => {
      await assert.rejects(
        verifyFirebaseCredential(""),
        (error) => error.statusCode === 400
      );
      await assert.rejects(
        verifyFirebaseCredential("not-a-token", async () => {
          throw new Error("invalid token");
        }),
        (error) => error.statusCode === 401
      );
    });

  await runRole("CUSTOMER", ["CUSTOMER"]);
  await runRole("STAFF", ["STAFF", "ADMIN"]);
  await runRole("ADMIN", ["ADMIN"]);
  await assert.rejects(runRole("CUSTOMER", ["STAFF"]), (error) => error.statusCode === 403);
});

test("reuses an existing Firebase UID without creating a duplicate user", async () => {
  const existing = userDocument({
    _id: userId,
    firebaseUid: "firebase-existing",
    authProvider: "FIREBASE",
    password: undefined,
  });

  await withUserStubs(
    {
      findOne: () => ({
        select: async () => existing,
      }),
      create: async () => {
        throw new Error("duplicate user creation");
      },
    },
    async () => {
      const result = await loginWithFirebase(
        { idToken: "valid" },
        async () => ({
          uid: "firebase-existing",
          email: existing.email,
          email_verified: true,
          name: existing.name,
        })
      );
      assert.equal(result.user._id, userId);
      assert.equal(result.user.authProvider, "FIREBASE");
    }
  );
});

test("rejects unverified, expired, and wrong-project Firebase identities", async () => {
  for (const payload of [
    { uid: "unverified", email: "john@example.com", email_verified: false },
    { uid: "expired", email: "john@example.com", email_verified: true, expired: true },
    { uid: "wrong-project", email: "john@example.com", email_verified: true, wrongProject: true },
  ]) {
    await assert.rejects(
      verifyFirebaseCredential("token", async () => {
        if (payload.expired || payload.wrongProject) throw new Error("invalid Firebase token");
        return payload;
      }),
      (error) => error.statusCode === 401
    );
  }
});
