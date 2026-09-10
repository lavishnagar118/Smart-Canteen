const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Canteen = require("../models/Canteen");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");

function maskMongoUri(rawUri) {
  if (!rawUri) return "";
  return rawUri.replace(/\/\/(.*?):(.*?)@/, "//$1:****@");
}

async function inspect(targetUri, label = "Target DB") {
  const uri =
    targetUri ||
    process.env.TARGET_MONGODB_URI ||
    process.env.ATLAS_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/smart-canteen";

  console.log("\n=== Verification: " + label + " ===");
  console.log("URI:", maskMongoUri(uri));

  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
    const CanteenModel = conn.model("Canteen", Canteen.schema);
    const MenuItemModel = conn.model("MenuItem", MenuItem.schema);
    const UserModel = conn.model("User", User.schema);

    const canteenCount = await CanteenModel.countDocuments();
    const menuCount = await MenuItemModel.countDocuments();
    const userCount = await UserModel.countDocuments();
    const activeCanteen = await CanteenModel.findOne({ isActive: true });
    const demoCustomer = await UserModel.findOne({ email: "demo.customer@smartcanteen.local" });
    const demoStaff = await UserModel.findOne({ email: "demo.staff@smartcanteen.local" });
    const demoAdmin = await UserModel.findOne({ email: "demo.admin@smartcanteen.local" });

    console.log("Status: CONNECTED");
    console.log("Canteens: " + canteenCount + " (" + (activeCanteen ? activeCanteen.name : "None active") + ")");
    console.log("Menu Items: " + menuCount);
    console.log("Total Users: " + userCount);
    console.log("Demo Customer: " + (demoCustomer ? "VERIFIED (" + demoCustomer.email + ")" : "MISSING"));
    console.log("Demo Staff: " + (demoStaff ? "VERIFIED (" + demoStaff.email + ")" : "MISSING"));
    console.log("Demo Admin: " + (demoAdmin ? "VERIFIED (" + demoAdmin.email + ")" : "MISSING"));

    await conn.close();
    return {
      connected: true,
      canteenCount,
      menuCount,
      userCount,
      activeCanteen: activeCanteen ? activeCanteen.name : null,
      demoUsers: {
        customer: !!demoCustomer,
        staff: !!demoStaff,
        admin: !!demoAdmin
      }
    };
  } catch (err) {
    console.error("Status: CONNECTION FAILED -", err.message);
    return { connected: false, error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cliUriArg = args.find((a) => a.startsWith("--uri="))?.split("=")[1];
  const customTarget = cliUriArg || process.env.TARGET_MONGODB_URI || process.env.ATLAS_MONGODB_URI;

  // 1. Inspect Local DB
  const localUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-canteen";
  await inspect(localUri, "Local MongoDB");

  // 2. Inspect Target DB if provided
  if (customTarget) {
    await inspect(customTarget, "Atlas / Target MongoDB");
  } else {
    console.log("\n[INFO] No separate TARGET_MONGODB_URI, ATLAS_MONGODB_URI, or --uri specified.");
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error("Fatal error during inspection:", err);
    process.exit(1);
  });
}

module.exports = { inspect, maskMongoUri };
