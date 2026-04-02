// ============================================================
//  models/Blacklist.js  – Liste noire des tentatives bloquées
//  Utilisée pour enregistrer les militaires qui tentent de voter
// ============================================================
const mongoose = require("mongoose");

const BlacklistSchema = new mongoose.Schema({
  // Adresse wallet de la tentative
  wallet: {
    type: String,
    required: true,
    lowercase: true,
  },

  // Hash SHA-256 du CIN (anonymisé)
  cinHash: {
    type: String,
    required: true,
  },

  // Profession détectée (ex: "Militaire")
  profession: {
    type: String,
    required: true,
  },

  // Ville de l'électeur
  city: {
    type: String,
    default: "Inconnue",
  },

  // Horodatage de la tentative
  timestamp: {
    type: Date,
    default: Date.now,
  },

  // Raison du blocage (ex: "Article 47 — Forces de sécurité")
  reason: {
    type: String,
    default: "Les membres des forces de sécurité ne sont pas autorisés à voter (Article 47)",
  },

  // IP de la tentative
  ipAddress: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Blacklist", BlacklistSchema);
