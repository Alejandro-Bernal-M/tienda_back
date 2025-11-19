const express = require('express');
const router = express.Router();
const { ordersIndex, addOrder, getOrder, updateOrderStatus, deleteOrder, getUserOrders, getOrdersByStatus, getOrdersByPaymentStatus, updatePaymentStatus, updatePaymentInfo, getOrdersByPaymentType} = require('../controllers/order');
const { requireSignin, requireAdmin } = require('../common-middlewares');

router.get('/orders', requireSignin, requireAdmin, ordersIndex);
router.post('/order', addOrder);
router.get('/order/:orderId', getOrder);
router.put('/order/:orderId', requireSignin, requireAdmin, updateOrderStatus);
router.delete('/order/:orderId', requireSignin, requireAdmin, deleteOrder);
router.get('/user/orders/:userId', requireSignin, getUserOrders);
router.get('/orders/status/:status', requireSignin, requireAdmin, getOrdersByStatus);
router.get('/orders/payment-status/:status', requireSignin, requireAdmin, getOrdersByPaymentStatus);
router.put('/order/payment-status/:orderId', requireSignin, requireAdmin, updatePaymentStatus);
router.put('/order/payment-info/:orderId', requireSignin, requireAdmin, updatePaymentInfo);
router.get('/orders/payment-type/:paymentType', requireSignin, requireAdmin, getOrdersByPaymentType);

module.exports = router;