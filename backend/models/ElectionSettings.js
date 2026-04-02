// ============================================================
//  models/ElectionSettings.js  – Paramètres de l'élection
//  Un seul document dans la collection (upsert)
// ============================================================
const mongoose = require("mongoose");

const ElectionSettingsSchema = new mongoose.Schema({
  // Visibilité des résultats
  // "public"           → visible par tous à tout moment
  // "after_close"      → visible uniquement après fermeture du vote
  // "registered_only"  → visible uniquement aux électeurs inscrits ayant voté
  resultsVisibility: {
    type: String,
    enum: ["public", "after_close", "registered_only"],
    default: "public",
  },

  // Date de dernière modification
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ElectionSettings", ElectionSettingsSchema);
