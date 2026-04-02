// ============================================================
//  models/FakeID.js  – Base de CIN simulés (Phantom ID)
// ============================================================
const mongoose = require("mongoose");

const FakeIDSchema = new mongoose.Schema({
  // Numéro CIN (ex: "AB123456")
  cin: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },

  // Nom complet du citoyen
  fullName: {
    type: String,
    required: true,
  },

  // Date de naissance
  birthDate: {
    type: Date,
    required: true,
  },

  // Ville d'origine
  city: {
    type: String,
    required: true,
  },

  // Profession (utilisée pour la liste noire militaire)
  profession: {
    type: String,
    default: "Citoyen",
  },

  // Email pour les notifications
  email: {
    type: String,
    default: null,
  },

  // Wallet MetaMask pré-assigné (Feature 1 — wallet lié au CIN)
  walletAddress: {
    type: String,
    default: null,
    lowercase: true,
  },

  // Le CIN est-il valide (non expiré, non révoqué) ?
  isValid: {
    type: Boolean,
    default: true,
  },

  // Ce CIN a-t-il déjà été utilisé pour voter ?
  usedForVoting: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("FakeID", FakeIDSchema);
