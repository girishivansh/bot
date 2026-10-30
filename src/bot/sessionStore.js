/**
 * In-Memory Session & Profile Store
 * 
 * Manages conversation states, temporary input caches, registered farmer profiles,
 * and global slot capacity reservations for Nashik APMC centres.
 * Separate state is tracked per farmerId.
 */

const sessions = new Map();
const globalBookings = new Map(); // bookingId -> booking details
const slotReservations = new Map(); // "centreId_slotId" -> Set of farmerIds

/**
 * Get or create a session for a given farmerId.
 * @param {string} farmerId 
 * @returns {object} The farmer's session object
 */
function getSession(farmerId) {
  if (!sessions.has(farmerId)) {
    sessions.set(farmerId, {
      farmerId,
      state: 'MAIN_MENU',
      farmer: {
        registered: false,
        name: null,
        village: null,
        district: null,
        registeredAt: null
      },
      tempRegistration: {},
      tempBooking: {},
      latestBooking: null
    });
  }
  return sessions.get(farmerId);
}

/**
 * Resets conversation state back to MAIN_MENU and clears temporary in-progress buffers.
 * Preserves confirmed farmer registration and existing confirmed bookings.
 * @param {string} farmerId 
 */
function resetStateToMenu(farmerId) {
  const session = getSession(farmerId);
  session.state = 'MAIN_MENU';
  session.tempRegistration = {};
  session.tempBooking = {};
  return session;
}

let bookingCounter = 0;

/**
 * Generates a collision-proof unique booking ID.
 * Incorporates a base-36 timestamp, monotonic sequence counter, and random entropy.
 * @returns {string} e.g. KL-NSK-M4X2Q9-00042-4821
 */
function generateUniqueBookingId() {
  bookingCounter = (bookingCounter + 1) % 100000;
  const timestampPart = Date.now().toString(36).toUpperCase();
  const seqPart = String(bookingCounter).padStart(5, '0');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `KL-NSK-${timestampPart}-${seqPart}-${randomPart}`;
}

/**
 * Returns how many farmers have booked a specific slot.
 * @param {number} centreId 
 * @param {number} slotId 
 * @returns {number}
 */
function getSlotBookedCount(centreId, slotId) {
  const key = `${centreId}_${slotId}`;
  if (!slotReservations.has(key)) {
    return 0;
  }
  return slotReservations.get(key).size;
}

/**
 * Checks if a slot has available capacity.
 * @param {number} centreId 
 * @param {number} slotId 
 * @param {number} capacity 
 * @returns {boolean}
 */
function isSlotAvailable(centreId, slotId, capacity = 2) {
  return getSlotBookedCount(centreId, slotId) < capacity;
}

/**
 * Records a confirmed booking globally and updates slot reservations.
 * @param {object} booking 
 */
function recordBooking(booking) {
  const { bookingId, farmerId, centreId, slotId } = booking;
  globalBookings.set(bookingId, booking);

  const key = `${centreId}_${slotId}`;
  if (!slotReservations.has(key)) {
    slotReservations.set(key, new Set());
  }
  slotReservations.get(key).add(farmerId);
}

/**
 * Clears all sessions and global booking registries (useful for tests or demo resets).
 */
function clearAllSessions() {
  sessions.clear();
  globalBookings.clear();
  slotReservations.clear();
}

module.exports = {
  getSession,
  resetStateToMenu,
  generateUniqueBookingId,
  getSlotBookedCount,
  isSlotAvailable,
  recordBooking,
  clearAllSessions
};
