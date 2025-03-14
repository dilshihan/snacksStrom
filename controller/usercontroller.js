const userschema = require('../model/usermodel')
const Productmodel = require('../model/prodectmodel')
const bcrypt = require('bcrypt')
const saltround = 10
const nodemailer = require('nodemailer')
const Category = require('../model/categorymodel')
const cartmodel = require('../model/cartmodel')
const addressmodel = require('../model/addressmodel')
const Order = require("../model/ordermodel")
const { use } = require('passport')
const mongoose = require('mongoose');





const OTPs = new Map(); // Temporary store for OTPs 

const transporter = nodemailer.createTransport({    
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to generate OTP
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

        // Validate OTP (Convert both to string before comparison)
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

        req.session.user = user._id; //Store ObjectId
        req.session.email = user.email;
        res.redirect("/user/home");
    } catch (error) {
        console.error(error);
    }
};

const loadregister = async (req,res)=>{
    res.render('user/register',{message:''})
}   

const Loadhome = async (req, res) => {
    try {
      const   userid = req.session.user 
        const products = await Productmodel.find({});
        const catogorys = await Category.find({});
        const user = await userschema.findById(userid) 

        res.render("user/home", { products ,catogorys,user}); 
    } catch (error) {
        console.error(error);
    }
};

const loadmenu = async (req, res) => {
    try {
        const userid = req.session.user 
        const user = await userschema.findById(userid)
        const priceRange = req.query.priceRange;
        const sortBy = req.query.sortBy || 'default'; 
        const filter = { isListed: true };
        if (priceRange) {
            switch (priceRange) {
                case 'under100':
                    filter.price = { $lt: 100 };
                    break;
                case '100-300':
                    filter.price = { $gte: 100, $lte: 300 };
                    break;
                case '300-500':
                    filter.price = { $gte: 300, $lte: 500 };
                    break;
            }
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 9; 
        const skip = (page - 1) * limit;

        const totalProducts = await Productmodel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        let query = Productmodel.find(filter).select('name price image category isListed');
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
                query = query.sort({ _id: -1 }); 
        }
 
        const products = await query.skip(skip).limit(limit).lean();

        const queryParams = new URLSearchParams({ ...(priceRange && { priceRange }), ...(sortBy && { sortBy }) }).toString();

        return res.render("user/menu", { 
            products,
            user,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            selectedPriceRange: priceRange || 'all',
            selectedSort: sortBy,
            queryParams 
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
    }
}

const loadcontactus = async(req,res)=>{
    try{
        const   userid = req.session.user
        const user = await userschema.findById(userid) 
        res.render('user/contactus',{user})
    }catch(error){
        console.log(error)
    }
}

const Productdetails = async (req, res) => {
        try { 
            const   userid = req.session.user 
            const user = await userschema.findById(userid)
            const products = await Productmodel.findById(req.params.id);
            if (!products) {
                return res.redirect('/user/menu');
            }
            const relatedProducts = await Productmodel.find({
                category: products.category,
                _id: { $ne: req.params.id } // Exclude current product
            }).limit(4);
            
            res.render('user/productdetails', { products,relatedProducts,user});
        } catch (error) {
            console.error(error);
        }
 }

 const loadcart = async (req, res) => {
    try {
        const userId = req.session?.user
        if (!userId) {
            return res.render("user/cart", { cart: [], totalPrice: 0 });
        }
        const user = await userschema.findById(userId) 
        const cart = await cartmodel.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.render("user/cart", { cart: [], totalPrice: 0 ,user});
        }
        const cartItems = cart.products.map((item) => ({
            id: item.productId._id,
            name: item.productId.name,
            image: item.productId.image,
            price: item.productId.price,
            quantity: item.quantity,
        }));
        const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
        res.render("user/cart", { cart: cartItems, totalPrice,user ,userId});
    } catch (error) {
        console.error(error);
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
        const totalQuantity = existingQuantity + quantity

        if (totalQuantity > product.stock) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot add more items. Only ${product.stock} units available in stock!` 
            });
        }

        if (existingProductIndex !== -1) {
            cart.products[existingProductIndex].quantity = totalQuantity;
        } else {
            cart.products.push({
                productId,
                quantity,
            });
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
    }
};  

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
        const cart = await cartmodel.findOne({ userId }).populate("products.productId");
        if (!cart || cart.products.length === 0) {
            return res.render("user/checkout", { user, defaultAddress,addresses, cart: [], totalPrice: 0 });
        }
        const cartItems = cart.products.map((item) => ({
            id: item.productId._id,
            name: item.productId.name,
            image: item.productId.image,
            price: item.productId.price,
            quantity: item.quantity,
        }));

        
        const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

        res.render('user/checkout',{user,defaultAddress,addresses, cart: cartItems, totalPrice})
    }catch(error){
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

        // Get the selected address details
        const selectedAddress = await addressmodel.findById(selectedAddressId);
        if (!selectedAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }

        // Update default address flags
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
    }
}

const addorderdetails = async(req, res) => {
    try {
        const { customerId, products, totalAmount, paymentMethod, addressId } = req.body;

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
        const newOrder = new Order({
            customerId,
            products,
            totalAmount,
            paymentMethod,
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
        const productsPerPage = 3; 
        const addresses = await addressmodel.find({ userId: user._id }) || [];
        
        const allOrders = await Order.find({customerId: new mongoose.Types.ObjectId(user._id) })
        .sort({ orderDate: -1 })
        .populate('products.productId')
        .populate('shippingAddress')
        .exec();

        const totalProducts = allOrders.reduce((sum, order) => sum + order.products.length, 0);
        const totalPages = Math.ceil(totalProducts / productsPerPage);

        let productsSoFar = 0;
        let ordersToShow = [];
        
        for (let order of allOrders) {
            let orderCopy = { ...order.toObject() };
            
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
            user: user,
            addresses: addresses,
            orders: ordersToShow,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
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
            isDefault: shouldBeDefault
        });

        await newAddress.save();

        res.redirect('/user/userprofile'); 
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
        // Update the address
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

        res.redirect('/user/userprofile');
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
            .populate('products.productId').populate('customerId').populate('shippingAddress');
    console.log('aaaaa',order);
    
        if (!order) {
            return res.status(404).send("Order not found");
        }
    
        const productDetails = order.products.find(item => 
            item._id.toString() === productId
        );
    
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

        const order = await Order.findOneAndUpdate(
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

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order or product not found" 
            });
        }
        res.json({ 
            success: true, 
            message: "Product canceled successfully",
            updatedOrder: order 
        });
    } catch (error) {
        console.error('Error in cancelorder:', error);
        res.status(500).json({success: false, message: "Error canceling product"  });
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

const logout = (req,res)=>{
    req.session.user=null;
    res.redirect('/user/register')
}

module.exports={registerUser,loadregister,loginUser,
               verifyOTP,resendOTP,loadforgotpassword,
               forgetsendotp,loadforgotPasswordotp,forgotverifyotp,
               newpassword,resetpassword, logout,Loadhome,
               loadmenu,loadabout,loadcontactus,
               Productdetails,loadcart,addtocart,updatecartquantity,
               removefromcart,loadcheckout,checkoutaddaddress,
               checkoutchangeaddress,loadordersuccess,addorderdetails,
               loaduserprofile,updateprofile,updateprofileimage,
               addaddress,editaddress,deleteaddress,
               loadorderdetils,cancelorder,updatepassword,
               handleGoogleLogin,handleGoogleCallback}