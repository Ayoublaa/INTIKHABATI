const mongoose = require("mongoose");

const ElectionHistorySchema = new mongoose.Schema(
  {
    electionName: { type: String, required: true },
    electionCategory: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: Date.now },
    totalRegistered: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },
    turnoutPercentage: { type: Number, default: 0 },
    results: [
      {
        id: Number,
        name: String,
        voteCount: Number,
        percentage: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ElectionHistory", ElectionHistorySchema);
