const mongoose = require('mongoose');
const order = require('./order');

const homeSectionSchema = mongoose.Schema({
  title: {
    type: String,
  },
  paragraphs: {
    type: Array,
  },
  image: {
    type: String,
  },
  order: {
    type: Number
  },
})

module.exports = mongoose.model('HomeSection', homeSectionSchema);