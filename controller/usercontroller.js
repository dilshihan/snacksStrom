const userschema = require('../model/usermodel')
const Productmodel = require('../model/prodectmodel')
const bcrypt = require('bcrypt')
const saltround = 10
const nodemailer = require('nodemailer')
const Category = require('../model/categorymodel')
const cartmodel = require('../model/cartmodel')
const addressmodel = require('../model/addressmodel')
const Order = require("../model/ordermodel")
const wishlistmodel = require('../model/wishlistmodel')
const couponmodel = require('../model/couponmodel')
const walletmodel = require('../model/walletmodel')
const { use } = require('passport')
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const usermodel = require('../model/usermodel')
const PDFDocument = require('pdfkit');
const path = require('path');
const crypto = require('crypto');





const OTPs = new Map();

const transporter = nodemailer.createTransport({    
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const registerUser = async (req, res) => {
    try {
        const {email, password } = req.body;

        const user = await userschema.findOne({ email });
        if (user) return res.render('user/register', { message: 'User already exists' });

        const otp = generateOTP();
        
        req.session.otp=otp // Store OTP temporarily
        req.session.email=email
        req.session.password=password
        // Send OTP to email
        await transporter.sendMail({
            from: 'mohddilshan1234321@gmail.com',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}`
        });
        res.render('user/verify', { email, message: 'OTP sent to your email' });

    } catch (error) {
        console.log(error);
        res.render('user/register', { message: 'Something went wrong' });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { otp, email } = req.body;
        const storedOTP = req.session.otp;

        if (!storedOTP || storedOTP !== parseInt(otp)) {
            return res.render('user/verify', { email, message: 'Invalid OTP' });
        } 

        const hashedPassword = await bcrypt.hash(req.session.password, saltround);
        const user = new userschema({ email: req.session.email, password: hashedPassword, authType: 'normal' });
        await user.save();

        req.session.otp = null; // Remove OTP after verification

        
        const products = await Productmodel.find({});
        const catogorys=await Category.find({})
        req.session.user = user._id; //Store ObjectId

        res.render('user/home', { products,user, message: 'Account created successfully' ,catogorys});

    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

const resendOTP = async (req, res) => { 
    try { 
        const email = req.session.email; 
        if (!email) {
            return res.render('user/verify', { message: 'Please start the registration process first.' });
        }
        const newOTP = generateOTP();
        req.session.otp = newOTP;  

        await transporter.sendMail({
            from: 'mohddilshan1234321@gamil.com',
            to: email,
            subject: 'Your OTP Code',
            text: `Your ResendOTP code is ${newOTP}`
        });
        res.render('user/verify', { email, message: 'A new OTP has been sent to your email' });

    } catch (error) {
        console.log(error);
        res.render('user/verify', { message: 'Something went wrong.' });
    }
};

const loadforgotpassword = async(req,res)=>{
    try{
        res.render('user/forgotpassword')
    }catch(error){
        console.log(error);
        res.status(500).send("Internal Server Error");
        
    }
}

const forgetsendotp = async (req,res)=>{
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const user = await userschema.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found with this email" });
        }
        const otp = generateOTP();
        req.session.otp = otp;
        req.session.email = email;
        req.session.otpExpires = Date.now() + 1 * 60 * 1000;

        await transporter.sendMail({
            from: 'mohddilshan1234321@gmail.com',
            to: email,
            subject: 'Your OTP for Password Reset',
            text:  `Your OTP is: ${otp}. This OTP is valid for 1 minutes.`
        });
       
        res.json({ message: "OTP sent successfully", email });
    }catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const loadforgotPasswordotp= (req, res) => {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).send("Email is required");
        }
        res.render('user/forgotpasswordotp', { email }); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

const forgotverifyotp = async(req,res)=>{
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }
        if (!req.session.otp || !req.session.email || !req.session.otpExpires) {
            return res.status(400).json({ message: "No OTP found. Please request a new one." });
        }
        if (Date.now() > req.session.otpExpires) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        if (String(req.session.otp) !== String(otp)) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        if (req.session.email !== email) {
            return res.status(400).json({ message: "Email does not match. Please try again." });
        }
        req.session.otp = null;
        req.session.email = null;
        req.session.otpExpires = null;

        res.json({ message: "OTP verified successfully", success: true });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const newpassword = async(req,res)=>{
    try{
        const email = req.query.email;  
        if (!email) {
            return res.status(400).send("Email is required");
        }
        res.render('user/newpassword',{email})
    }catch(error){
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
}

const resetpassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({success: false,message: "Email and password are required"});
        }

        const user = await userschema.findOne({ email });
        if (!user) {return res.status(404).json({success: false,message: "User not found"});
        }

        const hashedPassword = await bcrypt.hash(password, saltround);
        await userschema.findOneAndUpdate(
            { email },
            { 
                password: hashedPassword,
                $unset: { resetPasswordToken: "", resetPasswordExpires: "" } 
            }
        );

        res.json({success: true,message: "Password has been reset successfully"});

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false,message: "An error occurred while resetting password"});
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userschema.findOne({ email });

        if (!user) {
            return res.render("user/register", { message: "User does not exist" });
        }

        if (user.status === "Banned") { 
            return res.render("user/register", { message: "User email blocked, please try another email" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render("user/register", { message: "Invalid password" });
        }

        req.session.user = user._id; 
        req.session.email = user.email;
        res.redirect("/user/home");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

const loadregister = async (req,res)=>{
    res.render('user/register',{message:''})
}   

const Loadhome = async (req, res) => {
    try {
        const userid = req.session.user;
        const user = await userschema.findById(userid);
        
        const products = await Productmodel.find({ isListed: true })
            .select('name price image category isListed offer').sort({ createdAt: -1 }).lean();
            
        const categories = await Category.find().lean();
        const categoryOffersMap = new Map(
            categories.map(cat => [cat.name.toLowerCase(), cat.offer || 0])
        );
        const productsWithDiscount = products.map(product => {
            const productOffer = product.offer || 0;
            const categoryOffer = categoryOffersMap.get(product.category.toLowerCase()) || 0;
            const maxOffer = Math.max(productOffer, categoryOffer);
            const discountedPrice = maxOffer ? Math.round(product.price - (product.price * maxOffer / 100)) : product.price;
            
            return {
                ...product,
                maxOffer: maxOffer,
                offer: maxOffer,
                discountedPrice: discountedPrice,
                offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
                originalPrice: product.price
            };
        });

        res.render("user/home", { 
            products: productsWithDiscount,
            catogorys: categories,
            user 
        }); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

const loadmenu = async (req, res) => {
    try {
        const userid = req.session.user;
        const user = await userschema.findById(userid);
        const priceRange = req.query.priceRange;
        const sortBy = req.query.sortBy || 'default';
        const category = req.query.category || 'all';
        const searchQuery = req.query.search || ''; 
        const filter = { isListed: true };

        if (category && category !== 'all') {
            filter.category = category.toLowerCase();
        }

if (priceRange) {
    switch (priceRange) {
        case 'under100':
            filter.$expr = { $lt: [ { $subtract: ['$price',{ $multiply: ['$price',{ $divide: [{ $ifNull: ['$offer', 0] },100]}]}]},100]};break;
        case '100-300':
            filter.$expr = {$and: [{ $gte: [{$subtract: ['$price',{$multiply: ['$price',{$divide: [{ $ifNull: ['$offer', 0] },100]}]}]},100]},
        {$lte: [{$subtract: ['$price',{$multiply: ['$price',{$divide: [{ $ifNull: ['$offer', 0] },100]}]}]},300]}]};break;
        case '300-500':
            filter.$expr = {
        $and: [{$gte: [{$subtract: ['$price',{$multiply: ['$price',{$divide: [{ $ifNull: ['$offer', 0] },100]}]}]},300]},
        {$lte: [{$subtract: ['$price',{$multiply: ['$price',{ $divide: [{ $ifNull: ['$offer', 0] },100]}]}]},500]}]};break;}
    }
        if (searchQuery) {
            filter.name = { $regex: searchQuery, $options: 'i' }; 
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const totalProducts = await Productmodel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        let query = Productmodel.find(filter)
            .select('name price image category isListed offer')
            switch (sortBy) {
                case 'price-low-high':
                    query = query.sort({ price: 1 });
                    break;
                case 'price-high-low':
                    query = query.sort({ price: -1 });
                    break;
                case 'name-a-z':
                    query = query.sort({ name: 1 });
                    break;
                case 'name-z-a':
                    query = query.sort({ name: -1 });
                    break;
                default:
                    query = query.sort({ createdAt: -1 });
            }
        
        const categories = await Category.find().lean();
        const categoryOffersMap = new Map(
            categories.map(cat => [cat.name.toLowerCase(), cat.offer || 0])
        );

        const products = await query.skip(skip).limit(limit).lean();
        
        const productsWithDiscount = products.map(product => {
            const productOffer = product.offer || 0;
            const categoryOffer = categoryOffersMap.get(product.category.toLowerCase()) || 0;
            const maxOffer = Math.max(productOffer, categoryOffer);
            const discountedPrice = maxOffer ? Math.round(product.price - (product.price * maxOffer / 100)) : product.price;
            
            return {
                ...product,
                maxOffer: maxOffer,
                offer: maxOffer,
                discountedPrice: discountedPrice,
                offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
                originalPrice: product.price
            };
        });

        let noProductsMessage = '';
        if (productsWithDiscount.length === 0) {
            noProductsMessage = 'No products found for your search criteria.';
        }

        const queryParams = new URLSearchParams({
            ...(priceRange && { priceRange }),
            ...(sortBy && { sortBy }),
            ...(category !== 'all' && { category }),
            ...(searchQuery && { search: searchQuery }) 
        }).toString();

        return res.render("user/menu", {
            products: productsWithDiscount,
            user,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            selectedPriceRange: priceRange || 'all',
            selectedSort: sortBy,
            selectedCategory: category,
            queryParams,
            noProductsMessage 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}

const loadabout = async (req,res)=>{
    try{
        const   userid = req.session.user
        const user = await userschema.findById(userid) 
        res.render('user/about',{user})
    }catch(error){
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
}

const loadcontactus = async(req,res)=>{
    try{
        const   userid = req.session.user
        const user = await userschema.findById(userid) 
        res.render('user/contactus',{user})
    }catch(error){
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
}

const Productdetails = async (req, res) => {
    try { 
        const userid = req.session.user 
        const user = await userschema.findById(userid)
        const products = await Productmodel.findById(req.params.id).lean();
        
        if (!products) {
            return res.redirect('/user/menu');
        }

        const category = await Category.findOne({name: { $regex: new RegExp(products.category, 'i') } }).lean();
        const productOffer = products.offer || 0;
        const categoryOffer = category?.offer || 0;
        const maxOffer = Math.max(productOffer, categoryOffer);
        const discountedPrice = maxOffer ? Math.round(products.price - (products.price * maxOffer / 100)) : products.price;
        
        const productWithOffer = {
            ...products,
            maxOffer,
            offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
            discountedPrice,
            originalPrice: products.price
        };

        let isInWishlist = false;
        if (userid) {
            const wishlist = await wishlistmodel.findOne({userId: userid,'products.productId': req.params.id });
            isInWishlist = !!wishlist;
        }
        
        let isInCart = false;
        if (userid) {
            const cart = await cartmodel.findOne({userId: userid,'products.productId': req.params.id});
            isInCart = !!cart;
        }
        const relatedProducts = await Productmodel.find({
            category: products.category,_id: { $ne: req.params.id }}).limit(4).lean();
        
        const relatedProductsWithDetails = await Promise.all(
            relatedProducts.map(async (product) => {
                const productOffer = product.offer || 0;
                const maxOffer = Math.max(productOffer, categoryOffer);
                const discountedPrice = maxOffer ? Math.round(product.price - (product.price * maxOffer / 100)) : product.price;
                
                const isInWishlist = await wishlistmodel.findOne({
                    userId: userid,
                    'products.productId': product._id
                });

                return {
                    ...product,
                    maxOffer,
                    offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
                    discountedPrice,
                    originalPrice: product.price,
                    isInWishlist: !!isInWishlist,
                    isInCart: !!isInCart
                };
            })
        );

        res.render('user/productdetails', { 
            products: productWithOffer,
            relatedProducts: relatedProductsWithDetails,
            user,
            isInWishlist,
            isInCart
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}

const loadcart = async (req, res) => {
    try {
        const userId = req.session?.user
        if (!userId) {
            return res.render("user/cart", { cart: [], totalPrice: 0 });
        }

        const user = await userschema.findById(userId);
        const cart = await cartmodel.findOne({ userId })
         .populate({path: "products.productId",select: "name image price category offer stock"});

        if (!cart || cart.products.length === 0) {
            return res.render("user/cart", { cart: [], totalPrice: 0, user });
        }
        const categories = await Category.find().lean();
        const categoryOffersMap = new Map(
            categories.map(cat => [cat.name.toLowerCase(), cat.offer || 0])
        );        

        const cartItems = cart.products.map((item) => {
            const product = item.productId;
            const productOffer = product.offer || 0;
            const categoryOffer = categoryOffersMap.get(product.category.toLowerCase()) || 0;
            const maxOffer = Math.max(productOffer, categoryOffer);
            const discountedPrice = maxOffer ? 
                Math.round(product.price - (product.price * maxOffer / 100)) : 
                product.price;

            return {
                id: product._id,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: item.quantity,
                maxOffer,
                offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
                discountedPrice,
                originalPrice: product.price,
                stock: product.stock
            };
        });

        const totalPrice = cartItems.reduce((total, item) => 
            total + (item.discountedPrice * item.quantity), 0
        );

        res.render("user/cart", { 
            cart: cartItems, 
            totalPrice,
            user,
            userId
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

const addtocart = async (req, res) => {
    try {
      const { userId, productId, quantity } = req.body;
      if (!userId || !productId || !quantity) {
        return res.status(400).json({ success: false, message: "Missing required fields!" });
      }
  
      const product = await Productmodel.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found!" });
      }
  
      let cart = await cartmodel.findOne({ userId });
      if (!cart) {
        cart = new cartmodel({ userId, products: [], totalPrice: 0 });
      }
  
      const existingProductIndex = cart.products.findIndex(
        (item) => item.productId.toString() === productId
      );
      const existingQuantity = existingProductIndex !== -1 ? cart.products[existingProductIndex].quantity : 0;
      const totalQuantity = existingQuantity + quantity;
  
      if (totalQuantity > 5) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than 5 units of this product to the cart!`
        });
      }
      if (totalQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more items. Only ${product.stock} units available in stock!`
        });
      }
  
      if (existingProductIndex !== -1) {
        cart.products[existingProductIndex].quantity = totalQuantity;
      } else {
        cart.products.push({productId,quantity,});
      }
  

      cart.totalPrice = 0;
      for (let item of cart.products) {
        const product = await Productmodel.findById(item.productId);
        if (product) {
          cart.totalPrice += product.price * item.quantity;
        }
      }
      await cart.save();
  
      res.json({ success: true, message: "Product added to cart!", cart });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
};

const updatecartquantity = async (req, res) => {
    try {
        const userId = req.session?.user;
        const { productId, change } = req.body;
        const max = 5; 

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const cart = await cartmodel.findOne({ userId }).populate("products.productId");
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const productIndex = cart.products.findIndex(
            item => item.productId._id.toString() === productId
        );

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in cart" });
        }
        const product = await Productmodel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const newQuantity = cart.products[productIndex].quantity + parseInt(change);

        if (newQuantity < 1) {
            return res.status(400).json({ success: false, message: "Quantity cannot be less than 1" });
        }

        if (newQuantity > max) {
            return res.status(400).json({ 
                success: false, 
                message: "Maximum quantity limit is 5 items per product" 
            });
        }

        if (newQuantity > product.stock) {
            return res.status(400).json({ success: false, message: "Not enough stock available" });
        }
        cart.products[productIndex].quantity = newQuantity;

        cart.totalPrice = cart.products.reduce((total, item) => {
            return total + (item.productId.price * item.quantity);
        }, 0);

        await cart.save();

        const cartItems = cart.products.map((item) => ({
            id: item.productId._id,
            name: item.productId.name,
            image: item.productId.image,
            price: item.productId.price,
            quantity: item.quantity,
        }));

        const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

        res.json({ 
            success: true, 
            message: "Quantity updated successfully",
            cart: cartItems,
            totalPrice,
            newQuantity
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const removefromcart = async (req, res) => {
    try {
        const userId = req.session?.user;
        const productId = req.params.productId; 

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const cart = await cartmodel.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } }, 
            { new: true }
        ).populate("products.productId");

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const cartItems = cart.products.map((item) => ({
            id: item.productId._id,
            name: item.productId.name,
            image: item.productId.image,
            price: item.productId.price,
            quantity: item.quantity,
        }));

        const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

        res.json({ cart: cartItems, totalPrice, message: "Item removed successfully" });
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};  

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAYX_KEY_ID,
    key_secret: process.env.RAZORPAYX_KEY_SECRET 
});

const loadcheckout = async (req,res)=>{
    try{
        const userId = req.session?.user
        const user = await userschema.findById(userId)
        if (!user) {
            return res.status(404).send("User not found");
        }

        const addresses = await addressmodel.find({ userId: user._id });
        if (!addresses.length) {
            return res.render('user/checkout', { defaultAddress: null });
        }

        const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];
        const cart = await cartmodel.findOne({ userId })
            .populate({path: "products.productId",select: "name image price category offer stock"});

        if (!cart || cart.products.length === 0) {
            return res.render("user/checkout", { 
                user, 
                defaultAddress,
                addresses, 
                cart: [], 
                totalPrice: 0 
            });
        }
        const wallet = await walletmodel.findOne({ userId });
        const walletBalance = wallet ? wallet.balance : 0;

        const categories = await Category.find().lean();
        const categoryOffersMap = new Map(
            categories.map(cat => [cat.name.toLowerCase(), cat.offer || 0])
        );

        const cartItems = cart.products.map((item) => {
            const product = item.productId;
            const productOffer = product.offer || 0;
            const categoryOffer = categoryOffersMap.get(product.category.toLowerCase()) || 0;
            const maxOffer = Math.max(productOffer, categoryOffer);
            const discountedPrice = maxOffer ? 
                Math.round(product.price - (product.price * maxOffer / 100)) : 
                product.price;

            return {
                id: product._id,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: item.quantity,
                maxOffer,
                discountedPrice,
                originalPrice: product.price,
                itemTotal: discountedPrice * item.quantity
            };
        });
        const totalAmount = cartItems.reduce((total, item) => total + item.itemTotal, 0); 
        const coupons = await couponmodel.find({
            isDeleted: false,
            expiryDate: { $gt: new Date() }, 
            minPurchase: { $lte: totalAmount },
            $or: [
                { usedBy: { $exists: false } }, 
                { usedBy: { $size: 0 } },
                { usedBy: { $not: { $elemMatch: { userId } } } } 
            ]
        });

        const paymentOrder = await razorpay.orders.create({
            amount: totalAmount * 100,  
            currency: "INR",
            receipt: `order_${new Date().getTime()}`,
            payment_capture: 1 
        });

        res.render('user/checkout', {
            user,
            defaultAddress,
            addresses,
            cart: cartItems,
            coupons,
            razorpayOrderId: paymentOrder.id, 
            razorpayKey: process.env.RAZORPAYX_KEY_ID,
            totalPrice: cartItems.reduce((total, item) => total + item.itemTotal, 0),
            walletBalance
        });
    } catch(error) {
        console.log(error)
        res.status(500).send("Error loading checkout page");
    }
}

const checkoutaddaddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { fullname, phoneNumber, streetAddress, city, state, zipCode,isDefault } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const isDefaultValue = isDefault === 'on';
        const existingDefaultAddress = await addressmodel.findOne({ userId, isDefault: true });
        if (isDefaultValue && existingDefaultAddress) {
            await addressmodel.updateOne({ userId, isDefault: true }, { isDefault: false });
        }
        const shouldBeDefault = !existingDefaultAddress || isDefaultValue;




        const newAddress = new addressmodel({
            userId,
            fullname,
            phoneNumber,
            streetAddress,
            city,
            state,
            zipCode,
            isDefault:shouldBeDefault

    
        });
        await newAddress.save();

        res.status(201).json({ success: true, message: 'Address saved successfully', address: newAddress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error - Unable to save address' });
    }
};

const checkoutchangeaddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { selectedAddressId } = req.body;

        if (!userId || !selectedAddressId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required information' 
            });
        }


        const selectedAddress = await addressmodel.findById(selectedAddressId);
        if (!selectedAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }
        await addressmodel.updateMany(
            { userId }, 
            { $set: { isDefault: false } }
        );

        const updatedAddress = await addressmodel.findOneAndUpdate(
            { _id: selectedAddressId, userId },
            { $set: { isDefault: true } },
            { new: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'Failed to update address' 
            });
        }

        res.json({ 
            success: true,message: 'Default address updated successfully',address: updatedAddress});

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false,message: 'Server error'});
    }
};

const loadordersuccess = async(req,res)=>{
    try{
        res.render('user/Ordersuccess')
    }catch(error){
        console.log(error)
        res.status(500).send("Internal Server Error");
    }
}

const addorderdetails = async(req, res) => {
    try {
        const { customerId, products, totalAmount, paymentMethod, addressId, couponOffer, paymentStatus, razorpay_payment_id } = req.body;
        
        if (!customerId || !products || !totalAmount || !paymentMethod) {
            return res.status(400).json({ success: false, message: "All fields are required!"});
        }
        const address = await addressmodel.findById(addressId);
        if (!address) {
            return res.status(400).json({ success: false, message: "Invalid address ID"});
        }

        for (const item of products) {
            const product = await Productmodel.findById(item.productId);
            if (!product) {
                return res.status(400).json({ success: false, message: `Product ${item.productName} not found` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${item.productName}. Only ${product.stock} units available.`  
                });
            }
        }
        if (couponOffer) {
            const coupon = await couponmodel.findOne({ discountAmount: couponOffer });
            if (coupon) {
                await couponmodel.findByIdAndUpdate(
                    coupon._id,
                    {
                        $push: {
                            usedBy: {
                                userId: customerId,
                                usedAt: new Date()
                            }
                        },
                        $inc: { usageLimit: -1 } 
                    },
                    { new: true }
                );
            }
        }
        const total = parseFloat(totalAmount) 
        const coupon = parseFloat(couponOffer) || 0
        const finalAmount = total - coupon;

        if (paymentMethod === 'wallet') {
            const userWallet = await walletmodel.findOne({ userId: customerId });
            
            if (!userWallet || userWallet.balance < finalAmount) {
                return res.status(400).json({success: false,message: "Insufficient wallet balance"});
            }

            await walletmodel.findOneAndUpdate(
                { userId: customerId },
                {
                    $inc: { balance: -finalAmount },
                    $push: {
                        transactions: {amount: finalAmount,type: 'debit',timestamp: new Date()}}});
         }
        
         const newOrder = new Order({
            customerId,
            products,
            totalAmount: finalAmount,
            paymentMethod,
            paymentStatus: razorpay_payment_id ? 'Paid' : (paymentStatus || (paymentMethod === 'cod' ? 'Pending' : (paymentMethod === 'wallet' ? 'Paid' : 'Pending'))),
            ...(paymentMethod === 'wallet' && {
                updatedWalletBalance: (await walletmodel.findOne({ userId: customerId })).balance
            }),
            couponApplied: couponOffer ? true : false,
            couponAmount: coupon,
            shippingAddress: {
                fullname: address.fullname,
                phoneNumber: address.phoneNumber,
                streetAddress: address.streetAddress,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                addressId: address.id 
            }
        });
        await newOrder.save();

        const stockUpdatePromises = products.map(item => 
            Productmodel.findByIdAndUpdate(item.productId,{ $inc: { stock: -item.quantity } },{ new: true }));
         await Promise.all(stockUpdatePromises);
    
        await cartmodel.findOneAndUpdate({ userId: customerId }, { $set: { products: [], totalPrice: 0 } });

        res.json({success: true,message: "Order placed successfully",order: newOrder});
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to place order" });
    }
};

const loaduserprofile = async(req,res)=>{
    try {
        const userid = req.session.user 
        const user = await userschema.findById(userid) 
        if (!user) {
            return res.status(404).render('error', { message: 'User not found' });
        }

        const page = parseInt(req.query.page) || 1;
        const activeTab = req.query.tab || 'profile';
        const productsPerPage = 3; 
        const addresses = await addressmodel.find({ userId: user._id }).sort({ createdAt: -1 }) || [];

        const allOrders = await Order.find({customerId: new mongoose.Types.ObjectId(user._id) })
            .sort({ orderDate: -1 }).populate('products.productId').populate('shippingAddress').lean();

        const processedOrders = allOrders.map(order => ({
            ...order,
            products: order.products.map(product => ({
                ...product,
                total: product.price * product.quantity
            }))
        }));

        const totalProducts = processedOrders.reduce((sum, order) => sum + order.products.length, 0);
        const totalPages = Math.ceil(totalProducts / productsPerPage);

        let productsSoFar = 0;
        let ordersToShow = [];
        
        for (let order of processedOrders) {
            let orderCopy = { ...order };
            
            if (productsSoFar + order.products.length <= (page - 1) * productsPerPage) {
                productsSoFar += order.products.length;
                continue;
            }

            const skipInThisOrder = Math.max(0, (page - 1) * productsPerPage - productsSoFar);
            const takeFromThisOrder = Math.min(
                productsPerPage - (ordersToShow.length > 0 ? ordersToShow.reduce((sum, o) => sum + o.products.length, 0) : 0),
                order.products.length - skipInThisOrder
            );
            
            if (takeFromThisOrder > 0) {
                orderCopy.products = order.products.slice(skipInThisOrder, skipInThisOrder + takeFromThisOrder);
                ordersToShow.push(orderCopy);
            }
            
            productsSoFar += order.products.length;
            if (ordersToShow.reduce((sum, o) => sum + o.products.length, 0) >= productsPerPage) {
                break;
            }
        }

        res.render('user/userprofile', {
            user,
            addresses,
            orders: ordersToShow,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            activeTab
        });

    } catch(error) {
        console.log(error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
}

const updateprofile = async(req,res)=>{
    try{
        const userId=req.session.user
        const {name,phoneNumber}=req.body

        const updateuser = await userschema.findByIdAndUpdate(userId,{ name: name, phoneNumber: phoneNumber},{new:true})
        if (!updateuser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.redirect('/user/userprofile')
    }catch(error){
        console.log(error)
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
}

const updateprofileimage = async(req,res)=>{
    try {
        const userId = req.session.user;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const imageUrl = `/uploads/profile_pictures/${req.file.filename}`;

        const updatedUser = await userschema.findByIdAndUpdate(
            userId, 
            { image: imageUrl }, 
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Profile image updated successfully', imageUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating profile image' });
    }
}

const addaddress = async (req, res) => {
    try {  
        const userId = req.session.user;
        const { fullName, phoneNumber, street, city, state, zipCode ,isDefault} = req.body;
        const existingDefaultAddress = await addressmodel.findOne({ userId, isDefault: true });
        if (isDefault === 'on' && existingDefaultAddress) {
            await addressmodel.updateOne({ userId, isDefault: true }, { isDefault: false });
        }
        const shouldBeDefault = !existingDefaultAddress || isDefault === 'on';

        
        const newAddress = new addressmodel({
            userId: userId,
            fullname:fullName,
            phoneNumber,
            streetAddress:street,
            city,
            state,
            zipCode,
            isDefault: shouldBeDefault,
            createdAt: new Date()
        });

        await newAddress.save();

        res.redirect('/user/userprofile?tab=addresses'); 
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error adding address' });
    }
};

const editaddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.body.id;
        const { fullName, phoneNumber, street, city, state, zipCode, isDefault } = req.body;
        if (isDefault === 'on') {
            await addressmodel.updateMany(
                { userId, _id: { $ne: addressId } },
                { isDefault: false }
            );
        }
        const updatedAddress = await addressmodel.findByIdAndUpdate(
            addressId,
            {
                fullname: fullName,
                phoneNumber,
                streetAddress: street,
                city,
                state,
                zipCode,
                isDefault: isDefault === 'on'
            },
            { new: true }
        );
        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        res.redirect('/user/userprofile?tab=addresses');
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error updating address' });
    }
};

const deleteaddress = async (req,res)=>{
    try {
        const addressId = req.params.id;
        const deletedAddress = await addressmodel.findByIdAndDelete(addressId);
        if (!deletedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const loadorderdetils = async(req,res) => {
    try {
        const userid = req.session.user;
        const user = await userschema.findById(userid);
        const orderId = req.query.orderId;
        const productId = req.query.productId;
    
        if (!orderId || !productId) {
            return res.status(400).send("Order ID and Product ID are required");
        }
    
        const order = await Order.findById(orderId)
        .populate('products.productId').populate('customerId').populate('shippingAddress').lean();
    
        if (!order) {
            return res.status(404).send("Order not found");
        }
    
        const productDetails = order.products.find(item => item._id.toString() === productId);
    
        if (!productDetails) {
            return res.status(404).send("Product not found in this order");
        }
    
        res.render('user/orderdetails', {
            order,
            user,
            productDetails,
            orderAddress: order.shippingAddress 
        });
    
    } catch(error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
}

const cancelorder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const productId = req.params.productId;
        const order = await Order.findOne({ _id: orderId, 'products._id': productId });
    
        if (!order) {
            return res.status(404).json({ success: false, message: "Order or product not found" });
        }
        const cancelledProduct = order.products.find(p => p._id.toString() === productId);
        
        if (!cancelledProduct) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }
        
        if (order.paymentMethod === 'razorpay' || order.paymentMethod === 'wallet') {
            const wallet = await walletmodel.findOne({ userId: order.customerId });
            if (wallet) {
                const refundAmount = cancelledProduct.price * cancelledProduct.quantity;
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit'
                });
                await wallet.save();
            }
        }
        
        await Productmodel.findByIdAndUpdate(
            cancelledProduct.productId,
            { $inc: { stock: cancelledProduct.quantity } }
        );
        const updatedOrder = await Order.findOneAndUpdate(
            { 
                _id: orderId,
                'products._id': productId 
            },
            { 
                $set: { 
                    'products.$.status': 'Cancelled',
                    'products.$.canceledAt': new Date()
                } 
            },
            { 
                new: true,
                runValidators: true
            }
        );
        res.json({
            success: true, message: "Product canceled successfully", updatedOrder
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error canceling product" });
    }
};

const updatepassword = async(req,res)=>{
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({success: false,message: 'All fields are required'});
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({success: false,message: 'New passwords do not match'});
        }

        const user = await userschema.findById(userId);
        if (!user) {
            return res.status(404).json({success: false, message: 'User not found'});
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({success: false,message: 'Current password is incorrect'});
        }

        const hashedPassword = await bcrypt.hash(newPassword, saltround);
        await userschema.findByIdAndUpdate(userId, { password: hashedPassword });

        res.json({success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({success: false,message: 'Error updating password'});
    }
}

const handleGoogleLogin = async (req, res) => {
    try {
        const { token, userData } = req.body;
           
        let user = await userschema.findOne({ email: userData.email });
        
        if (!user) {
            user = new userschema({
                email: userData.email,
                googleId: userData.sub,
                image:userData.picture,
                password: await bcrypt.hash(Math.random().toString(36).slice(-8), saltround),
                authType: 'google',
                status: 'Active'
            });
            await user.save();
        } else if (user.status === "Banned") {
            return res.json({
                success: false,
                message: "This account has been banned"
            });
        }

        // Set session
        req.session.user = user._id;
        req.session.email = user.email;

        res.json({
            success: true,
            message: "Successfully authenticated with Google"
        });

    } catch (error) {
        console.error("Google authentication error:", error);
        res.json({
            success: false,
            message: "Authentication failed"
        });
    }
};

const handleGoogleCallback = async (req, res) => {
    try {
        // Send a script that posts the token back to the opener window
        res.send(`
            <script>
                if (window.opener) {
                    const params = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = params.get('access_token');
                    
                    // Get user info from Google
                    fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: {
                            'Authorization': 'Bearer ' + accessToken
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        window.opener.postMessage({
                            type: 'google-auth',
                            userData: {
                                email: data.email,
                                name: data.name,
                                picture: data.picture
                            }
                        }, window.location.origin);
                        window.close();
                    })
                    .catch(error => {
                        console.error('Error fetching user info:', error);
                        window.close();
                    });
                }
            </script>
        `);
    } catch (error) {
        console.error('Google callback error:', error);
        res.status(500).send('Authentication failed');
    }
};

const loadwishlist = async(req,res)=>{
    try {
        const userid = req.session.user;
        const user = await userschema.findById(userid);
        const wishlist = await wishlistmodel.findOne({ userId: userid })
            .populate({path: 'products.productId',select: 'name price image stock category offer'}).lean();
        const categories = await Category.find().lean();
        const categoryOffersMap = new Map(
            categories.map(cat => [cat.name.toLowerCase(), cat.offer || 0])
        );
        const calculateOffers = (product) => {
            const productOffer = product.offer || 0;
            const categoryOffer = categoryOffersMap.get(product.category.toLowerCase()) || 0;
            const maxOffer = Math.max(productOffer, categoryOffer);
            const discountedPrice = maxOffer ? Math.round(product.price - (product.price * maxOffer / 100)) : product.price;

            return {
                ...product,
                maxOffer,
                offerType: maxOffer === categoryOffer && categoryOffer > 0 ? 'category' : 'product',
                discountedPrice,
                originalPrice: product.price
            };
        };
        const wishlistItems = wishlist ? wishlist.products.map(item => ({
            ...item,
            productId: calculateOffers(item.productId)
        })) : [];

        const productCategories = wishlistItems.map(item => item.productId.category);
        const relatedProductsRaw = await Productmodel.find({
            category: { $in: productCategories },
            _id: { $nin: wishlistItems.map(item => item.productId._id) },isListed: true,stock: { $gt: 0 }
        }).select('name price image stock category offer').limit(4).lean();

        const relatedProducts = relatedProductsRaw.map(product => calculateOffers(product));

        res.render('user/wishlist', {
            user,
            wishlistItems,
            relatedProducts,
            userId: userid 
        });
    } catch(error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
}

const addtowishlist = async (req, res) => {
        try {
            const userId = req.session.user;
            const productId = req.body.productId;
    
            if (!userId || !productId) {
                return res.status(400).json({success: false,message: 'Missing required information'});
            }
            let wishlist = await wishlistmodel.findOne({ userId });
            
            if (!wishlist) {
                wishlist = new wishlistmodel({userId,products: [{ productId }]});
            } else {
                const existingProduct = wishlist.products.find(
                    item => item.productId.toString() === productId);
    
                if (existingProduct) {
                    return res.json({success: false,message: 'Product already in wishlist'});
                }
    
                wishlist.products.push({ productId });
            }
            await wishlist.save();
            return res.json({success: true,message: 'Product added to wishlist successfully'});
    
        } catch (error) {
            console.error(error);
            return res.status(500).json({success: false,message: 'Error adding product to wishlist'});
        }
};

const removefromwishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.productId;

        if (!userId || !productId) {
            return res.status(400).json({success: false,message: 'Missing required information'});
        }

        const result = await wishlistmodel.findOneAndUpdate(
            { userId },{ $pull: { products: { productId: productId } } },{ new: true });

        if (!result) {
            return res.status(404).json({success: false,message: 'Wishlist not found'});
        }

        res.json({success: true,message: 'Product removed from wishlist successfully'});

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false,message: 'Error removing product from wishlist'});
    }
};

const loadwallet = async (req, res) => {
    try {
        const userId = req.session?.user;
        const user = await usermodel.findById(userId);
        let wallet = await walletmodel.findOne({ userId });

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        if (!wallet) {
            wallet = new walletmodel({ userId, balance: 0, transactions: [] });
            await wallet.save();
        }
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const paginatedTransactions = wallet.transactions.slice(skip, skip + limit);

        res.render('user/wallet', {
            user,
            wallet: {
                ...wallet.toObject(),
                transactions: paginatedTransactions
            },
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            formatDate: (date) => {
                return new Date(date).toLocaleString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).send('Something went wrong');
    }
}

const addMoney = async (req, res) => {
    try {
        const userId = req.session.user; 
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({success: false,message: 'Invalid amount'});
        }

        let wallet = await walletmodel.findOne({ userId });
        if (!wallet) {
            wallet = new walletmodel({ userId });
        }

        wallet.transactions.push({amount: parseFloat(amount),type: 'credit',timestamp: new Date()});

        wallet.balance += parseFloat(amount);
        await wallet.save();
        res.json({success: true,message: 'Money added successfully',wallet: {balance: wallet.balance,transactions: wallet.transactions}});

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false,message: 'Failed to add money to wallet'});
    }
};

const downloadinvoice = async(req,res)=>{
    try {
        const orderId = req.params.orderId;
        
        const order = await Order.findById(orderId).populate('products.productId').populate('shippingAddress');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const doc = new PDFDocument({
            margin: 50
        });
        
        res.setHeader('Content-disposition', `attachment; filename=invoice-${orderId}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(25).text(' SNACK STORM', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text('Invoice', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12);
        doc.text(`Order ID: ${orderId}`);
        doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
        doc.moveDown();

        doc.fontSize(14).text('Shipping Address', { underline: true });
        doc.fontSize(12);
        doc.text(`Name: ${order.shippingAddress.fullname}`);
        doc.text(`Phone: ${order.shippingAddress.phoneNumber}`);
        doc.text(`Address: ${order.shippingAddress.streetAddress}`);
        doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.zipCode}`);
        doc.moveDown();

        doc.fontSize(14).text('Product Details', { underline: true });
        doc.moveDown();

        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = [200, 80, 80, 80, 80];
        const rowHeight = 30;
        const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
        
        doc.fontSize(12).font('Helvetica-Bold');
        const headers = ['Product', 'Price', 'Quantity', 'Tax (10%)', 'Total'];
        let currentX = tableLeft;
        doc.rect(tableLeft, tableTop, tableWidth, rowHeight).stroke();
        
        headers.forEach((header, i) => {
            if (i > 0) {
                doc.moveTo(currentX, tableTop)
                   .lineTo(currentX, tableTop + rowHeight)
                   .stroke();
            }
            
            doc.text(header, currentX + 5, tableTop + 10, {
                width: colWidths[i] - 10,
                align: 'left'
            });
            currentX += colWidths[i];
        });
        let currentY = tableTop + rowHeight;
        doc.fontSize(12).font('Helvetica');

        let subtotal = 0;
        let totalTax = 0;

        order.products.forEach((product, index) => {
            if (product.status !== 'Cancelled') {
                const productTotal = product.price;
                const taxRate = 0.1; 
                const productTax = productTotal * taxRate;
                const total = productTotal + productTax;
                doc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke();
                
                currentX = tableLeft;
                [
                    product.productId.name,
                    `${product.price.toFixed(2)}`,
                    product.quantity.toString(),
                    `${productTax.toFixed(2)}`,
                    `${total.toFixed(2)}`
                ].forEach((text, i) => {
                    if (i > 0) {
                        doc.moveTo(currentX, currentY)
                           .lineTo(currentX, currentY + rowHeight)
                           .stroke();
                    }
                    
                    doc.text(text, currentX + 5, currentY + 10, {
                        width: colWidths[i] - 10,
                        align: 'left'
                    });
                    currentX += colWidths[i];
                });

                currentY += rowHeight;
                subtotal += productTotal;
                totalTax += productTax;
            }
        });
        currentX = tableLeft;
        headers.forEach((_, i) => {
            if (i > 0) {
                doc.moveTo(currentX, tableTop)
                   .lineTo(currentX, currentY)
                   .stroke();
            }
            currentX += colWidths[i];
        });
        doc.rect(tableLeft, tableTop, tableWidth, currentY - tableTop).stroke();
        doc.y = currentY + 20;
        const shippingCharge = 5;
        const totalAmount = order.totalAmount;
        let updatedOrderTotal = 0;
        
        order.products.forEach(product => {
            if (product.status === 'Cancelled') {
                updatedOrderTotal += product.price;
            }
        });
        
        const finalOrderTotal = totalAmount - updatedOrderTotal;
        const discount = (subtotal + shippingCharge + totalTax) - finalOrderTotal;

        doc.moveDown();
        doc.fontSize(14).text('Order Summary',50,doc.y, { underline: true, align: 'left' });
        doc.moveDown();
        
        const pageWidth = doc.page.width;
        const summaryTableWidth = 250;
        const summaryTableLeft = (pageWidth - summaryTableWidth) / 2; 
        const summaryColWidths = [150, 80]; 
        const summaryRowHeight = 25;
        const summaryItems = [
            { label: 'Subtotal:', value: `${subtotal.toFixed(2)}` },
            { label: 'Tax Total:', value: `${totalTax.toFixed(2)}` },
            { label: 'Shipping Charge:', value: `${shippingCharge.toFixed(2)}` },
            { label: 'Discount Applied:', value: `${discount.toFixed(2)}` },
            { label: 'Final Total:', value: `${finalOrderTotal.toFixed(2)}` }
        ];
        let summaryY = doc.y;
    
        summaryItems.forEach((item, index) => {
            const isLastRow = index === summaryItems.length - 1;

            doc.rect(summaryTableLeft, summaryY, summaryTableWidth, summaryRowHeight).stroke();

            doc.moveTo(summaryTableLeft + summaryColWidths[0], summaryY)
               .lineTo(summaryTableLeft + summaryColWidths[0], summaryY + summaryRowHeight)
               .stroke();
            if (isLastRow) {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }
            
            doc.fontSize(12)
               .text(item.label, 
                    summaryTableLeft + 5, 
                    summaryY + 7,
                    { width: summaryColWidths[0] - 10 });
            
            doc.text(item.value,
                    summaryTableLeft + summaryColWidths[0] + 5,
                    summaryY + 7,
                    { width: summaryColWidths[1] - 10, align: 'right' });
            
            summaryY += summaryRowHeight;
        });

        doc.moveDown(4);  
        const pageCenter = doc.page.width / 2;
        doc.fontSize(10)
           .text('Thank you for shopping with us!',0,doc.y,
                { align: 'center', width: doc.page.width })
           .moveDown(0.5) 
           .text('This is a computer-generated invoice and does not require a signature.',0,doc.y,
                { align: 'center', width: doc.page.width });
        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating invoice');
    }
}

const createRazorpayOrder = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const userId = req.session.user;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        const order = await Order.findOne({ 
            _id: orderId, 
            customerId: userId,
            paymentMethod: 'razorpay',
            paymentStatus: 'Pending'
        });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found or not eligible for payment' });
        }     
        const amountInPaise = Math.round(order.totalAmount * 100);
        const orderAmount = parseInt(amountInPaise, 10);
        const receiptStr = order._id.toString();
        
        const paymentOrder = await razorpay.orders.create({
            amount: orderAmount,
            currency: "INR",
            receipt: receiptStr,
            payment_capture: 1
        });
        
        
        res.status(200).json({ success: true, order: paymentOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creating payment order' });
    }
};

const verifyRazorpayPayment = async (req, res) => {
    try {
        const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const userId = req.session.user;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const order = await Order.findOne({
            _id: orderId,
            customerId: userId
        });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAYX_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');
        
        if (generated_signature === razorpay_signature) {
            order.paymentStatus = 'Paid';
            await order.save();
            
            res.status(200).json({ success: true, message: 'Payment successful' });
        } else {
            res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Error processing payment verification' });
    }
};

const logout = (req,res)=>{
    try {
        req.session.user=null;
        res.redirect('/user/register');
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}



module.exports = {
    registerUser,verifyOTP,resendOTP,
    loginUser,loadregister,Loadhome,
    loadmenu,loadabout,loadcontactus,
    Productdetails,loadcart,addtocart,
    updatecartquantity,removefromcart,loadcheckout,
    checkoutaddaddress,checkoutchangeaddress,loadordersuccess,
    addorderdetails,loaduserprofile,updateprofile,
    updateprofileimage,addaddress,editaddress,
    deleteaddress,loadorderdetils,cancelorder,
    updatepassword,handleGoogleLogin,handleGoogleCallback,
    loadwishlist,addtowishlist,removefromwishlist,
    loadwallet,addMoney,downloadinvoice,
    logout,loadforgotpassword,forgetsendotp,
    loadforgotPasswordotp,forgotverifyotp,newpassword,
    resetpassword,createRazorpayOrder,verifyRazorpayPayment
};