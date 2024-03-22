const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    
    firstName: {
        type: String,
    }, 

    lastName: {
        type: String,
    },

    email: {
        type: String,
    },

    password: {
        type: String,
    },

    token: {
        type: String,
    },
    
    isVerified: {
        type: Boolean,
        default: false,
    },
    
    userData: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'data', 
    }]


}, {timestamps: true});

const userModel = mongoose.model('user', userSchema);

module.exports = userModel;