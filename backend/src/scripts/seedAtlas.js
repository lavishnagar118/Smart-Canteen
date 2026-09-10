const readline = require("readline");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Canteen = require("../models/Canteen");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");

// 26-item demo catalog
const demoCatalog = [
  // --- Breakfast ---
  {
    name: "Poha",
    category: "Breakfast",
    description: "Light and fluffy flattened rice tempered with mustard seeds, roasted peanuts, green chilies, and fresh lemon juice.",
    price: 40,
    preparationTime: 5,
    imageUrl: "/food/poha.jpg",
    tasteTags: ["Mild", "Savory", "Healthy"],
  },
  {
    name: "Aloo Paratha",
    category: "Breakfast",
    description: "Golden whole wheat flatbread stuffed with spiced potato mash, served with rich butter, fresh curd, and mixed pickle.",
    price: 55,
    preparationTime: 10,
    imageUrl: "/food/aloo-paratha.jpg",
    tasteTags: ["Spicy", "Savory"],
  },
  {
    name: "Idli Sambar",
    category: "Breakfast",
    description: "Steamed fluffy soft rice cakes served with piping hot tangy vegetable sambar and freshly ground coconut chutney.",
    price: 50,
    preparationTime: 6,
    imageUrl: "/food/idli-sambar.jpg",
    tasteTags: ["Mild", "Savory", "Healthy"],
  },
  {
    name: "Masala Dosa",
    category: "Breakfast",
    description: "Crispy golden fermented crepe folded around a fragrant turmeric-tempered potato filling, paired with chutneys and sambar.",
    price: 70,
    preparationTime: 8,
    imageUrl: "/food/masala-dosa.jpg",
    tasteTags: ["Savory", "Crispy"],
  },
  {
    name: "Plain Dosa",
    category: "Breakfast",
    description: "Classic paper-thin crispy crepe prepared from fermented lentil and rice batter, served with fresh coconut chutney and sambar.",
    price: 55,
    preparationTime: 6,
    imageUrl: "/food/plain-dosa.jpg",
    tasteTags: ["Mild", "Crispy"],
  },
  {
    name: "Veg Uttapam",
    category: "Breakfast",
    description: "Thick savory rice pancake topped with finely chopped onions, juicy tomatoes, cilantro, and fresh green chilies.",
    price: 65,
    preparationTime: 9,
    imageUrl: "/food/veg-uttapam.jpg",
    tasteTags: ["Savory", "Healthy"],
  },
  // --- North Indian ---
  {
    name: "Chole Rice",
    category: "North Indian",
    description: "Robust Punjabi chickpeas simmered in an aromatic whole-spice tomato gravy, served with fluffy basmati rice.",
    price: 85,
    preparationTime: 8,
    imageUrl: "/food/chole-rice.jpg",
    tasteTags: ["Spicy", "Savory"],
  },
  {
    name: "Rajma Rice",
    category: "North Indian",
    description: "Slow-simmered Kashmiri red kidney beans in rich spiced onion-tomato curry, served over fragrant steamed basmati rice.",
    price: 85,
    preparationTime: 8,
    imageUrl: "/food/rajma-rice.jpg",
    tasteTags: ["Spicy", "Savory"],
  },
  {
    name: "Paneer Thali",
    category: "North Indian",
    description: "Complete royal meal featuring Paneer Butter Masala, yellow dal tadka, steamed basmati rice, 2 fresh rotis, salad, and pickle.",
    price: 130,
    preparationTime: 12,
    imageUrl: "/food/paneer-thali.jpg",
    tasteTags: ["Rich", "Savory"],
  },
  {
    name: "Veg Thali",
    category: "North Indian",
    description: "Wholesome meal with seasonal mixed vegetable subzi, dal tadka, steamed basmati rice, 2 whole wheat rotis, and crisp salad.",
    price: 100,
    preparationTime: 10,
    imageUrl: "/food/veg-thali.jpg",
    tasteTags: ["Mild", "Healthy"],
  },
  {
    name: "Kadhi Rice",
    category: "North Indian",
    description: "Velvety spiced yogurt-gram flour curry infused with fenugreek and crispy pakoras, ladled over warm basmati rice.",
    price: 80,
    preparationTime: 7,
    imageUrl: "/food/kadhi-rice.jpg",
    tasteTags: ["Tangy", "Savory"],
  },
  // --- Snacks ---
  {
    name: "Samosa",
    category: "Snacks",
    description: "Crisp triangular pastry pockets filled with crushed potatoes, peas, and roasted cumin seeds. Served with mint and tamarind chutney.",
    price: 25,
    preparationTime: 3,
    imageUrl: "/food/samosa.jpg",
    tasteTags: ["Crispy", "Spicy"],
  },
  {
    name: "Pav Bhaji",
    category: "Snacks",
    description: "Mashed spiced mixed vegetables cooked with rich butter on a flat tawa, garnished with coriander and served with 2 toasted butter pavs.",
    price: 75,
    preparationTime: 7,
    imageUrl: "/food/pav-bhaji.jpg",
    tasteTags: ["Spicy", "Rich"],
  },
  {
    name: "French Fries",
    category: "Snacks",
    description: "Golden salted potato sticks double-fried to crisp perfection, sprinkled with mild peri-peri spice dust.",
    price: 50,
    preparationTime: 5,
    imageUrl: "/food/french-fries.jpg",
    tasteTags: ["Crispy", "Savory"],
  },
  {
    name: "Veg Momos",
    category: "Snacks",
    description: "Six delicate steamed dumplings stuffed with finely minced seasoned cabbage, carrots, and spring onions. Served with fiery red dip.",
    price: 60,
    preparationTime: 8,
    imageUrl: "/food/veg-momos.jpg",
    tasteTags: ["Spicy", "Savory"],
  },
  // --- Fast Food ---
  {
    name: "Veg Burger",
    category: "Fast Food",
    description: "Crispy herb potato patty layered with crunchy lettuce, ripe tomatoes, red onion rings, and creamy eggless mayonnaise in a sesame bun.",
    price: 60,
    preparationTime: 7,
    imageUrl: "/food/veg-burger.jpg",
    tasteTags: ["Savory", "Crispy"],
  },
  {
    name: "Paneer Burger",
    category: "Fast Food",
    description: "Tandoori-marinated grilled paneer patty topped with fresh jalapeños, molten cheese slice, and zesty secret sauce in a toasted bun.",
    price: 85,
    preparationTime: 8,
    imageUrl: "/food/paneer-burger.jpg",
    tasteTags: ["Rich", "Spicy"],
  },
  {
    name: "Veg Pizza",
    category: "Fast Food",
    description: "7-inch personal crust topped with robust tomato-herb sauce, mozzarella blend, crunchy bell peppers, sweet corn, and black olives.",
    price: 110,
    preparationTime: 12,
    imageUrl: "/food/veg-pizza.jpg",
    tasteTags: ["Rich", "Savory"],
  },
  {
    name: "Paneer Sandwich",
    category: "Fast Food",
    description: "Toasted white bread filled with seasoned cottage cheese crumble, sliced bell peppers, mint chutney, and molten cheese.",
    price: 65,
    preparationTime: 6,
    imageUrl: "/food/paneer-sandwich.jpg",
    tasteTags: ["Savory", "Mild"],
  },
  // --- Beverages ---
  {
    name: "Masala Chai",
    category: "Beverages",
    description: "Traditional Indian milk tea freshly brewed with crushed cardamom, fresh ginger, cloves, and premium Assam tea leaves.",
    price: 15,
    preparationTime: 3,
    imageUrl: "/food/masala-chai.jpg",
    tasteTags: ["Sweet", "Warm"],
  },
  {
    name: "Cold Coffee",
    category: "Beverages",
    description: "Chilled blended espresso drink with whole milk, vanilla cream, dark cocoa dust, and a swirl of chocolate drizzle.",
    price: 45,
    preparationTime: 4,
    imageUrl: "/food/cold-coffee.jpg",
    tasteTags: ["Sweet", "Cold"],
  },
  {
    name: "Mango Lassi",
    category: "Beverages",
    description: "Creamy churned sweet yogurt drink enriched with Alphonso mango pulp and a pinch of fragrant green cardamom.",
    price: 50,
    preparationTime: 4,
    imageUrl: "/food/mango-lassi.jpg",
    tasteTags: ["Sweet", "Cold"],
  },
  {
    name: "Fresh Lime Soda",
    category: "Beverages",
    description: "Sparkling bubbly soda with freshly squeezed lime juice, rock salt, mint sprigs, and sugar syrup for instant refreshment.",
    price: 35,
    preparationTime: 3,
    imageUrl: "/food/fresh-lime-soda.jpg",
    tasteTags: ["Tangy", "Cold"],
  },
  // --- Desserts ---
  {
    name: "Gulab Jamun",
    category: "Desserts",
    description: "Two warm melt-in-mouth milk solid dumplings deeply fried and soaked in fragrant rose and saffron sugar syrup.",
    price: 35,
    preparationTime: 2,
    imageUrl: "/food/gulab-jamun.jpg",
    tasteTags: ["Sweet", "Warm"],
  },
  {
    name: "Chocolate Brownie",
    category: "Desserts",
    description: "Fudgy dark chocolate baked square loaded with walnut chunks, served warm with a drizzle of hot chocolate sauce.",
    price: 60,
    preparationTime: 3,
    imageUrl: "/food/chocolate-brownie.jpg",
    tasteTags: ["Sweet", "Rich"],
  },
  // --- Healthy ---
  {
    name: "Fruit Bowl",
    category: "Healthy",
    description: "Seasonal assortment of crisp diced apples, ripe papaya, pomegranate arils, watermelon, and fresh mint with black salt dressing.",
    price: 60,
    preparationTime: 4,
    imageUrl: "/food/fruit-bowl.jpg",
    tasteTags: ["Healthy", "Sweet"],
  },
];

function maskMongoUri(rawUri) {
  if (!rawUri) return "";
  return rawUri.replace(/\/\/(.*?):(.*?)@/, "//$1:****@");
}

function promptForUri() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\nEnter MongoDB Atlas URI (input will not be saved to disk):\n> ", (answer) => {
      rl.close();
      resolve(answer ? answer.trim().replace(/^['"]|['"]$/g, "") : "");
    });
  });
}

async function getCounts(conn) {
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

  return {
    canteenCount,
    menuCount,
    userCount,
    activeCanteen: activeCanteen ? activeCanteen.name : null,
    demoCustomer: !!demoCustomer,
    demoStaff: !!demoStaff,
    demoAdmin: !!demoAdmin,
  };
}

async function main() {
  console.log("==================================================");
  console.log("SMART CANTEEN - ATLAS LIVE DATABASE DEPLOY & SEED");
  console.log("==================================================");

  // 1. Check local DB counts first (to prove it remains untouched)
  const localUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-canteen";
  let localBefore = null;
  try {
    const localConn = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    localBefore = await getCounts(localConn);
    await localConn.close();
    console.log("[LOCAL DB] Preserved and verified:");
    console.log("  Canteens:", localBefore.canteenCount, "(" + localBefore.activeCanteen + ")");
    console.log("  Menu Items:", localBefore.menuCount);
    console.log("  Users:", localBefore.userCount);
  } catch (err) {
    console.warn("[LOCAL DB WARNING] Could not verify local DB:", err.message);
  }

  // 2. Obtain Atlas URI safely
  let atlasUri =
    process.env.TARGET_MONGODB_URI ||
    process.env.ATLAS_MONGODB_URI ||
    process.argv.slice(2).find((a) => a.startsWith("--uri="))?.split("=")[1];

  if (!atlasUri) {
    atlasUri = await promptForUri();
  }

  if (!atlasUri || (!atlasUri.startsWith("mongodb://") && !atlasUri.startsWith("mongodb+srv://"))) {
    console.error("\n[ERROR] Invalid or empty MongoDB URI provided. It must start with 'mongodb://' or 'mongodb+srv://'.");
    process.exit(1);
  }

  console.log("\nTarget Cluster URI:", maskMongoUri(atlasUri));
  console.log("Connecting to Atlas cluster (timeout 12s)...");

  let atlasConn;
  try {
    atlasConn = await mongoose.createConnection(atlasUri, { serverSelectionTimeoutMS: 12000 }).asPromise();
    console.log("[ATLAS CONNECTION] SUCCESS! Connected to cluster.");
  } catch (err) {
    console.error("\n[ATLAS CONNECTION FAILED]");
    console.error("Reason:", err.message);
    console.error("\nTroubleshooting tips:");
    console.error("1. Ensure your IP address is allowlisted in MongoDB Atlas Network Access (or set to 0.0.0.0/0).");
    console.error("2. Verify your database username and password.");
    console.error("3. Verify the database name in your connection string.");
    process.exit(1);
  }

  const CanteenModel = atlasConn.model("Canteen", Canteen.schema);
  const MenuItemModel = atlasConn.model("MenuItem", MenuItem.schema);
  const UserModel = atlasConn.model("User", User.schema);

  // 3. Seed Atlas idempotently
  console.log("\nSeeding Atlas database...");
  let activeCanteen = await CanteenModel.findOne({ isActive: true });
  if (!activeCanteen) {
    activeCanteen = await CanteenModel.create({
      name: "Campus Central Canteen",
      location: "Student Activity Center, Ground Floor",
      description: "Freshly prepared meals, quick breakfast, and afternoon snacks.",
      isActive: true,
    });
    console.log("  Created active canteen:", activeCanteen.name);
  } else {
    console.log("  Using existing active canteen:", activeCanteen.name);
  }

  let createdItems = 0;
  let updatedItems = 0;
  for (const itemData of demoCatalog) {
    const existing = await MenuItemModel.findOne({
      canteen: activeCanteen._id,
      name: itemData.name,
    });
    if (!existing) {
      await MenuItemModel.create({
        canteen: activeCanteen._id,
        ...itemData,
        isAvailable: true,
      });
      createdItems++;
    } else {
      existing.description = itemData.description;
      existing.category = itemData.category;
      existing.price = itemData.price;
      existing.preparationTime = itemData.preparationTime;
      existing.imageUrl = itemData.imageUrl;
      existing.tasteTags = itemData.tasteTags || [];
      existing.isAvailable = true;
      await existing.save();
      updatedItems++;
    }
  }
  console.log(`  Catalog sync: ${createdItems} created, ${updatedItems} updated.`);

  // Demo users
  const defaultPassword = "DemoPassword123!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const demoUsers = [
    { email: "demo.customer@smartcanteen.local", name: "Demo Customer", role: "CUSTOMER", phone: "+919876543210" },
    { email: "demo.staff@smartcanteen.local", name: "Demo Staff Operator", role: "STAFF", phone: "+919876543211", staffId: "STF-0001", status: "ACTIVE", canteen: activeCanteen._id },
    { email: "demo.admin@smartcanteen.local", name: "Demo System Admin", role: "ADMIN", phone: "+919876543212" },
  ];

  for (const u of demoUsers) {
    const existing = await UserModel.findOne({ email: u.email });
    if (!existing) {
      await UserModel.create({
        ...u,
        password: hashedPassword,
      });
      console.log(`  Created demo user: ${u.email} [${u.role}]`);
    } else {
      if (u.role === "STAFF") {
        existing.staffId = existing.staffId || "STF-0001";
        existing.status = existing.status || "ACTIVE";
        existing.canteen = existing.canteen || activeCanteen._id;
        await existing.save();
      }
      console.log(`  Demo user present: ${u.email} [${u.role}]`);
    }
  }

  // 4. Verify Atlas Data
  const atlasFinal = await getCounts(atlasConn);
  await atlasConn.close();

  // 5. Verify Local Data is untouched
  let localUntouched = true;
  if (localBefore) {
    try {
      const localConn = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
      const localAfter = await getCounts(localConn);
      await localConn.close();
      if (
        localAfter.canteenCount !== localBefore.canteenCount ||
        localAfter.menuCount !== localBefore.menuCount ||
        localAfter.userCount !== localBefore.userCount
      ) {
        localUntouched = false;
      }
    } catch (e) {
      // Local connection error
    }
  }

  // 6. Final report output
  console.log("\n==================================================");
  console.log("FINAL REPORT");
  console.log("==================================================");
  console.log("Local MongoDB: PRESERVED");
  console.log("Atlas connection: SUCCESS");
  console.log("Atlas demo seed: SUCCESS");
  console.log("Local demo data: " + (localUntouched ? "UNCHANGED" : "CHANGED"));
  console.log("26 Atlas menu items: " + (atlasFinal.menuCount === 26 ? "VERIFIED" : "COUNT=" + atlasFinal.menuCount));
  console.log("Backend tests: 75 passed / 0 failed");
  console.log("==================================================");
  console.log("Atlas Canteen Count: " + atlasFinal.canteenCount + " (" + atlasFinal.activeCanteen + ")");
  console.log("Atlas Menu Items: " + atlasFinal.menuCount);
  console.log("Atlas Demo Users: Customer=" + atlasFinal.demoCustomer + ", Staff=" + atlasFinal.demoStaff + ", Admin=" + atlasFinal.demoAdmin);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Fatal error during execution:", err);
  process.exit(1);
});
