/**
 * Procurement Booking Service
 * 
 * Manages database persistence for confirmed demo bookings with QR verification tokens.
 * Enforces booking ID uniqueness, cryptographically unguessable QR tokens, and verification.
 */

const ProcurementBooking = require('../models/ProcurementBooking');
const { BOOKING_STATUS } = require('../models/ProcurementBooking');
const { generateSecureToken, generateBookingQRCode } = require('./qrService');

let bookingCounter = 0;

/**
 * Generates a unique, collision-proof booking ID.
 * Incorporates a base-36 timestamp, monotonic sequence counter, random entropy,
 * and database existence verification.
 * @returns {Promise<string>}
 */
async function generateUniqueBookingId() {
  let id;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 20) {
    bookingCounter = (bookingCounter + 1) % 100000;
    const timestampPart = Date.now().toString(36).toUpperCase();
    const seqPart = String(bookingCounter).padStart(5, '0');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    id = `KL-NSK-${timestampPart}-${seqPart}-${randomPart}`;

    const existing = await ProcurementBooking.findOne({ bookingId: id }).lean();
    if (!existing) {
      exists = false;
    }
    attempts++;
  }

  return id;
}

/**
 * Generates an unguessable token and ensures it is unique in the database.
 * @returns {Promise<string>}
 */
async function generateUniqueQRToken() {
  let token;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 20) {
    token = generateSecureToken();
    const existing = await ProcurementBooking.findOne({ qrToken: token }).lean();
    if (!existing) {
      exists = false;
    }
    attempts++;
  }

  return token;
}

/**
 * Creates and persists a new procurement booking in MongoDB with a generated QR code pass.
 * @param {object} bookingData 
 * @returns {Promise<object>}
 */
async function createBooking(bookingData) {
  const { farmerId, centreId, centreName, slotId, slotText, status } = bookingData;
  const bookingId = await generateUniqueBookingId();
  const qrToken = await generateUniqueQRToken();

  // Generate QR code image on local disk
  const qrInfo = await generateBookingQRCode(bookingId, qrToken);

  const booking = await ProcurementBooking.create({
    bookingId,
    farmerId,
    centreId,
    centreName,
    slotId,
    slotText,
    status: status || BOOKING_STATUS.CONFIRMED,
    qrToken,
    qrImagePath: qrInfo.qrImagePath,
    qrRelativeUrl: qrInfo.qrRelativeUrl,
    qrTokenStatus: 'ACTIVE',
    bookedAt: new Date()
  });

  return booking.toObject();
}

/**
 * Retrieves the latest booking for a given farmerId.
 * @param {string} farmerId 
 * @returns {Promise<object|null>}
 */
async function getLatestBooking(farmerId) {
  return ProcurementBooking.findOne({ farmerId })
    .sort({ bookedAt: -1 })
    .lean();
}

/**
 * Verifies a booking using its cryptographic QR token.
 * Returns only the minimum information necessary for gate verification.
 * @param {string} token 
 * @returns {Promise<object>} Verification result
 */
async function verifyBookingToken(token) {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      reason: 'INVALID_INPUT',
      message: "Field 'token' is required and must be a string."
    };
  }

  const booking = await ProcurementBooking.findOne({ qrToken: token.trim() }).lean();

  if (!booking) {
    return {
      valid: false,
      reason: 'NOT_FOUND',
      message: 'Invalid or non-existent booking token.'
    };
  }

  // Requirement 9: Do not allow cancelled bookings to be verified as active
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    return {
      valid: false,
      reason: 'CANCELLED',
      bookingId: booking.bookingId,
      status: BOOKING_STATUS.CANCELLED,
      message: 'This booking has been cancelled and cannot be verified as active.'
    };
  }

  // Active verified booking - return minimum information only (no farmer PII)
  return {
    valid: true,
    bookingId: booking.bookingId,
    centreName: booking.centreName,
    slotText: booking.slotText,
    status: booking.status,
    qrTokenStatus: booking.qrTokenStatus || 'ACTIVE',
    verifiedAt: new Date().toISOString()
  };
}

/**
 * Updates a booking's status (e.g. CANCELLED, ARRIVED, COMPLETED).
 * @param {string} bookingId 
 * @param {string} status 
 * @returns {Promise<object|null>}
 */
async function updateBookingStatus(bookingId, status) {
  if (!Object.values(BOOKING_STATUS).includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const update = { status };
  if (status === BOOKING_STATUS.CANCELLED) {
    update.qrTokenStatus = 'REVOKED';
  }

  return ProcurementBooking.findOneAndUpdate(
    { bookingId },
    update,
    { new: true }
  ).lean();
}

module.exports = {
  BOOKING_STATUS,
  generateUniqueBookingId,
  generateUniqueQRToken,
  createBooking,
  getLatestBooking,
  verifyBookingToken,
  updateBookingStatus
};
