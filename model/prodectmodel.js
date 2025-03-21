const { status } = require("init");
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true }, 
    description: { type: String, trim: true },
    image: { type: [String],required: true }, 
    category: { 
        type: String,  
        ref: 'Category',  
        required: true
    },
    offer: {
        type: Number,
        default: 0,  
        min: 0,
        max: 70
    },
    discountedPrice: {
        type: Number,
        default: function() {
            return this.price;
        }
    },
    createdAt: { type: Date, default: Date.now },
    isListed: {
        type: Boolean,
        default: true,  
    }
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;

