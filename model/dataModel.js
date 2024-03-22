const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({

date: {
    type: String,
},

time: {
    type: String,
},

location: {
    type: String,
},

profilePicture: {
    url: {
        type: String,
    },
    public_id: {
        type: String,
    },
},

userId: {
    type: String, 
},


}, {timestamps: true});


const userDataModel = mongoose.model('data', dataSchema);

module.exports = {userDataModel};