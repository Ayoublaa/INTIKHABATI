const express = require("express");
const ElectionHistory = require("../models/ElectionHistory");

const router = express.Router();

router.get("/", async (_req, res) => {
  const elections = await ElectionHistory.find().sort({ createdAt: -1 }).lean();
  return res.json({ success: true, elections });
});

module.exports = router;
