const express = require('express')
const router = express.Router()
const usercontroller = require('../controller/usercontroller')
const userauth = require('../middleware/userauth')
const {uploadProfilePicture} = require("../utils/multer")


router.get('/register',userauth.isLogin,usercontroller.loadregister)
router.post('/register',usercontroller.registerUser)
router.post('/verify',usercontroller.verifyOTP)
router.get('/resendotp',usercontroller.resendOTP)
router.get('/forgotpassword',usercontroller.loadforgotpassword)
router.post('/send-otp',usercontroller.forgetsendotp)
router.get('/forgotpasswordotp',usercontroller.loadforgotPasswordotp)
router.post('/verify-otp',usercontroller.forgotverifyotp);
router.get('/newpassword',usercontroller.newpassword)
router.post('/reset-password',usercontroller.resetpassword)
router.post('/login',usercontroller.loginUser)
router.get('/home',usercontroller.Loadhome)
router.get('/menu',usercontroller.loadmenu)
router.get('/about',userauth.checksession,userauth.checkBan,usercontroller.loadabout)
router.get('/contactus',userauth.checksession,userauth.checkBan,usercontroller.loadcontactus)
router.get('/cart',userauth.checksession,userauth.checkBan,usercontroller.loadcart)
router.post('/add-to-cart',userauth.checksession,userauth.checkBan,usercontroller.addtocart)
router.post('/update-cart-quantity',userauth.checksession,userauth.checkBan,usercontroller.updatecartquantity);
router.delete('/cart/remove/:productId',userauth.checksession,userauth.checkBan,usercontroller.removefromcart);
router.get('/productdetails/:id',userauth.checksession,userauth.checkBan,usercontroller.Productdetails)
router.get('/checkout',userauth.checksession,userauth.checkBan,usercontroller.loadcheckout)
router.post('/add-checkoutaddress',userauth.checksession,userauth.checkBan,usercontroller.checkoutaddaddress)
router.post('/set-default-address',userauth.checksession,userauth.checkBan,usercontroller.checkoutchangeaddress)
router.get('/Ordersuccess',userauth.checksession,userauth.checkBan,usercontroller.loadordersuccess)
router.post('/order-details',userauth.checksession,userauth.checkBan,usercontroller.addorderdetails)
router.get('/userprofile',userauth.checksession,userauth.checkBan,usercontroller.loaduserprofile)
router.post('/update-profile',userauth.checksession,userauth.checkBan,usercontroller.updateprofile)
router.post('/profile/update-image',uploadProfilePicture,usercontroller.updateprofileimage)
router.post('/add-address',userauth.checksession,userauth.checkBan,usercontroller.addaddress)
router.post('/edit-address',userauth.checksession,userauth.checkBan,usercontroller.editaddress)
router.delete('/delete/:id',userauth.checksession,userauth.checkBan,usercontroller.deleteaddress)
router.get('/orderdetails',userauth.checksession,userauth.checkBan,usercontroller.loadorderdetils)
router.delete("/cancel-order/:orderId/:productId", userauth.checksession, userauth.checkBan, usercontroller.cancelorder);
router.post('/return-order/:orderId/:productId',userauth.checksession,userauth.checkBan,usercontroller.returnorder )
router.post('/update-password',userauth.checksession,userauth.checkBan,usercontroller.updatepassword)
router.get('/wishlist',userauth.checksession,userauth.checkBan,usercontroller.loadwishlist)
router.post('/add-to-wishlist', userauth.checksession, userauth.checkBan, usercontroller.addtowishlist);
router.delete('/wishlist/remove/:productId',userauth.checksession,userauth.checkBan,usercontroller.removefromwishlist);
router.get('/wallet',userauth.checksession,userauth.checkBan,usercontroller.loadwallet)
router.post('/add-money',userauth.checksession,userauth.checkBan,usercontroller.addMoney)
router.get('/invoice/:orderId',userauth.checksession,userauth.checkBan,usercontroller.downloadinvoice)
router.post('/create-razorpay-order', userauth.checksession, userauth.checkBan, usercontroller.createRazorpayOrder)
router.post('/verify-razorpay-payment', userauth.checksession, userauth.checkBan, usercontroller.verifyRazorpayPayment)
router.post('/logout',userauth.checksession,usercontroller.logout)
router.get('/auth/google/callback', usercontroller.handleGoogleCallback)
router.post('/auth/google/callback', usercontroller.handleGoogleLogin)




module.exports=router;