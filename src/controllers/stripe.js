const Product = require('../models/product');
const dotenv = require('dotenv');
dotenv.config();
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const TempOrder = require('../models/tempOrder');
const Order = require('../models/order');

exports.createSession = async (req, res) => {
  const { items, userId } = req.body;

  if (!items) {
    return res.status(400).json({ message: 'Items are required' });
  }

  const line_items = await Promise.all(
    items.map(async (item) => {
      const product = await Product.findById(item._id);
      if(!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if(product.offer > 0) {
        product.price = (product.price - (product.price * product.offer / 100)) * 100;
      }else {
        product.price = product.price * 100;
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            images: [`${process.env.PUBLIC_DOMAIN}/public/${product.productImages[0].img}`],
          },
          unit_amount: product.price,
        },
        quantity: item.quantity,
      };
    }
  ));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 30, // 30 minutes
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'], // Specify countries where shipping is allowed
      },
    });

    const tempOrder= await TempOrder.create({
      stripeSessionId: session.id,
      products: items.map(item => ({
        product: item._id,
        quantity: item.quantity,
      })),
    });

    if(userId) {
      tempOrder.user = userId;
      await tempOrder.save();
    }

    res.status(200).json({ session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong', error });
  }
}

async function fulfillOrder(session) {
  console.log('Fulfilling order', session);
  const tempOrder = await TempOrder.findOne({ stripeSessionId: session.id });
  if(!tempOrder) {
    return;
  }

  const order = await Order.create({
    user: tempOrder.user,
    products: tempOrder.products,
    totalAmount: session.amount_total / 100,
    paymentStatus: 'Paid',
    paymentType: 'Stripe',
    paymentInfo: {
      id: session.payment_intent,
      status: session.payment_status,
    },
    address: session.shipping_details.address,
    email: session.customer_details.email,
    name: session.customer_details.name,
  });

  await TempOrder.deleteOne({ stripeSessionId: session.id });

  console.log('Order fulfilled', order);

}

async function deleteTempOrder(session) {
  console.log('Deleting temp order', session);
  const tempOrder = await TempOrder.findOne({ stripeSessionId: session.id });
  if(!tempOrder) {
    return;
  }

  await TempOrder.deleteOne({ stripeSessionId: session.id });

  console.log('Temp order deleted', tempOrder);
}

exports.handleWebhook = async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  console.log('endpointSecret', endpointSecret)
  const payload = req.body;
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    const session = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Checkout session completed:', session);
    
        // Fulfill the purchase...
        fulfillOrder(session);

        break;
      case 'checkout.session.async_payment_succeeded':
        console.log('Checkout session async payment succeeded:', session);
    
        // Fulfill the purchase...
        fulfillOrder(session);

        break;
      case 'checkout.session.expired':
        console.log('Checkout session expired:', session);
    
        // Delete the temp order...
        deleteTempOrder(session);

        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(400).json({ message: 'Webhook error', error: error.message });
  }
}


