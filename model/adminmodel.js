const mongoose = require('mongoose')
const adminschema =  new mongoose.Schema({
    email:{
        type : String,
        require: true
    },
    password:{
        type : String,
        require:true
    }
})


module.exports=mongoose.model('admin',adminschema)