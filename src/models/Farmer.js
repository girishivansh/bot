/**
 * Farmer Model
 * 
 * Represents a registered onion farmer in the Nashik procurement network.
 * Note: Only operational profile data is stored. Sensitive personal data
 * (such as Aadhaar or bank details) is intentionally excluded.
 */

const mongoose = require('mongoose');

const FarmerSchema = new mongoose.Schema(
  {
    farmerId: {
      type: String,
      required: [true, 'Farmer ID is required'],
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Farmer name is required'],
      trim: true
    },
    village: {
      type: String,
      required: [true, 'Village name is required'],
      trim: true
    },
    district: {
      type: String,
      required: [true, 'District name is required'],
      trim: true
    },
    state: {
      type: String,
      default: 'Maharashtra',
      trim: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes
FarmerSchema.index({ farmerId: 1 }, { unique: true });

const Farmer = mongoose.models.Farmer || mongoose.model('Farmer', FarmerSchema);

module.exports = Farmer;
