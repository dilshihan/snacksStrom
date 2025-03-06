const adminmodel = require('../model/adminmodel')
const bcrypt = require('bcrypt')
const usermodel = require('../model/usermodel')
const ProductModel = require('../model/prodectmodel')
const  Categorymodel = require('../model/categorymodel')
const ordermodel = require('../model/ordermodel')
const fs = require('fs');
const path = require('path');



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
        
        const { name, price, stock, description, category } = req.body;

         // Extract filenames for multiple images
         let images = []
         images = req.files ? req.files.map(file => file.filename) : [];
        

        if (!name || !price || !category || !description||!stock) {
            return res.status(400).send("all field are required");
        }
        const existingProduct = await ProductModel.findOne( {name: { $regex: new RegExp(`^${name}$`, "i") }});
        if (existingProduct) {
            return res.status(400).json({ message: "Product already exists!" });
        }
        const newProduct = new ProductModel({ 
            name, 
            price, 
            stock, 
            description, 
            image:images, 
            category 
        });

        await newProduct.save();
        res.redirect('/admin/products');

    } catch (error) {
        console.error(error);
        
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
        const { name, price, description, stock, category} = req.body;
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

        // Function to convert base64 to an image file
        const saveBase64Image = async (base64String, index) => {
            if (!base64String || !base64String.startsWith('data:image')) {
                return existingProduct.image[index - 1] || null; // Keep old image if null
            }

            const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches) {
                return existingProduct.image[index - 1] || null; 
            }

            const extension = matches[1]; 
            const base64Data = matches[2];
            const filename = `product_${productId}_${index}.${extension}`;
            const filePath = path.join('uploads', filename);
            
            // Save the image file
            fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
            return filename;
        };
        // Process and save each cropped image or retain old ones
        for (let i = 1; i <= 3; i++) {
            updatedImages[i - 1] = await saveBase64Image(req.body[`croppedImage${i}`], i);
        }
        // Update product details in the database
        const updatedProduct = await ProductModel.findByIdAndUpdate(
            productId,
            { name, price, description, stock, category, image: updatedImages },
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
    const { name, description } = req.body;

    try {
        const existingCategory = await Categorymodel.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category already exists!" });
        }

        const newCategory = new Categorymodel({ name, description});
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
        const { name, description } = req.body;
        const categoryId = req.params.id;

        const existingCategory = await Categorymodel.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") },  _id: { $ne: categoryId }});
        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category name already exists. Choose a different name." });
        }

        const updatedCategory = await Categorymodel.findByIdAndUpdate(
            categoryId,
            { name, description},
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
        const orders = await ordermodel.find().skip(skip).limit(limit);

        res.render('admin/order', {
            orders, 
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit) 
        });

    } catch (error) {
        console.log(error);
    }
};

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
updateProduct,loadorders,logout}