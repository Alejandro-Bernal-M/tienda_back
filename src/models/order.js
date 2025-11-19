const mongoose = require('mongoose');

const OrderSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  address: {
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    line1: {
      type: String,
      required: true,
    },
    line2: {
      type: String,
    },
    postal_code: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
  },
  email: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  paymentStatus: {
    type: String,
    default: 'Pending',
  },
  paymentType: {
    type: String,
    default: 'Cash on Delivery',
  },
  orderStatus: {
    type: String,
    default: 'Order Placed',
    enum: ['Order Placed', 'Order Accepted', 'Order Processing', 'Order Shipped', 'Order Delivered', 'Order Cancelled'],
  },
  paymentInfo: {
    id: {
      type: String,
    },
    status: {
      type: String,
    },
  },
}, {timestamps: true});

module.exports = mongoose.model('Order', OrderSchema);