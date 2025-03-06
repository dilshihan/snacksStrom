const mongoose = require('mongoose');

const userschema = new mongoose.Schema({
    name: { type: String},
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String},
    password: { type: String, required: true },
    image: { type: String }, // URL to the profile image
    googleId: { type: String, unique: true, sparse: true }, // Google ID for OAuth login
    joinDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Banned'], default: 'Active' }
});

module.exports = mongoose.model('user', userschema);
