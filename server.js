require('dotenv').config();
const express = require('express')
const app = express()
const path = require('path')
const fs = require('fs')
const session = require('express-session')
const nocache = require('nocache')
const userroutes = require('./routes/user')
const adminroutes = require('./routes/admin') 
const connectdb = require('./database/connectdb')

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')    
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
if (process.env.VERCEL) {
    app.use('/uploads', express.static('/tmp/uploads'))
}

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',  
    resave: false,
    saveUninitialized: true,
    cookie: {                          
        maxAge: 1000 * 60 * 60 * 24  
    }
}));
app.use(nocache())

// Ensure DB connection before processing requests (critical for serverless cold-starts)
app.use(async (req, res, next) => {
    try {
        await connectdb();
        next();
    } catch (err) {
        console.error("DB connection error in middleware:", err);
        next(err);
    }
});
app.use('/user', userroutes)
app.use('/admin', adminroutes)

app.get('/', (req, res) => {
    res.redirect('/user/home');
});

app.use((req, res, next) => {
    res.status(404).render('user/404');
});

app.use((err, req, res, next) => {
    console.log(err);
    res.status(500).send("Something went wrong! Please try again later.");
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`server started at: http://localhost:${PORT}`)
    })
}

module.exports = app;