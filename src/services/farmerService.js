/**
 * Farmer Service
 * 
 * Handles database operations for farmer profiles.
 */

const Farmer = require('../models/Farmer');

/**
 * Retrieves a farmer profile by farmerId.
 * @param {string} farmerId 
 * @returns {Promise<object|null>}
 */
async function getFarmer(farmerId) {
  return Farmer.findOne({ farmerId }).lean();
}

/**
 * Saves or updates a farmer profile in MongoDB.
 * @param {object} profile 
 * @returns {Promise<object>}
 */
async function saveFarmer(profile) {
  const { farmerId, name, village, district, state = 'Maharashtra' } = profile;

  return Farmer.findOneAndUpdate(
    { farmerId },
    {
      farmerId,
      name,
      village,
      district,
      state,
      registeredAt: new Date()
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  ).lean();
}

module.exports = {
  getFarmer,
  saveFarmer
};
