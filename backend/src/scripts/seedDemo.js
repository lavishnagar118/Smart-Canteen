const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Canteen = require("../models/Canteen");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");

function maskMongoUri(rawUri) {
  if (!rawUri) return "";
  return rawUri.replace(/\/\/(.*?):(.*?)@/, "//$1:****@");
}

async function seedDemo(customUri) {
  const args = process.argv.slice(2);
  const cliUriArg = args.find((a) => a.startsWith("--uri="))?.split("=")[1];
  const uri =
    customUri ||
    cliUriArg ||
    process.env.TARGET_MONGODB_URI ||
    process.env.ATLAS_MONGODB_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/smart-canteen";

  console.log("Connecting to MongoDB:", maskMongoUri(uri));
  await mongoose.connect(uri);

  try {
    // 1. Ensure at least one active canteen
    let canteen = await Canteen.findOne({ isActive: true });
    if (!canteen) {
      canteen = await Canteen.create({
        name: "Campus Central Canteen",
        location: "Student Activity Center, Ground Floor",
        description: "Freshly prepared meals, quick breakfast, and afternoon snacks.",
        isActive: true,
      });
      console.log("Created demo canteen:", canteen.name, `(${canteen._id})`);
    } else {
      console.log("Using existing active canteen:", canteen.name, `(${canteen._id})`);
    }

    // 2. Comprehensive 26-item demo catalog across 8 categories
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

      // --- North Indian ---
      {
        name: "Paneer Thali",
        category: "North Indian",
        description: "Paneer butter masala served with 2 rotis, jeera rice, dal tadka, gulab jamun, and cucumber salad.",
        price: 120,
        preparationTime: 15,
        imageUrl: "/food/paneer-thali.jpg",
        tasteTags: ["Mild", "Savory"],
      },
      {
        name: "Veg Thali",
        category: "North Indian",
        description: "Complete homestyle platter featuring seasonal sabzi, yellow dal tadka, 2 whole wheat rotis, steamed rice, and crispy papad.",
        price: 90,
        preparationTime: 12,
        imageUrl: "/food/veg-thali.jpg",
        tasteTags: ["Savory", "Healthy"],
      },
      {
        name: "Rajma Rice",
        category: "North Indian",
        description: "Melt-in-mouth red kidney beans simmered in Punjabi onion-tomato gravy, served over steaming basmati rice.",
        price: 75,
        preparationTime: 8,
        imageUrl: "/food/rajma-rice.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "Chole Rice",
        category: "North Indian",
        description: "Authentic Amritsari spiced chickpeas curry served with fragrant basmati rice and pickled red onions.",
        price: 75,
        preparationTime: 8,
        imageUrl: "/food/chole-rice.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "Kadhi Rice",
        category: "North Indian",
        description: "Tangy spiced yogurt and gram-flour curry with golden crispy onion pakoras, served atop steamed basmati rice.",
        price: 65,
        preparationTime: 8,
        imageUrl: "/food/kadhi-rice.jpg",
        tasteTags: ["Mild", "Savory"],
      },

      // --- South Indian ---
      {
        name: "Masala Dosa",
        category: "South Indian",
        description: "Crispy fermented rice-lentil crepe filled with spiced mashed potato bhaji, served with sambar and coconut chutney.",
        price: 70,
        preparationTime: 10,
        imageUrl: "/food/masala-dosa.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "Plain Dosa",
        category: "South Indian",
        description: "Thin, crispy golden crepe cooked with pure ghee, served hot with aromatic vegetable sambar and fresh coconut chutney.",
        price: 55,
        preparationTime: 8,
        imageUrl: "/food/plain-dosa.jpg",
        tasteTags: ["Mild", "Savory"],
      },
      {
        name: "Veg Uttapam",
        category: "South Indian",
        description: "Thick savory rice pancake topped with caramelized onions, diced tomatoes, green chilies, and fresh coriander.",
        price: 65,
        preparationTime: 10,
        imageUrl: "/food/veg-uttapam.jpg",
        tasteTags: ["Mild", "Savory"],
      },

      // --- Snacks ---
      {
        name: "Samosa",
        category: "Snacks",
        description: "Crisp golden triangular pastry loaded with spiced potatoes, green peas, and cashews, served with mint and tamarind chutneys.",
        price: 25,
        preparationTime: 4,
        imageUrl: "/food/samosa.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "Paneer Sandwich",
        category: "Snacks",
        description: "Toasted multigrain bread layered with spiced cottage cheese cubes, crisp capsicum, onion, and mint mayo spread.",
        price: 60,
        preparationTime: 8,
        imageUrl: "/food/paneer-sandwich.jpg",
        tasteTags: ["Mild", "Savory"],
      },
      {
        name: "Veg Momos",
        category: "Snacks",
        description: "Steamed Himalayan dumplings packed with crunchy garden veggies, served with fiery red garlic-chili dip.",
        price: 70,
        preparationTime: 10,
        imageUrl: "/food/veg-momos.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "Pav Bhaji",
        category: "Snacks",
        description: "Buttery mashed spiced vegetables cooked with aromatic pav bhaji masala, served with 2 warm butter-toasted pavs.",
        price: 80,
        preparationTime: 10,
        imageUrl: "/food/pav-bhaji.jpg",
        tasteTags: ["Spicy", "Savory"],
      },

      // --- Fast Food ---
      {
        name: "Veg Burger",
        category: "Fast Food",
        description: "Crispy seasoned vegetable patty layered with fresh lettuce, juicy tomatoes, melted cheese, and signature sauce in a toasted bun.",
        price: 60,
        preparationTime: 8,
        imageUrl: "/food/veg-burger.jpg",
        tasteTags: ["Savory"],
      },
      {
        name: "Paneer Burger",
        category: "Fast Food",
        description: "Thick grilled paneer steak coated in tandoori spices, topped with sliced onions, lettuce, and creamy sauce.",
        price: 85,
        preparationTime: 10,
        imageUrl: "/food/paneer-burger.jpg",
        tasteTags: ["Spicy", "Savory"],
      },
      {
        name: "French Fries",
        category: "Fast Food",
        description: "Classic salted crispy golden potato fries served with zesty tomato ketchup.",
        price: 50,
        preparationTime: 5,
        imageUrl: "/food/french-fries.jpg",
        tasteTags: ["Savory"],
      },
      {
        name: "Veg Pizza",
        category: "Fast Food",
        description: "Hand-stretched personal 7-inch crust loaded with mozzarella cheese, capsicum, sweet corn, black olives, and oregano.",
        price: 130,
        preparationTime: 15,
        imageUrl: "/food/veg-pizza.jpg",
        tasteTags: ["Savory"],
      },

      // --- Beverages ---
      {
        name: "Masala Chai",
        category: "Beverages",
        description: "Strong freshly brewed Assam tea simmered with fresh ginger, crushed green cardamom, and aromatic Indian spices.",
        price: 20,
        preparationTime: 3,
        imageUrl: "/food/masala-chai.jpg",
        tasteTags: ["Sweet", "Spicy"],
      },
      {
        name: "Cold Coffee",
        category: "Beverages",
        description: "Thick blended iced coffee made with rich espresso, full cream milk, vanilla ice cream, and dark chocolate swirl.",
        price: 50,
        preparationTime: 4,
        imageUrl: "/food/cold-coffee.jpg",
        tasteTags: ["Sweet"],
      },
      {
        name: "Mango Lassi",
        category: "Beverages",
        description: "Traditional creamy Punjabi sweet yogurt cooler blended with ripe Alphonso mango pulp and saffron essence.",
        price: 60,
        preparationTime: 4,
        imageUrl: "/food/mango-lassi.jpg",
        tasteTags: ["Sweet"],
      },
      {
        name: "Fresh Lime Soda",
        category: "Beverages",
        description: "Chilled sparkling soda with freshly squeezed lime juice, rock salt, sugar, and crushed mint leaves.",
        price: 35,
        preparationTime: 3,
        imageUrl: "/food/fresh-lime-soda.jpg",
        tasteTags: ["Sweet", "Mild"],
      },

      // --- Desserts ---
      {
        name: "Gulab Jamun",
        category: "Desserts",
        description: "2 warm, soft milk-solid dumplings steeped in fragrant saffron and rose-infused sugar syrup.",
        price: 40,
        preparationTime: 3,
        imageUrl: "/food/gulab-jamun.jpg",
        tasteTags: ["Sweet"],
      },
      {
        name: "Chocolate Brownie",
        category: "Desserts",
        description: "Decadent warm fudge brownie packed with roasted walnut chunks, finished with dark chocolate drizzle.",
        price: 65,
        preparationTime: 4,
        imageUrl: "/food/chocolate-brownie.jpg",
        tasteTags: ["Sweet"],
      },

      // --- Healthy ---
      {
        name: "Fruit Bowl",
        category: "Healthy",
        description: "Daily mix of fresh cut seasonal fruits including watermelon, papaya, kiwi, apples, and pomegranate with chaat masala.",
        price: 70,
        preparationTime: 5,
        imageUrl: "/food/fruit-bowl.jpg",
        tasteTags: ["Sweet", "Healthy"],
      },
    ];

    // Multi-canteen support: ensure catalog is seeded for all active canteens
    const activeCanteens = await Canteen.find({ isActive: true });
    for (const activeCanteen of activeCanteens) {
      console.log(`\nSyncing catalog for canteen: ${activeCanteen.name} (${activeCanteen._id})...`);
      let createdCount = 0;
      let updatedCount = 0;

      for (const itemData of demoCatalog) {
        const existing = await MenuItem.findOne({ name: itemData.name, canteen: activeCanteen._id });
        if (!existing) {
          await MenuItem.create({
            ...itemData,
            canteen: activeCanteen._id,
            isAvailable: true,
          });
          createdCount++;
        } else {
          existing.description = itemData.description;
          existing.category = itemData.category;
          existing.price = itemData.price;
          existing.preparationTime = itemData.preparationTime;
          existing.imageUrl = itemData.imageUrl;
          existing.tasteTags = itemData.tasteTags || [];
          existing.isAvailable = true;
          await existing.save();
          updatedCount++;
        }
      }
      console.log(`Catalog sync complete: ${createdCount} created, ${updatedCount} updated.`);
    }

    // 3. Ensure demo presentation users exist
    const defaultPassword = "DemoPassword123!";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const demoUsers = [
      { email: "demo.customer@smartcanteen.local", name: "Demo Customer", role: "CUSTOMER", phone: "+919876543210" },
      { email: "demo.staff@smartcanteen.local", name: "Demo Staff Operator", role: "STAFF", phone: "+919876543211", staffId: "STF-0001", status: "ACTIVE", canteen: canteen._id },
      { email: "demo.admin@smartcanteen.local", name: "Demo System Admin", role: "ADMIN", phone: "+919876543212" },
    ];

    for (const u of demoUsers) {
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        await User.create({
          ...u,
          password: hashedPassword,
        });
        console.log(`Created demo user: ${u.email} [${u.role}] (Password: ${defaultPassword})`);
      } else {
        if (u.role === "STAFF") {
          existing.staffId = existing.staffId || "STF-0001";
          existing.status = existing.status || "ACTIVE";
          existing.canteen = existing.canteen || canteen._id;
          await existing.save();
        }
        console.log(`Demo user already present: ${existing.email} [${existing.role}]`);
      }
    }

    console.log("\nDemo seed completed successfully!");
  } catch (error) {
    console.error("Demo seed error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedDemo();
}

module.exports = seedDemo;
