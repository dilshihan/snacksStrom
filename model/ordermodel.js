const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderDate: {
        type: Date,
        default: Date.now
    },
    customerName: {
        type: String,
        required: true
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            productName: String, 
            quantity: {
                type: Number,
                required: true
            },
            price: {
                type: Number,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Cash on Delivery', 'Credit Card', 'UPI', 'Net Banking'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
