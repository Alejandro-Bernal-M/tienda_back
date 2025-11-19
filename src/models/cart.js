const mongoose = require('mongoose');

const CartSchema = mongoose.Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cartItems: [
    {
      product: {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      },
      offer: {
        type: Number
      }
    }
  ]
}, {timestamps: true});

module.exports = mongoose.model('Cart', CartSchema);