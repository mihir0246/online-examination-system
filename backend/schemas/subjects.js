var mongoose = require("mongoose");

var subjectschema = new mongoose.Schema({
    topic : {
        required : true,
        type : String
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel'
    },
    status:{
        type: Boolean,
        default : true,
        required : true
    }
},
{ timestamps: {}}

);


module.exports = subjectschema;
