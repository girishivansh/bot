/**
 * Procurement Booking Model
 * 
 * Records confirmed procurement slot reservations with cryptographic QR verification tokens.
 * Enforces unique booking IDs and unique, unguessable QR tokens.
 */

const mongoose = require('mongoose');

const BOOKING_STATUS = {
  CONFIRMED: 'CONFIRMED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

const ProcurementBookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: [true, 'Booking ID is required'],
      trim: true
    },
    farmerId: {
      type: String,
      required: [true, 'Farmer ID is required'],
      trim: true,
      index: true
    },
    centreId: {
      type: Number,
      required: [true, 'Centre ID is required']
    },
    centreName: {
      type: String,
      required: [true, 'Centre name is required'],
      trim: true
    },
    slotId: {
      type: Number,
      required: [true, 'Slot ID is required']
    },
    slotText: {
      type: String,
      required: [true, 'Slot time text is required'],
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.CONFIRMED,
      trim: true,
      index: true
    },
    qrToken: {
      type: String,
      required: [true, 'QR verification token is required'],
      trim: true
    },
    qrImagePath: {
      type: String,
      trim: true
    },
    qrRelativeUrl: {
      type: String,
      trim: true
    },
    qrTokenStatus: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
      default: 'ACTIVE',
      trim: true
    },
    bookedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound and Unique Indexes
ProcurementBookingSchema.index({ bookingId: 1 }, { unique: true });
ProcurementBookingSchema.index({ qrToken: 1 }, { unique: true });
ProcurementBookingSchema.index({ farmerId: 1, bookedAt: -1 });

const ProcurementBooking =
  mongoose.models.ProcurementBooking ||
  mongoose.model('ProcurementBooking', ProcurementBookingSchema);

module.exports = ProcurementBooking;
module.exports.BOOKING_STATUS = BOOKING_STATUS;
