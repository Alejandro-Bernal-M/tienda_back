const mongoose = require('mongoose');

const tempOrderSchema = new mongoose.Schema({
  preferenceId: { type: String, required: true }, // ID de la preferencia de MP
  externalReference: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true },
    }
  ],
  totalAmount: { type: Number },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // Se borra en 1 hora si no se paga
});

module.exports = mongoose.model('TempOrder', tempOrderSchema);