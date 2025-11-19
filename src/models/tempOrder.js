const mongoose = require('mongoose');
const product = require('./product');

const TempOrderSchema = mongoose.Schema({
  stripeSessionId: {
    type: String,
    required: true
  },
  products: [
    {
      product: {
        type: mongoose.Types.ObjectId, ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true
      }
    }
  ],
  user: {
    type: mongoose.Types.ObjectId, ref: 'User'
  }
}, {timestamps: true});

module.exports = mongoose.model('TempOrder', TempOrderSchema);