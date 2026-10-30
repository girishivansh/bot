/**
 * Procurement Slot Model
 * 
 * Manages APMC yard capacity and 4-hour procurement slots in Nashik.
 * Uses atomic findOneAndUpdate operations to prevent overbooking across concurrent farmer requests.
 */

const mongoose = require('mongoose');

const ProcurementSlotSchema = new mongoose.Schema(
  {
    centreId: {
      type: Number,
      required: [true, 'Centre ID is required'],
      index: true
    },
    centreName: {
      type: String,
      required: [true, 'Centre name is required'],
      trim: true
    },
    location: {
      type: String,
      required: [true, 'Centre location is required'],
      trim: true
    },
    slotId: {
      type: Number,
      required: [true, 'Slot ID is required']
    },
    date: {
      type: String,
      required: [true, 'Slot date is required'],
      trim: true
    },
    time: {
      type: String,
      required: [true, 'Slot time range is required'],
      trim: true
    },
    label: {
      type: String,
      required: [true, 'Slot label is required'],
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      default: 2,
      min: 1
    },
    bookedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound Unique Index: One document per slot within a centre
ProcurementSlotSchema.index({ centreId: 1, slotId: 1 }, { unique: true });

/**
 * Atomically reserves a spot in the slot if capacity allows.
 * Guaranteed atomic by MongoDB document-level locking.
 * @param {number} centreId 
 * @param {number} slotId 
 * @returns {Promise<Document|null>} Reserved slot document if successful, null if full
 */
ProcurementSlotSchema.statics.reserveAtomic = async function (centreId, slotId) {
  return this.findOneAndUpdate(
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
};

/**
 * Atomically releases a reserved spot in case of downstream booking cancellation.
 * @param {number} centreId 
 * @param {number} slotId 
 * @returns {Promise<Document|null>}
 */
ProcurementSlotSchema.statics.releaseAtomic = async function (centreId, slotId) {
  return this.findOneAndUpdate(
    {
      centreId,
      slotId,
      bookedCount: { $gt: 0 }
    },
    {
      $inc: { bookedCount: -1 }
    },
    {
      new: true
    }
  );
};

const ProcurementSlot =
  mongoose.models.ProcurementSlot || mongoose.model('ProcurementSlot', ProcurementSlotSchema);

module.exports = ProcurementSlot;
