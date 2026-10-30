/**
 * Procurement Slot Service
 * 
 * Manages database slot initialization, capacity queries, and atomic slot reservations.
 */

const ProcurementSlot = require('../models/ProcurementSlot');
const { CENTRES } = require('../bot/centresData');

/**
 * Seeds initial APMC centres and 4-hour slots into MongoDB if not present.
 */
async function seedSlotsIfEmpty() {
  const count = await ProcurementSlot.countDocuments();
  if (count > 0) {
    return;
  }

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

  if (slotDocs.length > 0) {
    await ProcurementSlot.insertMany(slotDocs);
    console.log(`Seeded ${slotDocs.length} procurement slots into MongoDB.`);
  }
}

/**
 * Retrieves all slots for a centre with live capacity information.
 * @param {number} centreId 
 * @returns {Promise<Array>}
 */
async function getCentreSlots(centreId) {
  return ProcurementSlot.find({ centreId }).sort({ slotId: 1 }).lean();
}

/**
 * Atomically reserves a spot in a slot if capacity is available.
 * @param {number} centreId 
 * @param {number} slotId 
 * @returns {Promise<object|null>} The reserved slot or null if full
 */
async function reserveSlotAtomic(centreId, slotId) {
  const reserved = await ProcurementSlot.reserveAtomic(centreId, slotId);
  return reserved ? reserved.toObject() : null;
}

/**
 * Atomically releases a reserved slot.
 * @param {number} centreId 
 * @param {number} slotId 
 */
async function releaseSlotAtomic(centreId, slotId) {
  return ProcurementSlot.releaseAtomic(centreId, slotId);
}

module.exports = {
  seedSlotsIfEmpty,
  getCentreSlots,
  reserveSlotAtomic,
  releaseSlotAtomic
};
