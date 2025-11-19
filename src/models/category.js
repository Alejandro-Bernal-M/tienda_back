const mongoose = require('mongoose');

const CategorySchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    require: true,
    unique: true,
    trim: true
  },
  categoryImage: String,
  parentId: String,
}, {timestamps: true});

module.exports = mongoose.model('Category', CategorySchema);