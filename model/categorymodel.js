const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true, 
    },
    description: {
        type: String,
        required: false,
        trim: true,
    },
    isListed: {
        type: Boolean,
        default: true,  
    },
    offer: {
        type: Number,
        min: 0,
        max: 70,
        default: 0
    }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
