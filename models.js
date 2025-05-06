const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema for replies within threads
const ReplySchema = new Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false }
});

// Schema for threads
const ThreadSchema = new Schema({
  board: { type: String, required: true },
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: [ReplySchema]
});

// Create Thread model
const Thread = mongoose.model('Thread', ThreadSchema);

// Export models
module.exports = { Thread };