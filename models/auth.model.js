const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    min: 3,
    max: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    max: 60,
  },
  password: {
    type: String,
    required: true,
    min: 8,
  },
  avatarIsSet: {
    type: Boolean,
    default: false,
  },
  avatarLink: {
    type: String,
    default: "",
  },
  files: {
    type: Array,
    default: [],
  },
});

module.exports = mongoose.model("User", userSchema);
