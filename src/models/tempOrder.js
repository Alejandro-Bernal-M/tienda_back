const mongoose = require('mongoose');

const tempOrderSchema = new mongoose.Schema({
  preferenceId: { type: String, required: true }, // ID de la preferencia de MP
  externalReference: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true },
      color: { type: String },
      size: { type: String }
    }
  ],
  totalAmount: { type: Number },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // Se borra en 1 hora si no se paga
  shippingCost: { type: Number, default: 0 }, // Para el envío
    name: { type: String }, // Nombre del cliente (para invitados o envío)
    email: { type: String }, // Email (importante recuperarlo aquí)
    address: {
        city: String,
        country: String,
        line1: String,
        line2: String,
        postal_code: String,
        state: String
    }
});

module.exports = mongoose.model('TempOrder', tempOrderSchema);