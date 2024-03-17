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
});

module.exports = mongoose.model("Request", requestSchema);
