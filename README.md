# Krishi-Line WhatsApp Bot (Backend MVP)

Krishi-Line is an onion procurement assistance bot designed for farmers in Nashik, Maharashtra.
This service provides the core conversation engine, persistent MongoDB storage, and REST API endpoint (`POST /api/bot/message`), enabling simulation and end-to-end testing of farmer interactions before connecting to the WhatsApp Cloud API.

> **Note:** All data regarding land verification, procurement quotas, weighbridge readings, and payments in this prototype are clearly labelled simulation demo data.

---

## 🛠️ Technology Stack

- **Runtime:** Node.js (LTS v24+)
- **Framework:** Express.js
- **Database & ODM:** MongoDB with Mongoose
- **Configuration:** `dotenv`
- **Development Tool:** `nodemon`
- **Session Layer:** In-memory session store for in-progress dialogue states, backed by MongoDB for confirmed profiles and bookings

---

## 📂 Project Structure

```text
Krishi Line/
├── server.js                      # Express server entry point & DB startup
├── package.json                   # Dependencies, scripts (start, dev, test)
├── .env                           # Local environment configuration
├── .env.example                   # Environment configuration template
├── .gitignore                     # Excludes node_modules and .env
├── README.md                      # API documentation and testing instructions
├── test-flow.js                   # State machine & MongoDB persistence tests
├── test-http.js                   # HTTP integration tests
├── test-db-helper.js              # Test database & mock initialization helper
└── src/
    ├── config/
    │   └── db.js                  # Mongoose connection & disconnect management
    ├── models/
    │   ├── Farmer.js              # Farmer profile schema & unique index
    │   ├── ProcurementBooking.js  # Confirmed bookings schema & unique booking ID
    │   └── ProcurementSlot.js     # APMC yard slots schema & atomic reservation
    ├── services/
    │   ├── farmerService.js       # Farmer database operations
    │   ├── slotService.js         # APMC slot seeding, queries & atomic locking
    │   └── bookingService.js      # Unique booking generation & DB persistence
    ├── bot/
    │   ├── conversationEngine.js  # Dialogue state machine and option routing
    │   ├── centresData.js         # Sample Nashik APMC centres and 4-hour slots
    │   └── sessionStore.js        # In-memory session and profile store per farmer
    └── routes/
        └── botRoutes.js           # REST API routes (/api/bot/message, /session, /reset)
```

---

## 🗄️ Database Setup (MongoDB)

### 1. Environment Configuration

Create a `.env` file in the project root (copied from `.env.example`):

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/krishi_line
```

* For **Local MongoDB**: `mongodb://localhost:27017/krishi_line`
* For **MongoDB Atlas (Cloud)**: `mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/krishi_line?retryWrites=true&w=majority`

> **Security Notice:** Never commit `.env` or real connection strings containing passwords to version control. No sensitive personal data (Aadhaar, banking credentials) is stored in the database.

---

### 2. MongoDB Collections & Schemas

| Collection | Schema / Model | Description | Indexes |
| :--- | :--- | :--- | :--- |
| `farmers` | `Farmer.js` | Persists registered farmer profiles (name, village, district, state, registeredAt). | Unique index on `{ farmerId: 1 }` |
| `procurementslots` | `ProcurementSlot.js` | Manages 4-hour slots and yard capacity across Nashik APMCs. | Compound unique index on `{ centreId: 1, slotId: 1 }` |
| `procurementbookings` | `ProcurementBooking.js` | Stores confirmed demo procurement reservations. | Unique index on `{ bookingId: 1 }`, Compound index on `{ farmerId: 1, bookedAt: -1 }` |

---

### 3. Concurrency & Overbooking Protection

To prevent concurrent requests from reserving the same 4-hour slot beyond its capacity, `ProcurementSlot.reserveAtomic(centreId, slotId)` executes an atomic MongoDB operation:

```javascript
ProcurementSlot.findOneAndUpdate(
  {
    centreId,
    slotId,
    $expr: { $lt: ['$bookedCount', '$capacity'] }
  },
  {
    $inc: { bookedCount: 1 }
  },
  {
    new: true
  }
);
```

If the slot has reached capacity (`bookedCount >= capacity`), the atomic query returns `null`, preventing race conditions and double-booking.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Tests
```bash
npm test
```
The test suite verifies:
* Dialogue flows (Welcome, Registration, Booking, Status queries, Help, Menu reset).
* MongoDB persistence of farmer profiles and bookings.
* Persistence across simulated server restarts.
* Atomic overbooking prevention and unique booking ID enforcement.
* HTTP validation and error handling.

### 3. Start the Server
```bash
# Development mode (auto-reload on code change)
npm run dev

# Production mode
npm start
```
The server will start listening at: `http://localhost:3000`

---

## 📱 Interactive WhatsApp Simulator

To visually test the entire Krishi-Line conversation flow, booking lifecycle, and QR pass gate verification without needing Meta WhatsApp Cloud API credentials:

1. Start the server (`npm start` or `npm run dev`).
2. Open your browser and navigate to:
   👉 **[http://localhost:3000/simulator](http://localhost:3000/simulator)** (or `http://localhost:3000/whatsapp`)

### Features of the Simulator:
- **Authentic WhatsApp UI:** Faithful recreation of WhatsApp phone & web chat interface (verified bot badge, chat bubbles with tails, timestamps, double blue ticks `✓✓`, typing indicators).
- **Interactive Button Chips:** Tap incoming WhatsApp quick-reply buttons (e.g. `[1. Farmer Registration]`, `[2. Book a Procurement Slot]`) to reply instantly.
- **Embedded QR Code Gate Pass:** Confirmed slot bookings render a scannable QR code PNG directly inside the WhatsApp conversation bubble.
- **Multi-Farmer Persona Switcher:** Test multi-farmer concurrency and data isolation between `farmer-001` (Ramesh Patil), `farmer-002` (Sunil Shinde), and custom farmer IDs.
- **One-Click Automated Test Flows:** Fast-forward registration, slot booking, procurement status, payment status, and `MENU` resets.
- **Mandi Gate Scanner Terminal:** Test `POST /api/bookings/verify` with 1-click token verification, simulated gate arrival, weighing completion, or pass cancellation.

---

## 📡 API Endpoints

### 1. Health Check
* **Method:** `GET`
* **URL:** `http://localhost:3000/health`
* **Response:**
```json
{
  "success": true,
  "service": "Krishi-Line Bot Backend",
  "status": "healthy",
  "timestamp": "2026-10-26T02:00:00.000Z"
}
```

---

### 2. Simulated Message Processing
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/bot/message`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "farmerId": "farmer-001",
  "message": "Hi"
}
```
* **Success Response:**
```json
{
  "success": true,
  "farmerId": "farmer-001",
  "reply": "Namaste! Welcome to Krishi-Line.\nTransparent Procurement | Stronger Farmers\n\nPlease choose:\n\n1. Farmer Registration\n2. Book a Procurement Slot\n3. My Booking\n4. Procurement Status\n5. Payment Status\n6. Help",
  "menuOptions": [
    "1. Farmer Registration",
    "2. Book a Procurement Slot",
    "3. My Booking",
    "4. Procurement Status",
    "5. Payment Status",
    "6. Help"
  ],
  "state": "MAIN_MENU"
}
```

---

## 🧪 Testing Conversation Flows

### Flow 1: Greeting & Main Menu
```bash
curl -X POST http://localhost:3000/api/bot/message \
  -H "Content-Type: application/json" \
  -d '{"farmerId": "farmer-001", "message": "Hi"}'
```

### Flow 2: Farmer Registration (Option 1)
```bash
# 1. Start registration
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "1"}'

# 2. Submit name
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "Ramesh Patil"}'

# 3. Submit village
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "Lasalgaon"}'

# 4. Submit district
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "Nashik"}'

# 5. Confirm registration (persists to MongoDB)
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "1"}'
```

### Flow 3: Book a Procurement Slot (Option 2)
```bash
# 1. Initiate booking (lists APMCs)
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "2"}'

# 2. Select Lasalgaon APMC (Option 1)
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "1"}'

# 3. Select Morning Slot (Option 1)
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "1"}'

# 4. Confirm booking (atomic reservation & MongoDB persistence)
curl -X POST http://localhost:3000/api/bot/message -H "Content-Type: application/json" -d '{"farmerId": "farmer-001", "message": "1"}'
```

### Flow 4: Status Queries & Reset
* **View Active Booking:** `{"farmerId": "farmer-001", "message": "3"}` (fetches from MongoDB even after server restarts)
* **Procurement Status:** `{"farmerId": "farmer-001", "message": "4"}`
* **Payment Status:** `{"farmerId": "farmer-001", "message": "5"}`
* **Help Guidance:** `{"farmerId": "farmer-001", "message": "6"}`
* **Reset Menu Anytime:** `{"farmerId": "farmer-001", "message": "MENU"}`

---

## 🎟️ QR Verification Token System

Each confirmed procurement booking generates:
1. **Unique Booking ID:** `KL-NSK-<TIMESTAMP>-<SEQ>-<RANDOM>`
2. **Cryptographic Verification Token:** `kl_tok_<48-hex-chars>` (192 bits of cryptographic entropy, mathematically unguessable).
3. **Local QR Code PNG:** Stored at `public/qrcodes/<bookingId>.png` and delivered via HTTP at `/qrcodes/<bookingId>.png`.
   * **Privacy Safeguard:** The QR code contains *only* the opaque token. No farmer personal data (name, phone, village, Aadhaar) is encoded.

### Booking Status Lifecycle
* `CONFIRMED`: Active booking ready for gate entry.
* `ARRIVED`: Produce truck arrived at mandi gate.
* `COMPLETED`: Produce weighed, graded, and procurement complete.
* `CANCELLED`: Booking invalidated; cannot be verified as active.

### Verify a Booking Token
* **Method:** `POST`
* **URL:** `http://localhost:3000/api/bookings/verify`
* **Headers:** `Content-Type: application/json`
* **Body:**
```json
{
  "token": "kl_tok_6745f9a2e381bc92..."
}
```
* **Success Response (Minimum information only):**
```json
{
  "success": true,
  "valid": true,
  "bookingId": "KL-NSK-MVON3RUA-00001-5571",
  "centreName": "Lasalgaon APMC Onion Yard (Niphad Taluka, Nashik)",
  "slotText": "28 Oct 2026 | 08:00 AM - 12:00 PM (Morning Slot)",
  "status": "CONFIRMED",
  "qrTokenStatus": "ACTIVE",
  "verifiedAt": "2026-10-26T02:30:00.000Z"
}
```
* **Cancelled / Invalid Token Response:**
```json
{
  "success": false,
  "valid": false,
  "status": "CANCELLED",
  "message": "This booking has been cancelled and cannot be verified as active."
}
```
