const Order = require('../models/order');

exports.ordersIndex = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'firstName lastName email');
    if (!orders) {
      return res.status(404).json({ message: 'No orders found' });
    }
    res.status(200).json({ orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.addOrder = async (req, res) => {
  const { userId, address, phone, totalAmount, products, paymentType, paymentStatus, paymentInfo } = req.body;
  const order = new Order({
    user: userId,
    address,
    phone,
    totalAmount,
    products,
    paymentType,
    paymentStatus,
    paymentInfo
  });

  try {
    const savedOrder = await order.save();
    if (!savedOrder) {
      return res.status(404).json({ message: 'Order not saved' });
    }
    res.status(200).json({ savedOrder });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.getOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order
      .findById(orderId)
      .populate('user', 'firstName lastName email')
      .exec();
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ order });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { orderStatus } = req.body;

  try {
    const updatedOrder = await Order.findOneAndUpdate({ _id: orderId }, { orderStatus }, { new: true });
    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ updatedOrder });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.deleteOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const deletedOrder = await Order.findOneAndDelete({ _id: orderId });
    if (!deletedOrder) {
      return res.status(404).json({ message: 'Error deleting order' });
    }
    res.status(200).json({ deletedOrder });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.getUserOrders = async (req, res) => {
  const { userId } = req.params;

  try {
    const orders = await Order.find({ user: userId });
    if (!orders) {
      return res.status(404).json({ message: 'No orders found' });
    }
    res.status(200).json({ orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.getOrdersByStatus = async (req, res) => {
  const { status } = req.params;

  try {
    const orders = await Order.find({ orderStatus: status });
    if (!orders) {
      return res.status(404).json({ message: 'No orders found' });
    }
    res.status(200).json({ orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.getOrdersByPaymentStatus = async (req, res) => {
  const { status } = req.params;

  try {
    const orders = await Order
      .find({ paymentStatus: status })
      .populate('user', 'firstName lastName email')
      .exec();
    if (!orders) {
      return res.status(404).json({ message: 'No orders found' });
    }
    res.status(200).json({ orders });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.updatePaymentStatus = async (req, res) => {
  const { orderId } = req.params;
  const { paymentStatus } = req.body;

  try {
    const updated = await Order.findOneAndUpdate({ _id: orderId }, { paymentStatus }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ updated });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.updatePaymentInfo = async (req, res) => {
  const { orderId } = req.params;
  const { paymentInfo } = req.body;

  try {
    const updated = await Order.findByIdAndUpdate({ _id: orderId }, { paymentInfo }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ updated });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}

exports.getOrdersByPaymentType = async (req, res) => {
  const { paymentType } = req.params;

  try {
    const orders = await Order.find({ paymentType });
    if (!orders) {
      return res.status(404).json({ message: 'No orders found' });
    }
    res.status(200).json({ orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong', error });
  }
}




