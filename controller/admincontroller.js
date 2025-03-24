const adminmodel = require('../model/adminmodel')
const bcrypt = require('bcrypt')
const usermodel = require('../model/usermodel')
const ProductModel = require('../model/prodectmodel')
const  Categorymodel = require('../model/categorymodel')
const ordermodel = require('../model/ordermodel')
const Order = require("../model/ordermodel")
const couponmodel = require('../model/couponmodel')
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');



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
        res.render('admin/dashboard')
    }catch(error){
        console.log(error)
    }
   
}

const loaduser = async (req, res) => {
    try {
        const admin = req.session.admin;
        if (!admin) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1; 
        let limit = 5; 
        let skip = (page - 1) * limit; 

        const totalUsers = await usermodel.countDocuments(); 
        const users = await usermodel.find({}).skip(skip).limit(limit); 

        res.render('admin/users', {
            users, 
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit) 
        });

    } catch (error) {
        console.log(error);
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
        const totalProducts = await ProductModel.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);
        const products = await ProductModel.find({})
            .skip((page - 1) * limit)
            .limit(limit);

        res.render('admin/products', { 
            products, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error(error);
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

        // Update category listing status
        category.isListed = isListed;
        await category.save();

        // Update all products with this category name to match the category's listing status
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
            { $match: { 'products.status': 'Pending' } }, 
            { $group: {_id: null, total: { $sum: '$products.quantity' }}}
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
                headers: ['Product Name', 'SKU', 'Units Sold', 'Revenue'],
                rows: topProducts.map(product => [
                    product.productName,
                    product.productDetails.sku || 'N/A',
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

const logout=async(req,res)=>{
    try {
        req.session.admin = null; 
        res.redirect('/admin/login');
    } catch (error) {
        console.error(error);
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
couponstatus,loadsalesreport,exportSalesPDF,logout}