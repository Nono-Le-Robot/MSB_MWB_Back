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
