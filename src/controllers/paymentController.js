// 1. Cargar variables de entorno AL PRINCIPIO
const dotenv = require('dotenv');
dotenv.config();

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Product = require('../models/product');
const TempOrder = require('../models/tempOrder');
const Order = require('../models/order');

// 2. Validación de Token
if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ CRÍTICO: Falta MP_ACCESS_TOKEN en el archivo .env");
}

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN 
});

// --- CONTROLADOR PARA CREAR LA PREFERENCIA ---
exports.createPreference = async (req, res) => {
  console.log("👉 Inicio de createPreference"); 

  try {
    const { 
        items, 
        userId, 
        shippingPrice = 0, 
        deliveryAddress, 
        contactName, 
        contactEmail 
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "El carrito está vacío" });
    }

    const backendUrl = process.env.PUBLIC_DOMAIN || 'http://localhost:2000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    console.log("🔗 Webhook irá a:", backendUrl);
    
    const validUserId = (userId && mongoose.Types.ObjectId.isValid(userId)) ? userId : null;
    const externalReference = crypto.randomUUID(); 
    let calculatedTotal = 0;
    
    console.log(`🔄 Procesando ${items.length} productos...`);

    // 3. ARMADO DE ITEMS
    const itemsForMP = await Promise.all(items.map(async (item) => {
      const product = await Product.findById(item._id);
      if (!product) throw new Error(`Producto no encontrado en DB: ${item._id}`);

      let finalPrice = product.price;
      if (product.offer > 0) {
        finalPrice = product.price - (product.price * product.offer / 100);
      }
      
      finalPrice = Math.round(finalPrice); 
      calculatedTotal += finalPrice * item.quantity;

      let pictureUrl = 'https://www.mercadopago.com/org-img/MP3/home/logomp3.gif';
      
      if (product.productImages && product.productImages.length > 0) {
         const img = product.productImages[0].img;
         if (img.startsWith('http')) {
            pictureUrl = img;
         } else {
            pictureUrl = `${backendUrl}/public/${img}`;
         }
      }

      const titleWithVariant = `${product.name} (${item.size || 'N/A'} / ${item.color || 'N/A'})`;

      return {
        id: product._id.toString(),
        title: titleWithVariant,
        quantity: Number(item.quantity),
        unit_price: Number(finalPrice),
        currency_id: 'COP', 
        picture_url: pictureUrl
      };
    }));

    if (Number(shippingPrice) > 0) {
        itemsForMP.push({
            id: 'shipping-cost',
            title: 'Costo de envío',
            quantity: 1,
            unit_price: Number(shippingPrice),
            currency_id: 'COP'
        });
        calculatedTotal += Number(shippingPrice);
    }

    const body = {
      items: itemsForMP,
      external_reference: externalReference,
      payer: {
          email: contactEmail || 'test_user_123@testuser.com' 
      },
      back_urls: { 
        success: `${frontendUrl}/checkout/success`,
        failure: `${frontendUrl}/checkout/failure`,
        pending: `${frontendUrl}/checkout/pending`
      },
      auto_return: "approved", 
      notification_url: `${backendUrl}/api/payment/webhook`,
      metadata: {
        user_id: validUserId 
      }
    };

    const preference = new Preference(client);
    const result = await preference.create({ body });

    console.log("✅ Preferencia creada. ID:", result.id);

    await TempOrder.create({
      preferenceId: result.id, 
      externalReference: externalReference,
      user: validUserId,
      products: items.map(i => ({ product: i._id, quantity: i.quantity, color: i.color, size: i.size })),
      totalAmount: calculatedTotal,
      shippingCost: Number(shippingPrice),
      name: contactName || 'Cliente Invitado',
      email: contactEmail,
      address: deliveryAddress 
    });

    res.status(200).json({ url: result.init_point });

  } catch (error) {
    console.error('❌ Error CRÍTICO en createPreference:', error);
    res.status(500).json({ 
      message: 'Error interno al crear el pago', 
      error: error.message || 'Unknown Error'
    });
  }
};

// --- FUNCIÓN AUXILIAR: COMPLETAR LA ORDEN ---
async function fulfillOrder(paymentInfo) {
  const externalRef = paymentInfo.external_reference;
  const paymentId = paymentInfo.id.toString(); 

  console.log(`🔄 Intento de procesar orden. Ref: ${externalRef} | PaymentID: ${paymentId}`);

  try {
    // 1. IDEMPOTENCIA NIVEL 1: Chequeo rápido
    const existingOrder = await Order.findOne({ 'paymentInfo.id': paymentId });
    if (existingOrder) {
        console.log(`✋ ALTO: La orden para el pago ${paymentId} YA EXISTE. Ignorando duplicado.`);
        return;
    }

    // 2. IDEMPOTENCIA NIVEL 2: Atomicidad (Borrar y Traer en un solo paso)
    // ESTO ES LA CLAVE: findOneAndDelete evita que dos hilos tomen la misma orden
    const tempOrder = await TempOrder.findOneAndDelete({ externalReference: externalRef });

    if (!tempOrder) {
      console.log("⚠️ TempOrder no encontrada (o ya fue procesada y borrada por otro hilo).");
      return;
    }

    // 3. Crear la Orden Real
    try {
        const newOrder = await Order.create({
            user: tempOrder.user,
            products: tempOrder.products,
            totalAmount: paymentInfo.transaction_amount, 
            paymentStatus: paymentInfo.status === 'approved' ? 'paid' : paymentInfo.status,
            paymentType: 'MercadoPago',
            paymentInfo: {
                id: paymentId,
                status: paymentInfo.status,
                type: paymentInfo.payment_type_id
            },
            email: tempOrder.email || paymentInfo.payer.email,
            name: tempOrder.name,     
            address: tempOrder.address 
        });

        console.log(`✅ Orden ${newOrder._id} creada exitosamente.`);
    } catch (createError) {
        // Si falla la creación (ej: validación de mongoose), logueamos el error grave
        // porque la TempOrder YA FUE BORRADA.
        console.error("❌ Error CRÍTICO creando orden final:", createError);
        console.error("DATOS PERDIDOS (TempOrder):", JSON.stringify(tempOrder));
    }

  } catch (dbError) {
      console.error("❌ Error guardando orden en BD:", dbError);
  }
}

// --- WEBHOOK ---
exports.handleWebhook = async (req, res) => {
  const query = req.query;
  const topic = query.topic || query.type; 

  console.log("🔔 Webhook recibido. Topic:", topic);

  if (topic === 'payment') {
    try {
      const paymentId = query.id || query['data.id'];
      
      if (!paymentId) return res.sendStatus(200);

      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id: paymentId });

      // Solo procesamos si está aprobado
      if (paymentInfo.status === 'approved') {
        await fulfillOrder(paymentInfo);
      } else {
        console.log(`ℹ️ Pago ${paymentId} recibido pero estado es: ${paymentInfo.status}`);
      }
    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
    }
  }
  
  // Responder siempre 200 RAPIDO
  res.sendStatus(200);
};