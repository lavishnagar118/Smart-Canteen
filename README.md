# Smart Canteen - Intelligent Canteen & Kitchen Management System

Smart Canteen is a modern, real-time canteen ordering, kitchen display system (KDS), and intelligent operations management platform built on the MERN stack and powered by a local Ollama AI assistant layer.

It streamlines busy campus and corporate food courts with contactless digital ordering, live parallel kitchen queue tracking, automated real-time status updates via WebSockets, and three role-tailored AI assistants for customers, kitchen staff, and canteen administrators.

---

## System Architecture

The system operates across three distinct user roles, backed by real-time WebSocket events and a local Ollama AI core:

```
                                  [ Smart Canteen Platform ]
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
   [ Customer ]                           [ Staff ]                            [ Admin ]
  • QR Code / Direct URL                 • Kitchen Display (KDS)              • Shift Analytics
  • Realistic Catalog & Taste Filters    • Realtime Queue Progression         • Concession & QR Generator
  • Cart & Server Pricing                • Menu Availability Toggles          • Staff Accounts & Access
  • Razorpay Test Checkout               • AI Kitchen Assistant               • AI Analytics Assistant
  • Live Socket.IO Tracking                   │                                    │
  • Customer AI Assistant                     │                                    │
         │                                    │                                    │
         └──────────────────┬─────────────────┴──────────────────┬─────────────────┘
                            │                                    │
                            ▼                                    ▼
                 [ Core Express API + Mongo ]          [ Local Ollama Engine ]
                 • Dual Auth (Firebase + JWT)          • Endpoint: http://localhost:11434
                 • FIFO Parallel Queue Scheduler       • Model: qwen2.5:3b
                 • Socket.IO Event Broadcasting        • Grounded Context Builders
                 • Webhook Idempotency (Razorpay)      • Strict JSON Output Validation
```

---

## Core Experiences & Roles

### 1. Customer Experience
- **QR Discovery & Entry**: Scan concession QR codes or browse directly to `/canteen/:canteenId`.
- **Realistic Menu Catalog**: 26 authentic Indian canteen dishes across 8 categories (`Breakfast`, `North Indian`, `South Indian`, `Snacks`, `Fast Food`, `Beverages`, `Desserts`, `Healthy`) with high-resolution photography.
- **Taste Filtering**: Interactive "Filter by taste" drawer supporting `All tastes`, `Spicy`, `Mild`, `Sweet`, `Savory`, and `Healthy`.
- **Server-Verified Checkout**: Cart persists in browser `localStorage`. Totals and prices are strictly computed server-side to prevent tampering.
- **Payment & Live Queue**: Seamless Razorpay checkout with webhook-verified order confirmation and live Socket.IO progress tracking.
- **Customer AI Assistant**: Floating natural-language concierge for food discovery, budget meal suggestions (e.g. *"₹50 mein pet bharne wala food"*), dietary queries, and 1-click cart additions.

### 2. Kitchen Staff (KDS)
- **Live Ticket Pipeline**: Operational state machine for processing orders:
  $$\text{CONFIRMED} \xrightarrow{\text{accept}} \text{ACCEPTED} \xrightarrow{\text{start}} \text{PREPARING} \xrightarrow{\text{ready}} \text{READY} \xrightarrow{\text{complete}} \text{COMPLETED}$$
- **Kitchen Queue (`/admin/queue`)**: Real-time view of active tickets, estimated wait times, and customer handoffs.
- **Menu Availability (`/admin/menu`)**: Instantly toggle dishes in/out of stock.
- **AI Kitchen Assistant**: Floating operational assistant powered by real-time queue metrics for bottleneck identification, delay warnings, and prep prioritization.

### 3. Administrator
- **Business Intelligence (`/admin/analytics`)**: Demand distribution by hour, daily revenue trends, top-selling dishes, and peak-hour analysis across selectable date ranges (Today, 7 Days, 30 Days, Custom).
- **Concession Management (`/admin/canteens`)**: Manage physical canteen locations and dynamically generate downloadable high-resolution customer ordering QR codes.
- **Staff Access Control (`/admin/staff`)**: Provision kitchen staff accounts with auto-generated Staff IDs, status toggles (`ACTIVE`/`INACTIVE`), session revocation (`sessionVersion`), and secure credential resets.
- **AI Analytics Assistant**: Query analytics in plain language (e.g. revenue summaries, peak congestion hours) grounded in backend aggregation metrics.

---

## AI Assistant Layer (Local Ollama)

The platform includes a local AI layer designed to run without external cloud dependencies, API keys, or data leaks.

- **Runtime**: Local Ollama daemon running at `http://localhost:11434`
- **Model**: `qwen2.5:3b`
- **Security & Grounding**:
  - All AI queries pass through backend role authorization (`CUSTOMER`, `STAFF`, `ADMIN`).
  - Inputs are validated for length and sanitized against prompt injections.
  - Prompts are grounded with structured, trusted server context (active catalog, live queue metrics, or aggregated analytics).
  - Model outputs pass through a schema-enforcing output validator that guarantees valid menu item IDs, database-authoritative pricing, and safe fallbacks when Ollama is offline.

---

## Tech Stack

- **Frontend**: React 18, Vite 6, React Router 7, Tailwind CSS, Lucide Icons, Socket.IO Client, Firebase Web SDK
- **Backend**: Node.js, Express 4, MongoDB, Mongoose 8, Socket.IO 4, Firebase Admin SDK, Razorpay Node SDK
- **AI Engine**: Local Ollama (`qwen2.5:3b`)
- **Authentication**: Dual-engine architecture (Firebase Google OAuth + local MongoDB bcrypt fallback), application JWTs, role-based route middleware
- **Payments**: Razorpay Checkout with HMAC SHA256 webhook signature verification
- **Testing**: Node.js built-in test runner (`node --test`), Puppeteer Core for automated browser QA

---

## Project Structure

```
Smart-Canteen/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Firebase Admin, and Razorpay setup
│   │   ├── controllers/     # Route controllers (auth, menu, orders, payments, queue, analytics, ai)
│   │   ├── middleware/      # JWT auth, requireRole, and status checks
│   │   ├── models/          # Mongoose schemas (Canteen, MenuItem, Order, Payment, QueueEntry, User)
│   │   ├── realtime/        # Socket.IO rooms and event broadcasting
│   │   ├── routes/          # Express route declarations
│   │   ├── scripts/         # Idempotent demo database seed script (seedDemo.js)
│   │   ├── services/        # Core business logic and AI service layer (Ollama, context, validation)
│   │   └── utils/           # Shared helpers and custom AppError
│   ├── test/                # Unit and integration test suites (75 passing tests)
│   ├── .env.example         # Backend environment variable template
│   ├── package.json
│   └── server.js            # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI, FoodCard, and AI chat components
│   │   ├── context/         # AuthContext and CartContext (localStorage synced)
│   │   ├── layouts/         # DefaultLayout and AdminLayout
│   │   ├── pages/           # Customer pages, menu, cart, checkout, and admin subpages
│   │   ├── routes/          # ProtectedRoute and RoleProtectedRoute
│   │   └── services/        # Axios API client, Socket.IO client, AI API endpoints
│   ├── public/              # Static assets and local food photography (.jpg)
│   ├── .env.example         # Frontend environment variable template
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

1. **Node.js**: v18.0.0 or later (v20+ recommended)
2. **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` or a MongoDB Atlas connection URI
3. **Ollama**: Installed and running locally:
   ```bash
   ollama run qwen2.5:3b
   ```

---

### Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your local MongoDB URI, JWT secret, and optional credentials (see [Environment Variables](#environment-variables)).

4. Seed the demo database:
   ```bash
   npm run seed
   ```
   This idempotently creates the demo canteen, full 26-dish catalog with realistic photography and taste tags, and presentation user accounts.

5. Start the backend server:
   ```bash
   npm start
   # or for development:
   npm run dev
   ```
   Backend runs at `http://localhost:5000`.

---

### Frontend Setup

1. Open a second terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure `VITE_API_BASE_URL` points to `http://localhost:5000/api`.

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   Application runs at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Express listening port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/smart-canteen` |
| `JWT_SECRET` | Secret key used to sign application JWTs | Random 32+ character string |
| `JWT_EXPIRES_IN` | Token lifespan | `1d` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | `your_project_id` |
| `FIREBASE_CLIENT_EMAIL`| Firebase Admin service account email | Service account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin private key | `-----BEGIN PRIVATE KEY-----\n...` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID (Test or Live) | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Secret string |
| `RAZORPAY_WEBHOOK_SECRET`| Secret used to verify Razorpay webhooks | Webhook secret |
| `KITCHEN_STAFF_COUNT` | Active parallel preparation stations | `2` |
| `ANALYTICS_TIMEZONE` | Timezone for analytics aggregation | `Asia/Kolkata` |
| `OLLAMA_HOST` | Local Ollama endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model identifier | `qwen2.5:3b` |

### Frontend (`frontend/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API base endpoint | `http://localhost:5000/api` |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web Auth Domain | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web Project ID | `<project-id>` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Numeric ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | App ID string |

---

## Demo Accounts

Running `npm run seed` in `backend` provides default presentation accounts:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Customer** | `demo.customer@smartcanteen.local` | `DemoPassword123!` | Menu browsing, taste filters, cart, Razorpay checkout, live tracking, Customer AI |
| **Staff** | `demo.staff@smartcanteen.local` | `DemoPassword123!` | Operational orders KDS, kitchen live queue, catalog toggling, Kitchen AI |
| **Admin** | `demo.admin@smartcanteen.local` | `DemoPassword123!` | Full operations, Canteens (QR generator), Staff management, Analytics, Analytics AI |

---

## Testing & Quality Assurance

### Backend Unit & Integration Tests (75 tests)
```bash
cd backend
npm test
```
Validates authentication, role isolation, customer order pricing, payment verification idempotency, FIFO parallel queue scheduling, multi-canteen isolation, staff lifecycle management, taste filtering, and AI guardrails.

### Frontend Production Build
```bash
cd frontend
npm run build
```
Validates full TypeScript/JSX compilation, asset bundling, and minification.
