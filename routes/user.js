const express = require('express')
const router = express.Router()
const usercontroller = require('../controller/usercontroller')
const userauth = require('../middleware/userauth')
const {uploadProfilePicture} = require("../utils/multer")
const addressmodel = require('../model/addressmodel')

router.get('/register',userauth.isLogin,usercontroller.loadregister)
router.post('/register',usercontroller.registerUser)
router.post('/verify',usercontroller.verifyOTP)
router.get('/resendotp',usercontroller.resendOTP)
router.post('/login',usercontroller.loginUser)
router.get('/home',usercontroller.Loadhome)
router.get('/menu',usercontroller.loadmenu)
router.get('/about',userauth.checksession,userauth.checkBan,usercontroller.loadabout)
router.get('/contactus',userauth.checksession,userauth.checkBan,usercontroller.loadcontactus)
router.get('/cart',userauth.checksession,userauth.checkBan,usercontroller.loadcart)
router.post('/add-to-cart',userauth.checksession,userauth.checkBan,usercontroller.addtocart)
router.delete('/cart/remove/:productId',userauth.checksession,userauth.checkBan,usercontroller.removefromcart);
router.get('/productdetails/:id',userauth.checksession,userauth.checkBan,usercontroller.Productdetails)
router.get('/checkout',userauth.checksession,userauth.checkBan,usercontroller.loadcheckout)
router.post('/add-checkoutaddress',userauth.checksession,userauth.checkBan,usercontroller.checkoutaddaddress)
router.post('/set-default-address',userauth.checksession,userauth.checkBan,usercontroller.checkoutchangeaddress)
router.get('/userprofile',userauth.checksession,userauth.checkBan,usercontroller.loaduserprofile)
router.post('/update-profile',userauth.checksession,userauth.checkBan,usercontroller.updateprofile)
router.post('/profile/update-image',uploadProfilePicture,usercontroller.updateprofileimage)
router.post('/add-address',userauth.checksession,userauth.checkBan,usercontroller.addaddress)
router.post('/edit-address',userauth.checksession,userauth.checkBan,usercontroller.editaddress)
router.delete('/delete/:id',userauth.checksession,userauth.checkBan,usercontroller.deleteaddress)
router.post('/logout',userauth.checksession,usercontroller.logout)
router.get('/auth/google/callback', usercontroller.handleGoogleCallback)
router.post('/auth/google/callback', usercontroller.handleGoogleLogin)





module.exports=router;