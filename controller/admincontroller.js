const adminmodel = require('../model/adminmodel')
const bcrypt = require('bcrypt')
const usermodel = require('../model/usermodel')
const ProductModel = require('../model/prodectmodel')
const  Categorymodel = require('../model/categorymodel')
const ordermodel = require('../model/ordermodel')
const Order = require("../model/ordermodel")
const couponmodel = require('../model/couponmodel')
const returnmodel = require('../model/returnmodel')
const walletmodel = require('../model/walletmodel')
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

  

const loadlogin  = async(req,res)=>{
    res.render('admin/login',{message:''})
}

const login = async(req,res)=>{
     try{
        const {email,password}=req.body
        const admin = await adminmodel.findOne({email})
        if(!admin) return  res.render('admin/login',{message:'invalid credentials'})
            const isMatch = await bcrypt.compare(password,admin.password)
        if(!isMatch) return res.render('admin/login',{message:'invalid credentials'})
            req.session.admin = true
        res.redirect('/admin/dashboard')
     }catch(error){
        res.send(error)
     }
}

const loaddashboard= async(req,res)=>{  
    try{
        const admin = req.session.admin
        if(!admin){return res.redirect('/admin/login')} 
        const totalUsers = await usermodel.countDocuments({ status: 'Active' });
    
        const orders = await Order.find({});
        const totalOrders = orders.length;
        
        const totalRevenue = orders.reduce((sum, order) => {
            const deliveredProductsRevenue = order.products
                .filter(product => product.status === 'Delivered')
                .reduce((productSum, product) => productSum + (product.price * product.quantity), 0);
            return sum + deliveredProductsRevenue;
        }, 0);
        
        const totalProductsSold = orders.reduce((sum, order) => {
            return sum + order.products
                .filter(product => product.status === 'Delivered')
                .reduce((productSum, product) => productSum + product.quantity, 0);
        }, 0);
        
        const currentDate = new Date();
        const firstDayCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const firstDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        
        const currentMonthOrders = await Order.find({ orderDate: { $gte: firstDayCurrentMonth } });
        const lastMonthOrders = await Order.find({ 
            orderDate: { $gte: firstDayLastMonth, $lte: lastDayLastMonth } 
        });
    
        const lastMonthTotalOrders = lastMonthOrders.length;
        const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => {
            const deliveredProductsRevenue = order.products
                .filter(product => product.status === 'Delivered')
                .reduce((productSum, product) => productSum + (product.price * product.quantity), 0);
            return sum + deliveredProductsRevenue;
        }, 0);
        const orderChange = lastMonthTotalOrders > 0 
            ? ((totalOrders - lastMonthTotalOrders) / lastMonthTotalOrders) * 100 
            : 100;
        
        const revenueChange = lastMonthRevenue > 0 
            ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
            : 100;
        const lastMonthUsers = await usermodel.countDocuments({ 
            joinDate: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
            status: 'Active'
        });
        
        const userChange = lastMonthUsers > 0 
            ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100 
            : 100;
        const conversionRate = totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;
        const formattedRevenue = totalRevenue.toFixed(2);
        const formattedConversionRate = conversionRate.toFixed(1);
        
        
        const topProducts = await Order.aggregate([
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { 
                $group: {
                    _id: '$products.productId',
                    productName: { $first: '$products.productName' },
                    totalSold: { $sum: '$products.quantity' },totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } },}
            },
            { $sort: { totalSold: -1 } },{ $limit: 5 },{$lookup: {from: 'products',localField: '_id',foreignField: '_id',as: 'productInfo'}
            },
            { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } }
        ]);

        const topCategories = await Order.aggregate([
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { 
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: '$productInfo' },
            { 
                $group: {
                    _id: '$productInfo.category',
                    totalSold: { $sum: '$products.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } },
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);
        
        const { graphLabels, orderData, revenueData } = await generateChartData('daily');
        
        res.render('admin/dashboard', {
            stats: {
                totalUsers,
                totalOrders,
                totalRevenue: formattedRevenue,
                totalProductsSold,
                userChange: userChange.toFixed(1),
                orderChange: orderChange.toFixed(1),
                revenueChange: revenueChange.toFixed(1),
                conversionRate: formattedConversionRate
            },
            graphData: {
                labels: graphLabels,
                orders: orderData,
                revenue: revenueData,
                period: 'daily'
            },
            topProducts,
            topCategories
        });
    }catch(error){
        console.log(error);
        res.status(500).send("Server error");
    }
}

const getChartData = async(req, res) => {
    try {
        const period = req.query.period || 'daily';
        const chartData = await generateChartData(period);
        
        res.json({
            labels: chartData.graphLabels,
            orders: chartData.orderData,
            revenue: chartData.revenueData
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Server error" });
    }
}

const generateChartData = async(period) => {
    const currentDate = new Date();
    let dataPoints = [];
    let format = '';
    
    switch(period) {
        case 'weekly':
            dataPoints = Array.from({ length: 12 }, (_, i) => {
                const endDate = new Date(currentDate);
                endDate.setDate(currentDate.getDate() - (i * 7));
                const startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 6);
                
                const weekNum = Math.ceil((endDate.getDate() + new Date(endDate.getFullYear(), endDate.getMonth(), 1).getDay()) / 7);
                return {
                    start: startDate,
                    end: endDate,
                    label: `W${weekNum}, ${startDate.toLocaleDateString('en-US', { month: 'short' })}`
                };
            }).reverse();
            format = 'weekly';
            break;
            
        case 'monthly':
            dataPoints = Array.from({ length: 12 }, (_, i) => {
                const date = new Date(currentDate);
                date.setMonth(currentDate.getMonth() - i);
                const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
                const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                
                return {
                    start: startDate,
                    end: endDate,
                    label: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                };
            }).reverse();
            format = 'monthly';
            break;
            
        case 'yearly':
            dataPoints = Array.from({ length: 5 }, (_, i) => {
                const year = currentDate.getFullYear() - i;
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                
                return {
                    start: startDate,
                    end: endDate,
                    label: year.toString()
                };
            }).reverse();
            format = 'yearly';
            break;
            
        default: 
            dataPoints = Array.from({ length: 7 }, (_, i) => {
                const date = new Date(currentDate);
                date.setDate(currentDate.getDate() - i);
                date.setHours(0, 0, 0, 0);
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                
                return {
                    start: date,
                    end: nextDate,
                    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                };
            }).reverse();
            format = 'daily';
    }
    
    const graphLabels = dataPoints.map(point => point.label);
    const orderData = [];
    const revenueData = [];
    
    const dataPromises = dataPoints.map(async (point) => {
        const pointOrders = await Order.find({
            orderDate: { $gte: point.start, $lte: point.end }
        });
        
        const pointRevenue = pointOrders.reduce((sum, order) => {
            const deliveredProductsRevenue = order.products
                .filter(product => product.status === 'Delivered')
                .reduce((productSum, product) => productSum + (product.price * product.quantity), 0);
            return sum + deliveredProductsRevenue;
        }, 0);
        
        return {
            orders: pointOrders.length,
            revenue: pointRevenue
        };
    });
    
    const results = await Promise.all(dataPromises);
    
    results.forEach(result => {
        orderData.push(result.orders);
        revenueData.push(result.revenue);
    });
    
    return { graphLabels, orderData, revenueData };
}

const loaduser = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1;
        let limit = 5;
        let skip = (page - 1) * limit;
        
        const searchQuery = req.query.search;
        let query = {};
        if (searchQuery) {
            query = {
                email: { $regex: searchQuery, $options: 'i' }
            };
        }
        const totalUsers = await usermodel.countDocuments(query);
        const users = await usermodel.find(query).skip(skip).limit(limit);

        res.render('admin/users', {
            users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            searchQuery
        });

    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

const banUser = async (req, res) => {
    try {
        const { userId } = req.body; 
        const user = await usermodel.findById(userId);
        if (!user) {
            return res.send({ message: "User not found" });
        }
        user.status = user.status === "Active" ? "Banned" : "Active";
        await user.save();
        res.json({ success: true, status: user.status});
    } catch (error) {
        console.error(error);
    }   
};

const loadProducts = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) {
            return res.redirect('/admin/login');
        }
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const searchQuery = req.query.search || '';

        const searchFilter = searchQuery
            ? {
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { description: { $regex: searchQuery, $options: 'i' } },
                    { category: { $regex: searchQuery, $options: 'i' } }
                ]
            }
            : {};
        const totalProducts = await ProductModel.countDocuments(searchFilter);
        const totalPages = Math.ceil(totalProducts / limit);
        const products = await ProductModel.find(searchFilter)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({createdAt:-1});

        res.render('admin/products', { 
            products, 
            currentPage: page, 
            totalPages,
            searchQuery 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

const loadaddproduct = async (req, res) => {
    try {
        const categories = await Categorymodel.find({}); 
        res.render("admin/addproduct", { title: "Add Product", categories });
    } catch (error) {
        console.error(error);
    }
};

const addProduct = async (req, res) => {
    try {
        const { name, price, stock, description, category, offer } = req.body;

        let offerValue = parseFloat(offer) || 0;
        offerValue = Math.min(Math.max(offerValue, 0), 70);

        const images = req.files ? req.files.map(file => file.filename) : [];

        if (!name || !price || !category || !description || !stock) {
            return res.status(400).send("all fields are required");
        }

        const existingProduct = await ProductModel.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") }
        });
        
        if (existingProduct) {
            return res.status(400).json({ message: "Product already exists!" });
        }

        const originalPrice = parseFloat(price);
        const discountedPrice = originalPrice - (originalPrice * offerValue / 100);

        const newProduct = new ProductModel({ 
            name, 
            price: originalPrice, 
            stock, 
            description, 
            image: images, 
            category,
            offer: offerValue,
            discountedPrice: Math.round(discountedPrice * 100) / 100
        });

        await newProduct.save();
        res.redirect('/admin/products');

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const loadupdateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await ProductModel.findById(productId);
        const categories = await Categorymodel.find({})

        if (!product) {
            return res.status(404).send("Product not found");
        }

        res.render("admin/updateproduct", { product,categories });
    } catch (error) {
        console.error(error);
    }
};

const updateProduct = async (req, res) => {
    try {
        const { name, price, description, stock, category, offer } = req.body;
        const productId = req.params.id;

        const existingProduct = await ProductModel.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const duplicateProduct = await ProductModel.findOne({name: { $regex: new RegExp(`^${name}$`, "i")}, _id: { $ne: productId } });
        if (duplicateProduct) {
            return res.status(400).json({ success: false, message: "Product name already exists!" });
        }

        let updatedImages = existingProduct.image || [];

        const saveBase64Image = async (base64String, index) => {
            if (!base64String || !base64String.startsWith('data:image')) {
                return existingProduct.image[index - 1] || null;
            }

            const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) {
                return existingProduct.image[index - 1] || null; 
            }

            const extension = matches[1]; 
            const base64Data = matches[2];
            const filename = `product_${productId}_${index}.${extension}`;
            const filePath = path.join('uploads', filename);
         
            fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
            return filename;
        };
        for (let i = 1; i <= 3; i++) {
            updatedImages[i - 1] = await saveBase64Image(req.body[`croppedImage${i}`], i);
        }

        let offerValue = parseFloat(offer) || 0;
        offerValue = Math.min(Math.max(offerValue, 0), 70);

        const originalPrice = parseFloat(price);
        const discountedPrice = originalPrice - (originalPrice * offerValue / 100);

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            productId,
            { 
                name, 
                price: originalPrice, 
                description, 
                stock, 
                category, 
                image: updatedImages,
                offer: offerValue,
                discountedPrice: Math.round(discountedPrice * 100) / 100
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.redirect('/admin/products');

    } catch (error) {
        console.error(error);
    }
};

const Productlisting = async (req, res) => {
    try { 
        const { productId, isListed } = req.body;
        if (typeof isListed !== "boolean") {
            return res.status(400).json({ success: false, message: "Invalid isListed value" });
        }
        const product = await ProductModel.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        product.isListed =isListed;
        await product.save();

        res.json({ success: true, isListed: product.isListed });
    } catch (error) {
        console.error(error);
    }
};

const loadcategory = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1; 
        let limit = 5; 
        let skip = (page - 1) * limit; 

        const categories = await Categorymodel.find().skip(skip).limit(limit); 
        const totalCategories = await Categorymodel.countDocuments(); 
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("admin/category", { 
            categories, 
            currentPage: page, 
            totalPages 
        });

    } catch (error) {
        console.log(error);
    }
};

const loadaddcategory = async(req,res)=>{
    res.render('admin/addcategory')
}

const addcategory = async (req, res) => {
    const { name, description, offer } = req.body;

    try {
        const existingCategory = await Categorymodel.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category already exists!" });
        }

        const newCategory = new Categorymodel({ name, description, offer });
        await newCategory.save();

        res.json({ success: true, message: "Category added successfully!" });

    } catch (error) {
        console.error(error);
    }
};

const loadUpdateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Categorymodel.findById(categoryId);

        if (!category) {
            return res.status(404).send("Category not found");
        }

        res.render("admin/updatecategory", { category });
    } catch (error) {
        console.error( error);
    }
};

const updateCategory = async (req, res) => {
    try {
        const { name, description, offer } = req.body;
        const categoryId = req.params.id;
        
        const existingCategory = await Categorymodel.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") },  _id: { $ne: categoryId }});
        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category name already exists. Choose a different name." });
        }

        const updatedCategory = await Categorymodel.findByIdAndUpdate(
            categoryId,
            { name, description, offer },
            { new: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        res.json({ success: true, message: "Category updated successfully" });
    } catch (error) {
        console.error(error);
    }
};

const Categorylisting = async (req, res) => {
    try {
        const { categoryId, isListed } = req.body; 

        if (typeof isListed !== "boolean") {
            return res.status(400).json({ success: false, message: "Invalid isListed value" });
        }

        const category = await Categorymodel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        category.isListed = isListed;
        await category.save();
        await ProductModel.updateMany(
            { category: category.name },
            { $set: { isListed: isListed } }
        );

        res.json({ 
            success: true, 
            message: `Category and associated products ${isListed ? 'listed' : 'unlisted'} successfully`,
            isListed: category.isListed 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating listing status" });
    }
};

const loadorders = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1; 
        let limit = 5; 
        let skip = (page - 1) * limit; 

        const totalOrders = await ordermodel.countDocuments();
        const orders = await ordermodel.find()
            .populate({
                path: 'products.productId',
                select: 'name price'
            })
            .sort({orderDate: -1})
            .skip(skip)
            .limit(limit)
            .lean();

        const processedOrders = orders.map(order => {
            const processedProducts = order.products.map(item => ({
                ...item,
                itemTotal: item.price * item.quantity
            }));

            const subtotal = processedProducts
                .filter(p => p.status !== 'Cancelled')
                .reduce((total, p) => total + p.itemTotal, 0);
            const shippingCharge = 5;
            const taxRate = 0.1;
            const tax = subtotal * taxRate;
          

            return {
                ...order,
                products: processedProducts,
                subtotal,
                shippingCharge,
                tax,
            };
        });

        res.render('admin/order', {orders: processedOrders,currentPage: page,totalPages: Math.ceil(totalOrders / limit) });

    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

const updateorderstatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (status === "Cancelled") {
            for (const product of order.products) {
                if (product.status !== "Cancelled" && product.status !== "Delivered") {
                    await ProductModel.findByIdAndUpdate(
                        product.productId,
                        { $inc: { stock: product.quantity } } 
                    );
                    product.status = status;
                }
            }
        } else {
            order.products.forEach(product => {
                if (product.status !== "Cancelled" && product.status !== "Delivered") {
                    product.status = status;
                }
            });
        }
        await order.save();

        res.json({ success: true, message: "Product statuses updated successfully", order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const loadviewoderdeatils = async(req,res)=>{
    try{
        const orderId = req.query.id;
        const order = await Order.findById(orderId)
        .populate("customerId", "name email phoneNumber").populate("products.productId").populate("shippingAddress").lean();  

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const processedProducts = order.products.map(item => ({
            ...item,
            itemTotal: item.price * item.quantity
        }));

        let subtotal = processedProducts
            .filter(p => p.status !== 'Cancelled')
            .reduce((acc, item) => acc + item.itemTotal, 0);
        let shippingCharge = 5.99;
        let tax = subtotal * 0.1;
        let totalAmount = subtotal + shippingCharge + tax;

        res.render('admin/vieworderdetils', {
            order: {
                ...order,
                products: processedProducts
            },
            subtotal: subtotal.toFixed(2), 
            shippingCharge: shippingCharge.toFixed(2),
            tax: tax.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
        });
        
    }catch(error){
        console.log(error);
        res.status(500).send("Server error");
    }
}

const loadcoupon = async(req,res)=>{
    try{
        const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit;

        const totalCoupons = await couponmodel.countDocuments({});
        const totalPages = Math.ceil(totalCoupons / limit);
        const coupons = await couponmodel.find({}).skip(skip).limit(limit).sort({ createdAt: -1 });

        res.render('admin/coupon', {
            coupons,
            currentPage: page,
            totalPages
        });
    }catch(error){
        console.log(error);
        res.status(500).send('something went wrong');
    }
}

const loadaddcoupon = async(req,res)=>{
    try{
        res.render('admin/addcoupon')
    }catch(error){
        console.log(error);
        res.status(500).send('somthing want wrong')
    }
}

const addcoupon = async(req,res)=>{
    try {
        const {code,discountAmount,minPurchase,startDate,expiryDate,usageLimit} = req.body;   
        const existingCoupon = await couponmodel.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({status: 'error',message: 'Coupon code already exists'});
        }

        const coupon = await couponmodel.create({
            code: code.toUpperCase(),
         discountAmount,minPurchase,startDate,expiryDate,usageLimit: usageLimit || 1,updatedAt: new Date()});

        res.status(201).json({status: 'success',message: 'Coupon created successfully',data: coupon});

    } catch (error) {
        console.error(error);
        res.status(500).json({status: 'error',message: 'Error creating coupon',error: error.message});
    }
}

const loadupdatecoupon = async(req, res) => {
    try {
        const couponId = req.params.id; 
        
        const coupon = await couponmodel.findById(couponId);
        if (!coupon) {
            return res.status(404).send('Coupon not found');
        }
        coupon.startDate = new Date(coupon.startDate).toISOString().split('T')[0];
        coupon.expiryDate = new Date(coupon.expiryDate).toISOString().split('T')[0];
        res.render('admin/updatecoupon', {coupon});
    } catch (error) {
        console.log(error);
        res.status(500).send('Something went wrong');
    }
};

const updatecoupon = async(req,res)=>{
    try{
        const couponId = req.params.id;
        const {discountAmount,minPurchase,startDate,expiryDate,usageLimit} = req.body;
        const updatedCoupon = await couponmodel.findByIdAndUpdate(
            couponId,
            {
                discountAmount,
                minPurchase,
                startDate,
                expiryDate,
                usageLimit,
                updatedAt: Date.now()
            },
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({success: true, message: 'success'});
    }catch(error){
        console.log(error);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
}

const couponstatus = async (req, res) => {
    try {
        const couponId = req.params.id;
        const coupon = await couponmodel.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        coupon.isDeleted = !coupon.isDeleted;
        await coupon.save();

        const message = coupon.isDeleted ? 'Coupon deleted successfully' : 'Coupon restored successfully';
        res.json({ success: true, message, isDeleted: coupon.isDeleted });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating coupon status' });
    }
};

const loadsalesreport = async (req, res) => {
    try {
        const dateRange = req.query.dateRange || 'day';
        const endDate = new Date();
        const startDate = new Date();

        if (dateRange === 'custom' && req.query.startDate && req.query.endDate) {
            startDate.setTime(new Date(req.query.startDate));
            endDate.setTime(new Date(req.query.endDate));
            endDate.setHours(23, 59, 59, 999);
        } else {
            switch(dateRange) {
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default: 
                    startDate.setHours(0, 0, 0, 0);
            }
        }

        const dateMatchStage = {
            orderDate: { $gte: startDate, $lte: endDate }
        };

        const totalSales = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }}}
        ]);

        
        const unitsSold = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $group: { 
                _id: null, 
                total: { $sum: '$products.quantity' }
            }}
        ]);

        const deliveredProducts = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: {
                _id: null,
                total: { $sum: '$products.quantity' }
            }}
        ]);

        const topProducts = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: {
                _id: '$products.productId',
                productName: { $first: '$products.productName' },
                units: { $sum: '$products.quantity' },
                revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
            }},
            { $sort: { units: -1 } },
            { $limit: 3 },
            { $lookup: {from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails'}},
            { $unwind: '$productDetails' }
        ]);

        const recentOrders = await Order.find(dateMatchStage)
            .populate('customerId', 'name email')
            .sort({ orderDate: -1 })
            .limit(3);

        const avgOrders = await Order.aggregate([
            { $match: dateMatchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    dailyOrders: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgOrders: { $avg: "$dailyOrders" }
                }
            }
        ]);

        const viewData = {
            stats: {
                totalSales: totalSales[0]?.total || 0,
                unitsSold: unitsSold[0]?.total || 0,
                deliveredProducts: deliveredProducts[0]?.total || 0,
                avgOrders: avgOrders[0]?.avgOrders || 0,
                profitMargin: 32.4
            },
            topProducts: topProducts.map(product => ({
                name: product.productName,
                sku: product.productDetails.sku || 'N/A',
                units: product.units,
                revenue: product.revenue
            })),
            recentSales: recentOrders.map(order => ({
                orderId: order._id,
                customer: {
                    name: order.customerId.name,
                    email: order.customerId.email
                },
                date: order.orderDate,
                amount: order.totalAmount,
                status: order.products[0].status
            })),
            selectedRange: dateRange,
            dateFilter: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        };

        res.render('admin/salesreport', viewData);

    } catch (error) {
        console.log(error);
        res.status(500).send('Something went wrong');
    }
};

const exportSalesPDF = async (req, res) => {
    try {
        const dateRange = req.query.dateRange || 'day';
        const endDate = new Date();
        const startDate = new Date();

        if (dateRange === 'custom' && req.query.startDate && req.query.endDate) {
            startDate.setTime(new Date(req.query.startDate));
            endDate.setTime(new Date(req.query.endDate));
        } else {
            switch(dateRange) {
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setHours(0, 0, 0, 0);
            }
        }

        const dateMatchStage = {
            orderDate: { $gte: startDate, $lte: endDate }
        };

        const totalSales = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }}}
        ]);

        const deliveredProducts = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: {_id: null, total: { $sum: '$products.quantity' }}}
        ]);

        const topProducts = await Order.aggregate([
            { $match: dateMatchStage },
            { $unwind: '$products' },
            { $match: { 'products.status': 'Delivered' } },
            { $group: {
                _id: '$products.productId',
                productName: { $first: '$products.productName' },
                units: { $sum: '$products.quantity' },
                revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
            }},
            { $sort: { units: -1 } },
            { $limit: 3 },
            { $lookup: {from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails'}},
            { $unwind: '$productDetails' }
        ]);

        const avgOrders = await Order.aggregate([
            { $match: dateMatchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    dailyOrders: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    avgOrders: { $avg: "$dailyOrders" }
                }
            }
        ]);

        const doc = new PDFDocument();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
        
        doc.pipe(res);
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        doc.moveDown();

        doc.fontSize(16).text('Summary Statistics', { underline: true });
        doc.moveDown();

        const statsTable = {
            headers: ['Metric', 'Value'],
            rows: [
                ['Total Sales', `$${(totalSales[0]?.total || 0).toLocaleString()}`],
                ['Delivered Products', (deliveredProducts[0]?.total || 0).toLocaleString()],
                ['Average Orders', Math.round(avgOrders[0]?.avgOrders || 0).toString()]
            ]
        };

        drawTable(doc, statsTable);
        doc.moveDown(2);

        if (topProducts && topProducts.length > 0) {
            doc.fontSize(16).text('Top Products', { underline: true });
            doc.moveDown();

            const productsTable = {
                headers: ['Product Name',  'Units Sold', 'Revenue'],
                rows: topProducts.map(product => [
                    product.productName,
                    product.units.toString(),
                    `$${product.revenue.toLocaleString()}`
                ])
            };

            drawTable(doc, productsTable);
        }

        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).send('Error generating PDF');
        }
    }
};

function drawTable(doc, table) {    
    const startX = 50;
    let startY = doc.y + 10;
    const rowHeight = 30;
    const colWidth = (doc.page.width - 100) / table.headers.length;
    doc.fontSize(12);
    table.headers.forEach((header, i) => {
        doc.fillColor('#f3f4f6')
           .rect(startX + (i * colWidth), startY, colWidth, rowHeight)
           .fill();
        doc.fillColor('#000000')
           .rect(startX + (i * colWidth), startY, colWidth, rowHeight)
           .stroke()
           .text(header,
                startX + (i * colWidth) + 5,
                startY + 10,
                { width: colWidth - 10 });
    });

    startY += rowHeight;
    table.rows.forEach((row, rowIndex) => {
        if (rowIndex % 2 === 1) {
            doc.fillColor('#f9fafb');
            row.forEach((_, i) => {
                doc.rect(startX + (i * colWidth), startY, colWidth, rowHeight).fill();
            });
        }
        doc.fillColor('#000000');
        row.forEach((cell, i) => {
            doc.rect(startX + (i * colWidth), startY, colWidth, rowHeight)
               .stroke()
               .text(cell,
                    startX + (i * colWidth) + 5,
                    startY + 10,
                    { width: colWidth - 10 });
        });
        startY += rowHeight;
        if (startY > doc.page.height - 50) {
            doc.addPage();
            startY = 50;
        }
    });

    doc.y = startY + 10;
}

const exportSalesExcel = async (req, res) => {
    try {
        const dateRange = req.query.dateRange || 'day';
        const endDate = new Date();
        const startDate = new Date();

        if (dateRange === 'custom' && req.query.startDate && req.query.endDate) {
            startDate.setTime(new Date(req.query.startDate));
            endDate.setTime(new Date(req.query.endDate));
            
        } else {
            switch(dateRange) {
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setHours(0, 0, 0, 0);
            }
        }

        const dateMatchStage = {
            orderDate: { $gte: startDate, $lte: endDate }
        };

        const [totalSales, deliveredProducts, topProducts, avgOrders] = await Promise.all([
            Order.aggregate([
                { $match: dateMatchStage },
                { $unwind: '$products' },
                { $match: { 'products.status': 'Delivered' } },
                { $group: { _id: null, total: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }}}
            ]),
            Order.aggregate([
                { $match: dateMatchStage },
                { $unwind: '$products' },
                { $match: { 'products.status': 'Delivered' } },
                { $group: {_id: null, total: { $sum: '$products.quantity' }}}
            ]),
            Order.aggregate([
                { $match: dateMatchStage },
                { $unwind: '$products' },
                { $match: { 'products.status': 'Delivered' } },
                { $group: {
                    _id: '$products.productId',
                    productName: { $first: '$products.productName' },
                    units: { $sum: '$products.quantity' },
                    revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
                }},
                { $sort: { units: -1 } },
                { $limit: 3 },
                { $lookup: {from: 'products', localField: '_id', foreignField: '_id', as: 'productDetails'}},
                { $unwind: '$productDetails' }
            ]),
            Order.aggregate([
                { $match: dateMatchStage },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                        dailyOrders: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgOrders: { $avg: "$dailyOrders" }
                    }
                }
            ])
        ]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');
        worksheet.mergeCells('A1:D1');
        worksheet.getCell('A1').value = 'Sales Report';
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:D2');
        worksheet.getCell('A2').value = `Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };
        worksheet.addRow([]);
        worksheet.addRow(['Summary Statistics']);
        worksheet.getRow(4).font = { bold: true };

        worksheet.addRow(['Metric', 'Value']);
        worksheet.addRow(['Total Sales', `$${(totalSales[0]?.total || 0).toLocaleString()}`]);
        worksheet.addRow(['Delivered Products', (deliveredProducts[0]?.total || 0).toLocaleString()]);
        worksheet.addRow(['Average Orders', Math.round(avgOrders[0]?.avgOrders || 0).toString()]);
        worksheet.addRow([]);
        worksheet.addRow(['Top Products']);
        worksheet.getRow(9).font = { bold: true };

        worksheet.addRow(['Product Name', 'Units Sold', 'Revenue']);
        topProducts.forEach(product => {
            worksheet.addRow([
                product.productName,
                product.units,
                `$${product.revenue.toLocaleString()}`
            ]);
        });

        worksheet.columns.forEach(column => {
            column.width = 20;
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
        await workbook.xlsx.write(res);

    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).send('Error generating Excel file');
        }
    }
};

const loadreturn = async (req,res)  => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalReturns = await returnmodel.countDocuments();
        const totalPages = Math.ceil(totalReturns / limit);

        const returns = await returnmodel.find()
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('productId', 'name')
            .populate('orderId', 'orderId');

        res.render('admin/return', {
            returns,
            currentPage: page,
            totalPages,
            title: 'Return Management'
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Something went wrong');
    }
}

const updateReturnStatus = async (req, res) => {
    try {   
        const { returnId } = req.params;
        const { status } = req.body;

        const returnItem = await returnmodel.findById(returnId);
        
        if (!returnItem) {
            return res.status(404).json({ success: false, message: 'Return request not found' });
        }

        if (status === 'Approved') {
            const wallet = await walletmodel.findOne({ userId: returnItem.userId });
           
            if (wallet) {
                const product = await ProductModel.findById(returnItem.productId);
                const refundAmount = product.price * returnItem.quantity;
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    description: 'Refund for returned product'
                });
                await wallet.save();
            }
        }

        returnItem.status = status;
        await returnItem.save();

        res.json({ success: true, message: 'Return status updated successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Something went wrong'});
    }
}

const logout=async(req,res)=>{
    try {
        req.session.admin = null; 
        res.redirect('/admin/login');
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}





module.exports = {loadlogin,login,loaddashboard,
loaduser,banUser,loadProducts,loadaddproduct,
addProduct,loadcategory,loadaddcategory,
addcategory,loadUpdateCategory,updateCategory,
Categorylisting,Productlisting,loadupdateProduct,
updateProduct,loadorders,updateorderstatus,
loadviewoderdeatils,loadcoupon,loadaddcoupon,
addcoupon,loadupdatecoupon,updatecoupon,
couponstatus,loadsalesreport,exportSalesPDF,
exportSalesExcel,logout,getChartData,
loadreturn,updateReturnStatus}