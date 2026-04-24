const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema(
  {
    idHash: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    walletAddress: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      index:     true,
    },
    // Elections this wallet has registered for (array of electionIds)
    registeredElections: {
      type:    [Number],
      default: [],
    },
    riskScore: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },
    isBlacklisted: {
      type:    Boolean,
      default: false,
    },
    attemptCount: {
      type:    Number,
      default: 1,
    },
    ipAddresses: {
      type:    [String],
      default: [],
    },
    txHash: {
      type:    String,
      default: null,
    },
    registeredOnChain: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voter', VoterSchema);
