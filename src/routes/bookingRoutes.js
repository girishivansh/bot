/**
 * Booking API Routes
 * 
 * Provides endpoints for verifying booking QR tokens and checking slot status.
 */

const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');

/**
 * POST /api/bookings/verify
 * Accepts a cryptographic booking QR token and verifies its validity.
 * Returns only the minimum information required for gate verification.
 */
router.post('/verify', async (req, res) => {
  // Validate request body
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: "Validation Error: Request body must be a valid JSON object."
    });
  }

  const { token } = req.body;

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({
      success: false,
      valid: false,
      message: "Validation Error: 'token' is required and must be a non-empty string."
    });
  }

  try {
    const result = await bookingService.verifyBookingToken(token.trim());

    if (result.valid) {
      return res.status(200).json({
        success: true,
        ...result
      });
    }

    if (result.reason === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        ...result
      });
    }

    if (result.reason === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        ...result
      });
    }

    return res.status(400).json({
      success: false,
      ...result
    });
  } catch (error) {
    console.error('Error during token verification:', error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: 'Internal server error while verifying token.'
    });
  }
});

/**
 * POST /api/bookings/status
 * Helper endpoint to update booking status (e.g. CANCELLED, ARRIVED, COMPLETED).
 */
router.post('/status', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Validation Error: Request body must be a valid JSON object."
    });
  }

  const { bookingId, status } = req.body;

  if (!bookingId || typeof bookingId !== 'string') {
    return res.status(400).json({
      success: false,
      message: "Validation Error: 'bookingId' is required."
    });
  }

  if (!status || typeof status !== 'string') {
    return res.status(400).json({
      success: false,
      message: "Validation Error: 'status' is required."
    });
  }

  try {
    const updated = await bookingService.updateBookingStatus(bookingId.trim(), status.trim().toUpperCase());
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Booking with ID '${bookingId}' not found.`
      });
    }

    return res.status(200).json({
      success: true,
      booking: updated
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/bookings/latest/:farmerId
 * Helper endpoint to retrieve the latest booking record for testing & inspection.
 */
router.get('/latest/:farmerId', async (req, res) => {
  const { farmerId } = req.params;
  try {
    const booking = await bookingService.getLatestBooking(farmerId);
    return res.status(200).json({
      success: true,
      booking: booking || null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
