
const express = require('express')
const app = express()
const path = require('path')
const session = require('express-session')
const nocache = require('nocache')
const userroutes =require('./routes/user')
const adminroutes = require('./routes/admin') 
const connectdb = require('./database/connectdb')



app.set('views',path.join(__dirname,'views'))
app.set('view engine','ejs')    
app.use(express.static('public'))
app.use('/uploads', express.static(__dirname + '/uploads'));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));


app.use(session({secret:'mysecretkey',resave:false,saveUninitialized:true,Cookie:{maxage:1000*60*60*24}}))
app.use(nocache())




connectdb()
app.use('/user',userroutes)
app.use('/admin',adminroutes)

app.use((req, res, next) => {
    res.status(404).render('user/404');
});




app.listen(3001,()=>{
    console.log('server started at:http//localhost:3001')
})