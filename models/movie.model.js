const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema({
  name: {
    type: String,
    require: true,
  },
  season: {
    type: String,
  },
  episode: {
    type: String,
  },
  description: {
    type: String,
    require: true,
  },
  imageTMDB: {
    type: String,
    require: true,
  },
  link: {
    type: String,
    require: true,
  },
  views: {
    type: Number,
    require: true,
  },
  watchedBy: {
    type: Array,
    require: true,
  },
  likedBy: {
    type: Array,
    require: true,
  },
  isSerie: {
    type: Boolean,
    require: true,
  },
  isMovie: {
    type: Boolean,
    require: true,
  },
  size: {
    type: Number,
    require: true,
  },
  format: {
    type: String,
    require: true,
  },
});

module.exports = mongoose.model("Movie", movieSchema);
