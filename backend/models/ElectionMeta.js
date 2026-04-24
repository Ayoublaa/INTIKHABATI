// ============================================================
//  models/ElectionMeta.js — Geographic restrictions per election
//  Empty arrays = national election (no restriction)
// ============================================================
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  electionId:       { type: Number, unique: true, required: true },
  allowedRegions:   { type: [String], default: [] },   // e.g. ["Marrakech-Safi"]
  allowedCities:    { type: [String], default: [] },   // e.g. ["Marrakech"]
  allowedDistricts: { type: [String], default: [] },   // e.g. ["Guéliz", "Ménara"]
}, { timestamps: true });

module.exports = mongoose.model('ElectionMeta', schema);
