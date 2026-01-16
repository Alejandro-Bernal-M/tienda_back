// 1. Cargar variables de entorno AL PRINCIPIO
const dotenv = require('dotenv');
dotenv.config();

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto'); // Para generar referencias únicas
const Product = require('../models/product');
const TempOrder = require('../models/tempOrder');
const Order = require('../models/order');

// 2. Validación de Token (Para evitar errores silenciosos)
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
    const { items, userId } = req.body;

    // Validación básica
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "El carrito está vacío" });
    }

    // URL del Backend (Túnel Serveo/Cloudflare) para el Webhook
    // Si no está definida, usa localhost (aunque el webhook no funcionará en localhost)
    const backendUrl = process.env.PUBLIC_DOMAIN || 'http://localhost:2000';
    
    // URL del Frontend (Localhost) para redirigir al usuario
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    console.log("🔗 Webhook irá a:", backendUrl);
    console.log("🔗 Usuario volverá a:", frontendUrl);

    const externalReference = crypto.randomUUID(); 
    let calculatedTotal = 0;
    
    console.log(`🔄 Procesando ${items.length} productos...`);

    // 3. ARMADO DE ITEMS (BLINDADO)
    const itemsForMP = await Promise.all(items.map(async (item) => {
      const product = await Product.findById(item._id);
      if (!product) throw new Error(`Producto no encontrado en DB: ${item._id}`);

      // a. Cálculo de precio
      let finalPrice = product.price;
      if (product.offer > 0) {
        finalPrice = product.price - (product.price * product.offer / 100);
      }
      
      // IMPORTANTE: Redondear para evitar errores en COP
      finalPrice = Math.round(finalPrice); 

      calculatedTotal += finalPrice * item.quantity;

      // b. Manejo Seguro de Imágenes (Para que no explote si no hay foto)
      let pictureUrl = 'https://www.mercadopago.com/org-img/MP3/home/logomp3.gif'; // Default
      
      if (product.productImages && product.productImages.length > 0) {
         // Si la imagen ya es una URL completa, úsala. Si es relativa, pégale el dominio.
         const img = product.productImages[0].img;
         if (img.startsWith('http')) {
            pictureUrl = img;
         } else {
            // Asumiendo que sirves estáticos en /public
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

    // 4. CREAR OBJETO DE PREFERENCIA
    const body = {
      items: itemsForMP,
      external_reference: externalReference, // Clave para conciliar pago
      payer: {
         // Si tienes datos del usuario, agrégalos aquí (email, name)
      },
      back_url: {
        success: `${frontendUrl}/checkout/success`,
        failure: `${frontendUrl}/checkout/failure`,
        pending: `${frontendUrl}/checkout/pending`
      },
      auto_return: "approved", 
      
      // El Webhook SÍ debe ser HTTPS público (Serveo/Cloudflare)
      notification_url: `${backendUrl}/api/payment/webhook`,
      
      metadata: {
        user_id: userId || null 
      }
    };

    console.log("📤 Enviando preferencia a Mercado Pago...");

    const preference = new Preference(client);
    const result = await preference.create({ body });

    console.log("✅ Preferencia creada. ID:", result.id);

    // 5. GUARDAR ORDEN TEMPORAL
    await TempOrder.create({
      preferenceId: result.id, 
      externalReference: externalReference,
      user: userId || null,
      products: items.map(i => ({ product: i._id, quantity: i.quantity })),
      totalAmount: calculatedTotal
    });

    // Responder con la URL de pago
    res.status(200).json({ url: result.init_point });

  } catch (error) {
    console.error('❌ Error CRÍTICO en createPreference:', error);
    // Devolvemos JSON 500 para evitar el error genérico de CORS en el frontend
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
    const newOrder = await Order.create({
        user: tempOrder.user,
        products: tempOrder.products,
        totalAmount: paymentInfo.transaction_amount,
        paymentStatus: paymentInfo.status === 'approved' ? 'paid' : paymentInfo.status,
        paymentType: 'MercadoPago',
        paymentInfo: {
            id: paymentInfo.id,
            status: paymentInfo.status,
            type: paymentInfo.payment_type_id
        },
        email: paymentInfo.payer.email,
        createdAt: new Date(),
    });

    console.log(`✅ Orden ${newOrder._id} creada exitosamente.`);

    // 3. Borrar la TempOrder
    await TempOrder.deleteOne({ _id: tempOrder._id });

  } catch (dbError) {
      console.error("❌ Error guardando orden en BD:", dbError);
  }
}

// --- WEBHOOK ---
exports.handleWebhook = async (req, res) => {
  const query = req.query;
  // MP a veces manda topic o type
  const topic = query.topic || query.type; 

  console.log("🔔 Webhook recibido. Topic:", topic);

  if (topic === 'payment') {
    try {
      const paymentId = query.id || query['data.id'];
      
      if (!paymentId) return res.sendStatus(200);

      // Consultar estado real a MP
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
  
  // Responder siempre 200 para que MP no reintente infinitamente
  res.sendStatus(200);
};