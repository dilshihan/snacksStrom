const userschema = require('../model/usermodel')
const Productmodel = require('../model/prodectmodel')
const bcrypt = require('bcrypt')
const saltround = 10
const nodemailer = require('nodemailer')
const Category = require('../model/categorymodel')
const cartmodel = require('../model/cartmodel')
const addressmodel = require('../model/addressmodel')
const { use } = require('passport')





const OTPs = new Map(); // Temporary store for OTPs 

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mohddilshan1234321@gmail.com',
        pass: 'ykbc aoyd ilqv alka'
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
        const user = new userschema({ email: req.session.email, password: hashedPassword });
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
        const   userid = req.session.user 
        const page = parseInt(req.query.page) || 1;
        const limit = 9; 
        const filter = { isListed: true };
        const user = await userschema.findById(userid)
        const totalProducts = await Productmodel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);
        const products = await Productmodel.find(filter)
            .skip((page - 1) * limit)
            .limit(limit);

            if (req.xhr) { // If AJAX request
                return res.json({
                    success: true,
                    products,
                    currentPage: page,
                    totalPages
                });
            } else {
                return res.render("user/menu", { 
                    products,
                    currentPage: page,
                    totalPages,
                    user
                });
            }
    } catch (error) {
        console.error(error);
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
        res.render("user/cart", { cart: cartItems, totalPrice,user });
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
        if (quantity > product.stock) {
            return res.status(400).json({ success: false, message: "Not enough stock available!" });
        }
        let cart = await cartmodel.findOne({ userId });
        if (!cart) {
            cart = new cartmodel({ userId, products: [], totalPrice: 0 });
        }
        const existingProductIndex = cart.products.findIndex(
            (item) => item.productId.toString() === productId
        );

        if (existingProductIndex !== -1) {
            cart.products[existingProductIndex].quantity += quantity;
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

const checkoutchangeaddress =  async (req, res) => {
    try {
        const userId = req.session.user;
        let { selectedAddressId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!selectedAddressId) {
            return res.status(400).json({ success: false, message: 'Invalid address ID' });
        }

        await addressmodel.updateMany({ userId }, { $set: { isDefault: false } });

        const updatedAddress = await addressmodel.findOneAndUpdate(
            { _id: selectedAddressId, userId },
            { $set: { isDefault: true } },
            { new: true }
        ); 
        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        res.json({ success: true, message: 'Default address updated', updatedAddress });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const loaduserprofile = async(req,res)=>{
    try{
        const userid = req.session.user 
        const user = await userschema.findById(userid) 
        if (!user) {
            return res.status(404).render('error', { message: 'User not found' });
        }
        
        const addresses = await addressmodel.find({ userId: user._id })        
        if(!addresses) {
            addresses = [];
        }
        
        res.render('user/userprofile',{
            user: user,
            addresses: addresses
        });

    }catch(error){
        console.log(error)
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

const handleGoogleLogin = async (req, res) => {
    try {
        const { token, userData } = req.body;
                
        // Check if user already exists
        let user = await userschema.findOne({ email: userData.email });
        
        if (!user) {
            // Create new user if doesn't exist
            user = new userschema({
                email: userData.email,
                image:userData.picture,
                password: await bcrypt.hash(Math.random().toString(36).slice(-8), saltround),
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
               verifyOTP,resendOTP,logout,Loadhome,
               loadmenu,loadabout,loadcontactus,
               Productdetails,loadcart,addtocart,
               removefromcart,loadcheckout,checkoutaddaddress,
               checkoutchangeaddress,
               loaduserprofile,updateprofile,updateprofileimage,
               addaddress,editaddress,deleteaddress,
               handleGoogleLogin,handleGoogleCallback}