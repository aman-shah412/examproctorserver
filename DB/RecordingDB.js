const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
    RandomID: {
        type: String,
    },
    SelfiePhoto: {
        type: String,
    },
    IDPhoto: {
        type: String,
    },
    AdminSessionId: {
        type: String,
    },
    StudentSessionId: {
        type: String,
    }
})

const Record = mongoose.model("RECORDING", recordingSchema)

module.exports = Record;