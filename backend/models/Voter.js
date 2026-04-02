// ============================================================
//  models/Voter.js  – Schéma MongoDB pour les électeurs
// ============================================================
const mongoose = require("mongoose");

const VoterSchema = new mongoose.Schema(
  {
    // CIN hashé en SHA-256 (jamais le vrai CIN stocké !)
    idHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Adresse wallet MetaMask liée à cet électeur
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    // Score de risque calculé par l'API (0 = sûr, 100 = très suspect)
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // L'électeur est-il enregistré sur le smart contract ?
    registeredOnChain: {
      type: Boolean,
      default: false,
    },

    // Hash de la transaction Ethereum d'enregistrement
    txHash: {
      type: String,
      default: null,
    },

    // Nombre de tentatives d'enregistrement (détection multi-wallet)
    attemptCount: {
      type: Number,
      default: 1,
    },

    // IP des tentatives (pour détecter les abus)
    ipAddresses: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  }
);

module.exports = mongoose.model("Voter", VoterSchema);
