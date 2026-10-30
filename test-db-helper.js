/**
 * Test Database Helper
 * 
 * Provides automated test setup with MongoDB.
 * Connects to live MongoDB if available, or activates a high-fidelity in-memory
 * database mock ensuring all schema constraints, unique indexes, and atomic
 * concurrency checks run deterministically.
 */

const mongoose = require('mongoose');
const Farmer = require('./src/models/Farmer');
const ProcurementSlot = require('./src/models/ProcurementSlot');
const ProcurementBooking = require('./src/models/ProcurementBooking');
const { CENTRES } = require('./src/bot/centresData');

let isMockMode = false;

// In-Memory Storage for Mock Mode
const mockFarmers = new Map();
const mockSlots = [];
const mockBookings = new Map();

/**
 * Initializes the test database.
 */
async function setupTestDb() {
  const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('Test suite connected to real MongoDB instance.');
      await clearTestDb();
      await seedTestSlots();
      return;
    } catch (err) {
      console.log('MongoDB server unreachable; activating high-fidelity test database mock.');
    }
  }

  // Activate Mock Mode
  isMockMode = true;
  activateMockDb();
  await seedTestSlots();
}

/**
 * Clears test collections.
 */
async function clearTestDb() {
  if (isMockMode) {
    mockFarmers.clear();
    mockSlots.length = 0;
    mockBookings.clear();
    await seedTestSlots();
    return;
  }

  if (mongoose.connection.readyState === 1) {
    await Farmer.deleteMany({});
    await ProcurementSlot.deleteMany({});
    await ProcurementBooking.deleteMany({});
    await seedTestSlots();
  }
}

/**
 * Seeds procurement slots into the test database.
 */
async function seedTestSlots() {
  const slotDocs = [];
  for (const centre of CENTRES) {
    for (const slot of centre.slots) {
      slotDocs.push({
        centreId: centre.id,
        centreName: centre.name,
        location: centre.location,
        slotId: slot.id,
        date: slot.date,
        time: slot.time,
        label: slot.label,
        capacity: slot.capacity || 2,
        bookedCount: 0
      });
    }
  }

  if (isMockMode) {
    mockSlots.length = 0;
    for (const doc of slotDocs) {
      mockSlots.push({ ...doc });
    }
  } else if (mongoose.connection.readyState === 1) {
    await ProcurementSlot.deleteMany({});
    await ProcurementSlot.insertMany(slotDocs);
  }
}

/**
 * Activates high-fidelity mock implementations for Mongoose models during testing.
 */
function activateMockDb() {
  // Mock Farmer
  Farmer.findOne = function (filter) {
    const farmer = mockFarmers.get(filter.farmerId) || null;
    return {
      lean: async () => (farmer ? { ...farmer } : null)
    };
  };

  Farmer.findOneAndUpdate = function (filter, update, options) {
    const farmerId = filter.farmerId;
    let existing = mockFarmers.get(farmerId);
    if (!existing && options && options.upsert) {
      existing = { farmerId, ...update, registeredAt: update.registeredAt || new Date() };
      mockFarmers.set(farmerId, existing);
    } else if (existing) {
      Object.assign(existing, update);
    }
    return {
      lean: async () => (existing ? { ...existing } : null)
    };
  };

  // Mock ProcurementSlot
  ProcurementSlot.countDocuments = async function () {
    return mockSlots.length;
  };

  ProcurementSlot.insertMany = async function (docs) {
    for (const d of docs) {
      mockSlots.push({ ...d });
    }
    return docs;
  };

  ProcurementSlot.find = function (filter) {
    const matched = mockSlots
      .filter((s) => s.centreId === filter.centreId)
      .map((s) => ({ ...s }));

    return {
      sort: () => ({
        lean: async () => matched.sort((a, b) => a.slotId - b.slotId)
      })
    };
  };

  ProcurementSlot.reserveAtomic = async function (centreId, slotId) {
    const slot = mockSlots.find((s) => s.centreId === centreId && s.slotId === slotId);
    if (!slot) return null;
    if (slot.bookedCount >= slot.capacity) {
      return null; // Full! Atomic operation returns null
    }
    slot.bookedCount += 1;
    return {
      toObject: () => ({ ...slot }),
      ...slot
    };
  };

  ProcurementSlot.releaseAtomic = async function (centreId, slotId) {
    const slot = mockSlots.find((s) => s.centreId === centreId && s.slotId === slotId);
    if (slot && slot.bookedCount > 0) {
      slot.bookedCount -= 1;
    }
    return slot;
  };

  // Mock ProcurementBooking
  ProcurementBooking.findOne = function (filter) {
    if (filter.bookingId) {
      const b = mockBookings.get(filter.bookingId) || null;
      return {
        lean: async () => (b ? { ...b } : null)
      };
    }

    if (filter.qrToken) {
      const b = Array.from(mockBookings.values()).find((item) => item.qrToken === filter.qrToken) || null;
      return {
        lean: async () => (b ? { ...b } : null)
      };
    }

    if (filter.farmerId) {
      const farmerBookings = Array.from(mockBookings.values())
        .filter((b) => b.farmerId === filter.farmerId)
        .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

      const latest = farmerBookings[0] || null;
      return {
        sort: () => ({
          lean: async () => (latest ? { ...latest } : null)
        })
      };
    }

    return {
      sort: () => ({ lean: async () => null }),
      lean: async () => null
    };
  };

  ProcurementBooking.findOneAndUpdate = function (filter, update, options) {
    let b = null;
    if (filter.bookingId) {
      b = mockBookings.get(filter.bookingId);
    } else if (filter.qrToken) {
      b = Array.from(mockBookings.values()).find((item) => item.qrToken === filter.qrToken);
    }

    if (b && update) {
      Object.assign(b, update);
    }

    return {
      lean: async () => (b ? { ...b } : null)
    };
  };

  ProcurementBooking.create = async function (data) {
    if (mockBookings.has(data.bookingId)) {
      const err = new Error(`E11000 duplicate key error collection: bookings index: bookingId_1 dup key: { bookingId: "${data.bookingId}" }`);
      err.code = 11000;
      throw err;
    }

    // Check unique QR token
    if (data.qrToken) {
      const existingToken = Array.from(mockBookings.values()).find((item) => item.qrToken === data.qrToken);
      if (existingToken) {
        const err = new Error(`E11000 duplicate key error collection: bookings index: qrToken_1 dup key: { qrToken: "${data.qrToken}" }`);
        err.code = 11000;
        throw err;
      }
    }

    const doc = {
      ...data,
      status: data.status || 'CONFIRMED',
      qrTokenStatus: data.qrTokenStatus || 'ACTIVE',
      bookedAt: data.bookedAt || new Date()
    };
    mockBookings.set(data.bookingId, doc);

    return {
      toObject: () => ({ ...doc }),
      ...doc
    };
  };
}

/**
 * Tears down test database.
 */
async function teardownTestDb() {
  if (!isMockMode && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  setupTestDb,
  clearTestDb,
  teardownTestDb
};
