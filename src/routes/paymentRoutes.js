const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Ruta llamada por el Frontend
router.post('/create-preference', paymentController.createPreference);

// Ruta llamada por Mercado Pago (Webhook)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;