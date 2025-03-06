const mongoose = require('mongoose')
const connectdb = async()=>{
    try{
        const connect = await mongoose.connect('mongodb://localhost:27017/snack_storm',{})
        

    }catch(error){
        console.log(error)
        process.exit(1)
    }
}

module.exports=connectdb