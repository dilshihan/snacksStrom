const express = require('express')
const router  = express.Router()
const admincontreller = require('../controller/admincontroller')
const adminauth =require('../middleware/adminauth')
const {upload} = require("../utils/multer")

router.get('/login',adminauth.islogin,admincontreller.loadlogin)
router.post('/login',admincontreller.login)
router.get('/dashboard',adminauth.checksession,admincontreller.loaddashboard)
router.get('/users',adminauth.checksession,admincontreller.loaduser)
router.post('/ban-user',adminauth.checksession,admincontreller.banUser)
router.get('/products',adminauth.checksession,admincontreller.loadProducts);
router.get('/addproduct',adminauth.checksession,admincontreller.loadaddproduct)
router.post('/addproduct', upload,adminauth.checksession, admincontreller.addProduct);
router.post('/products',adminauth.checksession,admincontreller.Productlisting)
router.get("/updateproduct/:id",adminauth.checksession, admincontreller.loadupdateProduct)
router.post('/updateproduct/:id',adminauth.checksession,admincontreller.updateProduct)
router.get('/category',adminauth.checksession,admincontreller.loadcategory)
router.get('/addcategory',adminauth.checksession,admincontreller.loadaddcategory)
router.post('/addcategory',adminauth.checksession,admincontreller.addcategory)
router.get('/categories/update/:id',adminauth.checksession, admincontreller.loadUpdateCategory);
router.post('/categories/update/:id', adminauth.checksession,admincontreller.updateCategory)
router.post('/categories/listing',adminauth.checksession, admincontreller.Categorylisting);
router.get('/order',adminauth.checksession,admincontreller.loadorders)
router.put("/update-order-status/:orderId",adminauth.checksession,admincontreller.updateorderstatus)
router.get('/vieworderdetils',adminauth.checksession,admincontreller.loadviewoderdeatils)
router.get('/logout',adminauth.checksession,admincontreller.logout)




module.exports = router