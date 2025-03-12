const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderDate: {
        type: Date,
        default: Date.now
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
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
            },
            status: {
                type: String,
                enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
                default: 'Pending'
            },
            canceledAt: {
                type: Date
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'credit', 'UPI', 'Net Banking'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    shippingAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
