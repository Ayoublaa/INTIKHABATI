const mongoose = require('mongoose');

// Caches closed election results — avoids re-reading old blockchain state
const ElectionCacheSchema = new mongoose.Schema(
  {
    electionId: {
      type:     Number,
      required: true,
      unique:   true,
      index:    true,
    },
    name:            { type: String },
    category:        { type: String },
    status:          { type: String, enum: ['Upcoming', 'Open', 'Closed'] },
    closedAt:        { type: Date },
    totalVotes:      { type: Number, default: 0 },
    totalRegistered: { type: Number, default: 0 },
    turnoutPct:      { type: Number, default: 0 },
    blankVotes:      { type: Number, default: 0 },
    results: [
      {
        id:         Number,
        name:       String,
        party:      String,
        voteCount:  Number,
        percentage: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ElectionCache', ElectionCacheSchema);
