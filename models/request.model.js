const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  year: {
    type: String,
  },
  info: {
    type: String,
  },
  requestedBy: {
    type: String,
    default: "",
  },
  processed: {
    type: Boolean,
    default: false,
  },
  by: {
    type: String,
    default: "",
  },
  details: {
    type: String,
    default: "",
  },
});

module.exports = mongoose.model("Request", requestSchema);
