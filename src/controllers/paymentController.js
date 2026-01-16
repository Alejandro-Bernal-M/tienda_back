// 1. Cargar variables de entorno AL PRINCIPIO
const dotenv = require('dotenv');
dotenv.config();

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto');
const mongoose = require('mongoose'); // Necesario para validar IDs
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
    // Recibimos datos extra: envío, dirección y contacto
    const { 
        items, 
        userId, 
        shippingPrice = 0, 
        deliveryAddress, 
        contactName, 
        contactEmail 
    } = req.body;

    // Validación básica
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "El carrito está vacío" });
    }

    const backendUrl = process.env.PUBLIC_DOMAIN || 'http://localhost:2000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    console.log("🔗 Webhook irá a:", backendUrl);
    
    // VALIDACIÓN DE ID DE USUARIO (Protección contra error Cast to ObjectId)
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

      return {
        id: product._id.toString(),
        title: product.name,
        quantity: Number(item.quantity),
        unit_price: Number(finalPrice),
        currency_id: 'COP', 
        picture_url: pictureUrl
      };
    }));

    // 4. AGREGAR COSTO DE ENVÍO (Si existe)
    if (Number(shippingPrice) > 0) {
        console.log(`🚚 Agregando envío por: $${shippingPrice}`);
        itemsForMP.push({
            id: 'shipping-cost',
            title: 'Costo de envío',
            quantity: 1,
            unit_price: Number(shippingPrice),
            currency_id: 'COP'
        });
        calculatedTotal += Number(shippingPrice);
    }

    // 5. CREAR OBJETO DE PREFERENCIA
    const body = {
      items: itemsForMP,
      external_reference: externalReference,
      payer: {
          email: contactEmail || 'test_user_123@testuser.com' // Ayuda a prellenar MP
      },
      back_urls: { // ✅ CORREGIDO: Es plural (back_urls)
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

    console.log("📤 Enviando preferencia a Mercado Pago...");

    const preference = new Preference(client);
    const result = await preference.create({ body });

    console.log("✅ Preferencia creada. ID:", result.id);

    // 6. GUARDAR ORDEN TEMPORAL CON DATOS COMPLETOS
    // Guardamos dirección y nombre para recuperarlos tras el pago
    await TempOrder.create({
      preferenceId: result.id, 
      externalReference: externalReference,
      user: validUserId,
      products: items.map(i => ({ product: i._id, quantity: i.quantity })),
      totalAmount: calculatedTotal,
      
      // Datos guardados para cumplir requisitos del modelo Order
      shippingCost: Number(shippingPrice),
      name: contactName || 'Cliente Invitado',
      email: contactEmail,
      address: deliveryAddress // Objeto completo {city, country, line1...}
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
  console.log(`🔄 Procesando orden para ref: ${externalRef}`);

  try {
    // 1. Buscar la TempOrder
    const tempOrder = await TempOrder.findOne({ externalReference: externalRef });

    if (!tempOrder) {
      console.log("⚠️ TempOrder no encontrada o ya procesada.");
      return;
    }

    // 2. Crear la Orden Real
    // Recuperamos los datos de dirección guardados en TempOrder
    const newOrder = await Order.create({
        user: tempOrder.user,
        products: tempOrder.products,
        totalAmount: paymentInfo.transaction_amount, // Usa el total real pagado
        paymentStatus: paymentInfo.status === 'approved' ? 'paid' : paymentInfo.status,
        paymentType: 'MercadoPago',
        paymentInfo: {
            id: paymentInfo.id,
            status: paymentInfo.status,
            type: paymentInfo.payment_type_id
        },
        
        // CORRECCIÓN DE VALIDACIÓN (Llenar campos required)
        email: tempOrder.email || paymentInfo.payer.email,
        name: tempOrder.name,     // Recuperado de TempOrder
        address: tempOrder.address // Recuperado de TempOrder
    });

    console.log(`✅ Orden ${newOrder._id} creada exitosamente.`);

    // 3. Borrar la TempOrder
    await TempOrder.deleteOne({ _id: tempOrder._id });

  } catch (dbError) {
      console.error("❌ Error guardando orden en BD:", dbError);
      // Aquí podrías agregar lógica para guardar el error en un log o notificar al admin
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

      if (paymentInfo.status === 'approved') {
        await fulfillOrder(paymentInfo);
      } else {
        console.log(`ℹ️ Pago ${paymentId} recibido pero estado es: ${paymentInfo.status}`);
      }
    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
    }
  }
  
  res.sendStatus(200);
};