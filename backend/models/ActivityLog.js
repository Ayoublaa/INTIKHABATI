const mongoose = require('mongoose');

// Immutable audit trail for all sensitive actions.
// Records are append-only — never updated or deleted.
const ActivityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'REGISTRATION',
        'VOTE_CAST',
        'DELEGATION',
        'ID_MISMATCH',
        'BLACKLIST',
        'ELECTION_CREATE',
        'ELECTION_OPEN',
        'ELECTION_CLOSE',
        'SUSPICIOUS',
      ],
      required: true,
    },
    walletAddress: { type: String, index: true },
    electionId:    { type: Number, index: true },
    ip:            { type: String },
    txHash:        { type: String },
    detail:        { type: String },
    severity: {
      type:    String,
      enum:    ['info', 'warning', 'critical'],
      default: 'info',
    },
  },
  { timestamps: true }
);

// Prevent accidental updates — logs are append-only
ActivityLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('ActivityLog records are immutable');
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
