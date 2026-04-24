const mongoose = require('mongoose');

const ElectionSettingsSchema = new mongoose.Schema(
  {
    resultsVisibility: {
      type:    String,
      enum:    ['public', 'after_close', 'registered_only'],
      default: 'after_close',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ElectionSettings', ElectionSettingsSchema);
